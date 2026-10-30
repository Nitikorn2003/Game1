package com.game1.billing

/**
 * A purchase as Google Play Billing reports it on the device. It only tells the app which
 * purchase token to send to the server: it is never proof of payment, so nothing is granted
 * from it on the device.
 */
public data class StorePurchase(
    val purchaseToken: String,
    val productIds: List<String>,
    val state: StorePurchaseState,
    val quantity: Int,
    val orderId: String?,
    val obfuscatedAccountId: String?,
    /** True once the server has consumed or acknowledged it with Google. */
    val acknowledged: Boolean,
)

public enum class StorePurchaseState { PURCHASED, PENDING, UNSPECIFIED }

/** Balances and entitlements as the server's ledger holds them. */
public data class Wallet(
    val balances: Map<String, Long>,
    val entitlements: Set<String>,
) {
    public companion object {
        public val EMPTY: Wallet = Wallet(emptyMap(), emptySet())
    }
}

/** The server's decision about one purchase token. */
public sealed interface Verdict {
    /** The server granted the purchase (now, or on an earlier request). */
    public data class Granted(
        val productId: String,
        val quantity: Int?,
        val wallet: Wallet,
        val newlyGranted: Boolean,
    ) : Verdict

    /** Payment is not complete yet (for example cash at a store). Nothing is granted. */
    public data class Pending(val productId: String, val wallet: Wallet) : Verdict

    /** The purchase was cancelled before it was paid. */
    public data class Canceled(val productId: String, val wallet: Wallet) : Verdict

    /** The purchase was refunded or revoked and its items taken back. */
    public data class Revoked(val productId: String, val wallet: Wallet) : Verdict

    /**
     * The server refused the purchase for good: Google does not know the token, it is for a
     * different product, it belongs to another player, or it failed validation. Retrying does
     * not help.
     */
    public data class Refused(val code: String, val message: String) : Verdict

    /** The player session is missing or expired. Sign in again, then retry. */
    public data object SignInRequired : Verdict

    /** Network or server trouble. Keep the purchase and try again later. */
    public data class RetryLater(val reason: String) : Verdict
}

/** What the coordinator tells the game UI. */
public sealed interface PurchaseEvent {
    public val productId: String?

    /** [newlyGranted] is false when the server had already granted it, for example after a restart. */
    public data class Granted(
        override val productId: String,
        val quantity: Int?,
        val wallet: Wallet,
        val newlyGranted: Boolean,
    ) : PurchaseEvent
    public data class Pending(override val productId: String) : PurchaseEvent
    public data class Canceled(override val productId: String) : PurchaseEvent
    public data class Revoked(override val productId: String) : PurchaseEvent
    public data class Refused(override val productId: String, val code: String, val message: String) : PurchaseEvent

    /** Could not reach the server; the purchase is kept and finished on a later [PurchaseCoordinator.restore]. */
    public data class Deferred(override val productId: String, val reason: String) : PurchaseEvent
    public data class SignInRequired(override val productId: String) : PurchaseEvent
    public data object UserCanceled : PurchaseEvent {
        override val productId: String? = null
    }
    public data class BillingError(val responseCode: Int, val debugMessage: String) : PurchaseEvent {
        override val productId: String? = null
    }
}
