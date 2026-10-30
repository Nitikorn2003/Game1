package com.game1.billing.capacitor

import com.game1.billing.AccountIdResult
import com.game1.billing.BillingGateway
import com.game1.billing.PurchaseBackend
import com.game1.billing.PurchaseCoordinator
import com.game1.billing.PurchaseEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** The parts of Google Play the bridge uses. On a device it is PlayStorefront, and [Host] the activity. */
internal interface Storefront<in Host> {
    /** Prices as Google Play shows them to this player, by product id; null when Play cannot be reached. */
    suspend fun prices(productIds: List<String>): Map<String, String>?

    /** Opens Google Play's purchase sheet. Null when it opened, otherwise why it did not. */
    suspend fun launch(host: Host, productId: String, obfuscatedAccountId: String): String?
}

/**
 * What the Game1Billing plugin does, kept free of Capacitor and Android so that it runs in
 * plain JVM tests. The answers match NativeBilling in @game1/platform.
 */
internal class BillingBridge<Host>(
    private val storefront: Storefront<Host>,
    gateway: BillingGateway,
    backend: (sessionToken: suspend () -> String?) -> PurchaseBackend,
    scope: CoroutineScope,
) {
    /** The player's session for the purchase server, set by the game; null when signed out. */
    @Volatile
    var sessionToken: String? = null

    private val coordinator = PurchaseCoordinator(gateway, backend { sessionToken }, scope)

    /** Each outcome as a purchaseEvent payload. */
    val events: Flow<Map<String, Any>> = coordinator.events.map { it.toJs() }

    init {
        coordinator.start()
    }

    /** The products Google Play prices, or null when it cannot be reached. */
    suspend fun products(productIds: List<String>): List<Map<String, String>>? =
        storefront.prices(productIds)?.map { (productId, price) -> mapOf("productId" to productId, "price" to price) }

    /**
     * Opens the purchase sheet for the signed-in player. Null when it opened: the outcome then
     * arrives as an event. Otherwise the reason it did not open.
     */
    suspend fun purchase(host: Host, productId: String): String? {
        // The server binds the purchase to this player through the account id, so no id, no purchase.
        val accountId = when (val id = coordinator.checkoutAccountId()) {
            is AccountIdResult.Ok -> id.obfuscatedAccountId
            AccountIdResult.SignInRequired -> return "signed_out"
            is AccountIdResult.Unavailable -> return "server_unavailable"
        }
        return storefront.launch(host, productId, accountId)
    }

    /** Sends every purchase Google Play still holds to the server and waits for the answers. */
    suspend fun restore() {
        coordinator.restore()
    }
}

/** The purchaseEvent payload, shaped like NativePurchaseEvent in @game1/platform. */
internal fun PurchaseEvent.toJs(): Map<String, Any> =
    when (this) {
        is PurchaseEvent.Granted -> mapOf("type" to "granted", "productId" to productId, "newlyGranted" to newlyGranted)
        is PurchaseEvent.Pending -> mapOf("type" to "pending", "productId" to productId)
        is PurchaseEvent.Canceled -> mapOf("type" to "canceled", "productId" to productId)
        is PurchaseEvent.Revoked -> mapOf("type" to "revoked", "productId" to productId)
        is PurchaseEvent.Deferred -> mapOf("type" to "deferred", "productId" to productId)
        is PurchaseEvent.SignInRequired -> mapOf("type" to "sign_in_required", "productId" to productId)
        is PurchaseEvent.Refused -> mapOf("type" to "refused", "productId" to productId, "code" to code, "message" to message)
        PurchaseEvent.UserCanceled -> mapOf("type" to "user_canceled")
        is PurchaseEvent.BillingError -> mapOf("type" to "billing_error", "responseCode" to responseCode, "message" to debugMessage)
    }
