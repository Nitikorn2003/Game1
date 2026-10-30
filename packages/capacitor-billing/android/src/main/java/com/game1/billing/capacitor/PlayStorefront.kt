package com.game1.billing.capacitor

import android.app.Activity
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.ProductDetails
import com.game1.billing.play.PlayBillingGateway
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Google Play through the Play Billing Library, for [BillingBridge]. */
internal class PlayStorefront(private val gateway: PlayBillingGateway) : Storefront<Activity> {
    override suspend fun prices(productIds: List<String>): Map<String, String>? =
        gateway.queryProducts(productIds)
            ?.mapNotNull { product -> offer(product)?.let { product.productId to it.formattedPrice } }
            ?.toMap()

    override suspend fun launch(host: Activity, productId: String, obfuscatedAccountId: String): String? {
        val products = gateway.queryProducts(listOf(productId)) ?: return "billing_unavailable"
        val product = products.firstOrNull { it.productId == productId } ?: return "unknown_product"
        // The purchase sheet opens over the activity, from the main thread.
        val result = withContext(Dispatchers.Main) { gateway.launchPurchase(host, product, obfuscatedAccountId) }
        return when (result.responseCode) {
            BillingResponseCode.OK -> null
            // An earlier purchase of this product is unfinished; the gateway hands it to the coordinator.
            BillingResponseCode.ITEM_ALREADY_OWNED -> "already_owned"
            BillingResponseCode.ITEM_UNAVAILABLE -> "unknown_product"
            BillingResponseCode.BILLING_UNAVAILABLE,
            BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingResponseCode.SERVICE_DISCONNECTED,
            -> "billing_unavailable"
            else -> "billing_${result.responseCode}"
        }
    }

    /** The offer the purchase sheet shows: the same one PlayBillingGateway.launchPurchase picks. */
    private fun offer(product: ProductDetails): ProductDetails.OneTimePurchaseOfferDetails? =
        product.oneTimePurchaseOfferDetailsList?.firstOrNull() ?: product.oneTimePurchaseOfferDetails
}
