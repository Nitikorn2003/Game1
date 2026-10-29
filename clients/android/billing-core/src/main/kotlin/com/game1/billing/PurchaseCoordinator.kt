package com.game1.billing

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlin.math.min
import kotlin.random.Random

/** Exponential backoff with jitter for retrying the server while it is unreachable. */
public class RetryPolicy(
    public val maxAttempts: Int = 6,
    public val baseDelayMs: Long = 2_000,
    public val maxDelayMs: Long = 60_000,
    private val random: Random = Random.Default,
) {
    init {
        require(maxAttempts >= 1) { "maxAttempts must be at least 1" }
        require(baseDelayMs in 1..maxDelayMs) { "baseDelayMs must be positive and at most maxDelayMs" }
    }

    /** Delay before retry number [retry] (1 for the first retry): between half and all of the backoff. */
    public fun delayBeforeRetry(retry: Int): Long {
        val backoff = min(maxDelayMs, baseDelayMs shl min(retry - 1, 20))
        return backoff / 2 + random.nextLong(backoff / 2 + 1)
    }
}

/**
 * Takes every purchase from Google Play to the game's server and reports the outcome.
 *
 * The device never decides that a purchase was paid. It sends the purchase token to the
 * server, which verifies it with Google, credits the ledger once, and then consumes or
 * acknowledges it. Wallet values shown to the player always come from the server.
 *
 * Call [start] once the billing connection is ready, and [restore] when the app starts and
 * each time it returns to the foreground.
 */
public class PurchaseCoordinator(
    private val gateway: BillingGateway,
    private val backend: PurchaseBackend,
    private val scope: CoroutineScope,
    private val retryPolicy: RetryPolicy = RetryPolicy(),
) {
    private val walletState = MutableStateFlow<Wallet?>(null)

    /** The latest wallet the server reported, or null before the first answer. */
    public val wallet: StateFlow<Wallet?> = walletState.asStateFlow()

    private val eventFlow = MutableSharedFlow<PurchaseEvent>(extraBufferCapacity = 64)
    public val events: SharedFlow<PurchaseEvent> = eventFlow.asSharedFlow()

    private val lock = Mutex()
    private val inFlight = HashMap<String, Job>()

    /** The newest copy of a purchase that arrived while its token was already being checked. */
    private val recheck = HashMap<String, StorePurchase>()
    private var updatesJob: Job? = null

    /** Starts handling billing flow results. Calling it again has no effect. */
    public fun start() {
        if (updatesJob?.isActive == true) return
        updatesJob = scope.launch { gateway.purchaseUpdates.collect { onUpdate(it) } }
    }

    public fun stop() {
        updatesJob?.cancel()
        updatesJob = null
    }

    /**
     * Sends every purchase Google Play still holds to the server and waits for the answers.
     * This finishes purchases that were interrupted by a crash, a lost connection or the app
     * being closed, and payments that completed while the app was not running.
     */
    public suspend fun restore() {
        submitUnfinished()?.joinAll()
    }

    private suspend fun submitUnfinished(): List<Job>? {
        val purchases = gateway.queryUnfinishedPurchases() ?: return null
        // An acknowledged purchase was already granted: the server acknowledges only after granting.
        return purchases.filter { !it.acknowledged }.map { submit(it) }
    }

    /**
     * The id to pass to BillingFlowParams.Builder.setObfuscatedAccountId(). Do not launch a
     * billing flow without it: it is how the server proves which player paid.
     */
    public suspend fun checkoutAccountId(): AccountIdResult = backend.obfuscatedAccountId()

    public suspend fun refreshWallet() {
        backend.wallet()?.let { walletState.value = it }
    }

    private suspend fun onUpdate(update: PurchaseUpdate) {
        when (update) {
            is PurchaseUpdate.Purchases -> update.purchases.forEach { submit(it) }
            // An earlier purchase of this item was never finished. Finish it without holding up
            // further updates while the server is asked.
            PurchaseUpdate.AlreadyOwned -> submitUnfinished()
            PurchaseUpdate.UserCanceled -> eventFlow.emit(PurchaseEvent.UserCanceled)
            is PurchaseUpdate.Failed -> eventFlow.emit(PurchaseEvent.BillingError(update.responseCode, update.debugMessage))
        }
    }

    /**
     * Sends one purchase to the server. If the same token is already being sent, the running
     * job is reused and checks once more with the newest copy when it finishes (a pending
     * purchase can complete while its first check is still in flight).
     */
    internal suspend fun submit(purchase: StorePurchase): Job = lock.withLock {
        val token = purchase.purchaseToken
        inFlight[token]?.let { running ->
            recheck[token] = purchase
            return@withLock running
        }
        val job = scope.launch {
            var next: StorePurchase? = purchase
            try {
                while (next != null) {
                    process(next)
                    next = nextOrFinish(token)
                }
            } finally {
                // Only reached with a purchase left over if the scope was cancelled.
                if (next != null) {
                    withContext(NonCancellable) {
                        lock.withLock {
                            inFlight -= token
                            recheck -= token
                        }
                    }
                }
            }
        }
        inFlight[token] = job
        job
    }

    /** The copy to check next, or null after marking [token] as no longer in flight. */
    private suspend fun nextOrFinish(token: String): StorePurchase? = lock.withLock {
        recheck.remove(token) ?: run {
            inFlight -= token
            null
        }
    }

    private suspend fun process(purchase: StorePurchase) {
        if (purchase.state == StorePurchaseState.UNSPECIFIED) return
        val productId = purchase.productIds.firstOrNull() ?: return
        var retries = 0
        while (true) {
            when (val verdict = askServer(productId, purchase.purchaseToken)) {
                is Verdict.Granted -> {
                    walletState.value = verdict.wallet
                    eventFlow.emit(PurchaseEvent.Granted(verdict.productId, verdict.quantity, verdict.wallet, verdict.newlyGranted))
                    return
                }
                is Verdict.Pending -> {
                    walletState.value = verdict.wallet
                    eventFlow.emit(PurchaseEvent.Pending(verdict.productId))
                    return
                }
                is Verdict.Canceled -> {
                    walletState.value = verdict.wallet
                    eventFlow.emit(PurchaseEvent.Canceled(verdict.productId))
                    return
                }
                is Verdict.Revoked -> {
                    walletState.value = verdict.wallet
                    eventFlow.emit(PurchaseEvent.Revoked(verdict.productId))
                    return
                }
                is Verdict.Refused -> {
                    eventFlow.emit(PurchaseEvent.Refused(productId, verdict.code, verdict.message))
                    return
                }
                Verdict.SignInRequired -> {
                    eventFlow.emit(PurchaseEvent.SignInRequired(productId))
                    return
                }
                is Verdict.RetryLater -> {
                    retries++
                    if (retries >= retryPolicy.maxAttempts) {
                        // Google Play keeps the purchase, so the next restore() picks it up again.
                        eventFlow.emit(PurchaseEvent.Deferred(productId, verdict.reason))
                        return
                    }
                    delay(retryPolicy.delayBeforeRetry(retries))
                }
            }
        }
    }

    private suspend fun askServer(productId: String, purchaseToken: String): Verdict =
        try {
            backend.verify(productId, purchaseToken)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // An unexpected failure must not crash the game or drop the purchase: Google Play
            // keeps it until the server consumes it, so it is retried like a network error.
            Verdict.RetryLater(e.javaClass.simpleName)
        }
}
