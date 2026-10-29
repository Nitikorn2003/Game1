package com.game1.billing

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class PurchaseCoordinatorTest {
    private val gems = Wallet(mapOf("gems" to 100L), emptySet())

    private class FakeGateway : BillingGateway {
        val updates = MutableSharedFlow<PurchaseUpdate>()
        override val purchaseUpdates = updates
        var unfinished: List<StorePurchase>? = emptyList()
        var queries = 0

        override suspend fun queryUnfinishedPurchases(): List<StorePurchase>? {
            queries++
            return unfinished
        }
    }

    /** Answers verify calls from a script; the last answer repeats. Optionally waits on a gate. */
    private class FakeBackend(vararg answers: Verdict) : PurchaseBackend {
        val script = ArrayDeque(answers.toList())
        val calls = mutableListOf<Pair<String, String>>()
        var gate: CompletableDeferred<Unit>? = null

        override suspend fun obfuscatedAccountId(): AccountIdResult = AccountIdResult.Ok("acct-1")

        override suspend fun verify(productId: String, purchaseToken: String): Verdict {
            calls += productId to purchaseToken
            gate?.await()
            return if (script.size > 1) script.removeFirst() else script.first()
        }

        override suspend fun wallet(): Wallet? = null
    }

    private fun purchase(
        token: String = "token-1",
        state: StorePurchaseState = StorePurchaseState.PURCHASED,
        acknowledged: Boolean = false,
    ) = StorePurchase(token, listOf("gems_100"), state, 1, "GPA.1", "acct-1", acknowledged)

    /**
     * The coordinator runs on its own scope rather than backgroundScope, whose coroutines
     * advanceUntilIdle() does not wait for. The scope is cancelled when the test ends.
     */
    private fun TestScope.coordinator(gateway: BillingGateway, backend: PurchaseBackend): Pair<PurchaseCoordinator, MutableList<PurchaseEvent>> {
        val scope = CoroutineScope(coroutineContext + SupervisorJob())
        backgroundScope.launch {
            try {
                awaitCancellation()
            } finally {
                scope.cancel()
            }
        }
        val coordinator = PurchaseCoordinator(gateway, backend, scope, RetryPolicy(maxAttempts = 4, baseDelayMs = 1_000, maxDelayMs = 8_000, random = Random(1)))
        val events = mutableListOf<PurchaseEvent>()
        scope.launch { coordinator.events.collect { events += it } }
        coordinator.start()
        runCurrent()
        return coordinator to events
    }

    private val granted = Verdict.Granted("gems_100", 1, gems, newlyGranted = true)

    @Test
    fun `sends a completed purchase to the server and shows the server's wallet`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(granted)
        val (coordinator, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase())))
        advanceUntilIdle()

        assertEquals(listOf("gems_100" to "token-1"), backend.calls)
        assertEquals(listOf<PurchaseEvent>(PurchaseEvent.Granted("gems_100", 1, gems, true)), events)
        assertEquals(gems, coordinator.wallet.value)
    }

    @Test
    fun `sends a token only once while it is in flight, then checks once more`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(granted, Verdict.Granted("gems_100", 1, gems, newlyGranted = false))
        backend.gate = CompletableDeferred()
        val (_, events) = coordinator(gateway, backend)

        repeat(5) { gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase()))) }
        runCurrent()
        assertEquals(1, backend.calls.size)
        backend.gate!!.complete(Unit)
        advanceUntilIdle()

        assertEquals(2, backend.calls.size)
        assertEquals(listOf(true, false), events.filterIsInstance<PurchaseEvent.Granted>().map { it.newlyGranted })
    }

    @Test
    fun `does not grant a pending purchase and checks again when the payment completes`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(Verdict.Pending("gems_100", Wallet.EMPTY), granted)
        val (coordinator, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase(state = StorePurchaseState.PENDING))))
        advanceUntilIdle()
        assertEquals(listOf<PurchaseEvent>(PurchaseEvent.Pending("gems_100")), events)
        assertEquals(Wallet.EMPTY, coordinator.wallet.value)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase(state = StorePurchaseState.PURCHASED))))
        advanceUntilIdle()
        assertEquals(PurchaseEvent.Granted("gems_100", 1, gems, true), events.last())
    }

    @Test
    fun `rechecks a pending purchase that completes while its first check is still in flight`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(Verdict.Pending("gems_100", Wallet.EMPTY), granted)
        backend.gate = CompletableDeferred()
        val (coordinator, _) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase(state = StorePurchaseState.PENDING))))
        runCurrent()
        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase(state = StorePurchaseState.PURCHASED))))
        runCurrent()
        backend.gate!!.complete(Unit)
        advanceUntilIdle()

        assertEquals(2, backend.calls.size)
        assertEquals(gems, coordinator.wallet.value)
    }

    @Test
    fun `retries with growing delays while the server is unreachable`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(Verdict.RetryLater("HTTP 503"), Verdict.RetryLater("IOException"), granted)
        val (_, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase())))
        advanceUntilIdle()

        assertEquals(3, backend.calls.size)
        assertTrue(currentTime in 1_000L..3_000L, "waited $currentTime ms")
        assertEquals(PurchaseEvent.Granted("gems_100", 1, gems, true), events.single())
    }

    @Test
    fun `keeps the purchase for later when the server stays unreachable, and finishes it on restore`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(Verdict.RetryLater("HTTP 503"))
        val (coordinator, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase())))
        advanceUntilIdle()
        assertEquals(4, backend.calls.size)
        assertEquals(PurchaseEvent.Deferred("gems_100", "HTTP 503"), events.single())

        // The app restarts later; Google Play still holds the unconsumed purchase.
        backend.script.clear()
        backend.script += granted
        gateway.unfinished = listOf(purchase())
        coordinator.restore()

        assertEquals(PurchaseEvent.Granted("gems_100", 1, gems, true), events.last())
    }

    @Test
    fun `restore sends unfinished purchases and skips ones the server already acknowledged`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(granted)
        val (coordinator, _) = coordinator(gateway, backend)
        gateway.unfinished = listOf(purchase("a"), purchase("b", acknowledged = true), purchase("c", StorePurchaseState.PENDING))

        coordinator.restore()

        assertEquals(listOf("a", "c"), backend.calls.map { it.second }.sorted())
    }

    @Test
    fun `restore does nothing when the store cannot be queried`() = runTest {
        val gateway = FakeGateway()
        gateway.unfinished = null
        val backend = FakeBackend(granted)
        val (coordinator, _) = coordinator(gateway, backend)

        coordinator.restore()

        assertEquals(0, backend.calls.size)
    }

    @Test
    fun `finishes the earlier purchase when Play says the item is already owned`() = runTest {
        val gateway = FakeGateway()
        gateway.unfinished = listOf(purchase())
        val backend = FakeBackend(granted)
        val (_, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.AlreadyOwned)
        advanceUntilIdle()

        assertEquals(1, gateway.queries)
        assertEquals(PurchaseEvent.Granted("gems_100", 1, gems, true), events.single())
    }

    @Test
    fun `keeps handling billing results while an already-owned purchase is being finished`() = runTest {
        val gateway = FakeGateway()
        gateway.unfinished = listOf(purchase())
        val backend = FakeBackend(granted)
        backend.gate = CompletableDeferred()
        val (_, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.AlreadyOwned)
        gateway.updates.emit(PurchaseUpdate.UserCanceled)
        runCurrent()
        assertEquals(listOf<PurchaseEvent>(PurchaseEvent.UserCanceled), events)

        backend.gate!!.complete(Unit)
        advanceUntilIdle()
        assertEquals(PurchaseEvent.Granted("gems_100", 1, gems, true), events.last())
    }

    @Test
    fun `treats an unexpected backend failure like a network error`() = runTest {
        val gateway = FakeGateway()
        val backend = object : PurchaseBackend {
            var calls = 0
            override suspend fun obfuscatedAccountId() = AccountIdResult.Ok("acct-1")
            override suspend fun verify(productId: String, purchaseToken: String): Verdict {
                calls++
                throw IllegalStateException("session provider failed")
            }
            override suspend fun wallet(): Wallet? = null
        }
        val (coordinator, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase())))
        advanceUntilIdle()

        assertEquals(4, backend.calls)
        assertEquals(PurchaseEvent.Deferred("gems_100", "IllegalStateException"), events.single())
        assertNull(coordinator.wallet.value)
    }

    @Test
    fun `stops at a refusal without retrying`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(Verdict.Refused("purchase_not_owned", "This purchase belongs to a different player."))
        val (coordinator, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase())))
        advanceUntilIdle()

        assertEquals(1, backend.calls.size)
        assertEquals(
            PurchaseEvent.Refused("gems_100", "purchase_not_owned", "This purchase belongs to a different player."),
            events.single(),
        )
        assertNull(coordinator.wallet.value)
    }

    @Test
    fun `asks the player to sign in instead of retrying without a session`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(Verdict.SignInRequired)
        val (_, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase())))
        advanceUntilIdle()

        assertEquals(PurchaseEvent.SignInRequired("gems_100"), events.single())
        assertEquals(1, backend.calls.size)
    }

    @Test
    fun `reports cancelled flows and billing errors without calling the server`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(granted)
        val (_, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.UserCanceled)
        gateway.updates.emit(PurchaseUpdate.Failed(2, "Service unavailable"))
        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase(state = StorePurchaseState.UNSPECIFIED))))
        advanceUntilIdle()

        assertEquals(listOf(PurchaseEvent.UserCanceled, PurchaseEvent.BillingError(2, "Service unavailable")), events)
        assertEquals(0, backend.calls.size)
    }

    @Test
    fun `shows a refunded purchase as revoked with the server's reduced wallet`() = runTest {
        val gateway = FakeGateway()
        val backend = FakeBackend(Verdict.Revoked("gems_100", Wallet(mapOf("gems" to -40L), emptySet())))
        val (coordinator, events) = coordinator(gateway, backend)

        gateway.updates.emit(PurchaseUpdate.Purchases(listOf(purchase())))
        advanceUntilIdle()

        assertEquals(PurchaseEvent.Revoked("gems_100"), events.single())
        assertEquals(-40L, coordinator.wallet.value!!.balances["gems"])
    }

    @Test
    fun `the store adapter cannot consume or acknowledge purchases`() {
        val names = BillingGateway::class.java.methods.map { it.name.lowercase() }
        assertTrue(names.none { "consume" in it || "acknowledge" in it }, names.toString())
    }

    @Test
    fun `retry delays grow and stay within bounds`() {
        val policy = RetryPolicy(maxAttempts = 10, baseDelayMs = 1_000, maxDelayMs = 8_000, random = Random(7))
        val delays = (1..8).map { policy.delayBeforeRetry(it) }
        delays.zip(listOf(1_000L, 2_000L, 4_000L, 8_000L, 8_000L, 8_000L, 8_000L, 8_000L)).forEach { (delay, cap) ->
            assertTrue(delay in cap / 2..cap, "delay $delay not in ${cap / 2}..$cap")
        }
    }
}
