package com.game1.billing

import kotlinx.coroutines.flow.Flow

/**
 * The device's store (Google Play Billing Library). It deliberately has no consume or
 * acknowledge operations: the server does both through the Google Play Developer API after
 * it has verified and recorded the purchase, so a modified client cannot finish a purchase
 * without the server seeing it.
 */
public interface BillingGateway {
    /** Results of billing flows, as delivered to PurchasesUpdatedListener. */
    public val purchaseUpdates: Flow<PurchaseUpdate>

    /**
     * Purchases Google Play still holds for the signed-in Google account: pending, or paid but
     * not yet consumed or acknowledged by the server (queryPurchasesAsync). Null if the store
     * could not be queried.
     */
    public suspend fun queryUnfinishedPurchases(): List<StorePurchase>?
}

public sealed interface PurchaseUpdate {
    public data class Purchases(val purchases: List<StorePurchase>) : PurchaseUpdate

    public data object UserCanceled : PurchaseUpdate

    /** ITEM_ALREADY_OWNED: an earlier purchase of the item has not been finished yet. */
    public data object AlreadyOwned : PurchaseUpdate

    public data class Failed(val responseCode: Int, val debugMessage: String) : PurchaseUpdate
}

/** The game's purchase server (services/iap-server). */
public interface PurchaseBackend {
    /**
     * The opaque id to pass to BillingFlowParams.Builder.setObfuscatedAccountId(). The server
     * uses it to prove which player made a purchase.
     */
    public suspend fun obfuscatedAccountId(): AccountIdResult

    /** Asks the server to verify a purchase with Google and grant it. */
    public suspend fun verify(productId: String, purchaseToken: String): Verdict

    public suspend fun wallet(): Wallet?
}

public sealed interface AccountIdResult {
    public data class Ok(val obfuscatedAccountId: String) : AccountIdResult

    public data object SignInRequired : AccountIdResult

    public data class Unavailable(val reason: String) : AccountIdResult
}
