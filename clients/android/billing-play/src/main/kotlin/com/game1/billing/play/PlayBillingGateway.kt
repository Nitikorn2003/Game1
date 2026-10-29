package com.game1.billing.play

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.game1.billing.BillingGateway
import com.game1.billing.PurchaseUpdate
import com.game1.billing.StorePurchase
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume

/**
 * Google Play Billing Library 9 for [com.game1.billing.PurchaseCoordinator].
 *
 * It opens the purchase screen and reports results. It never consumes or acknowledges a
 * purchase: the server does that after it has verified the purchase with Google and credited
 * the player. Create one per process, for example in Application.onCreate().
 */
public class PlayBillingGateway(context: Context) : BillingGateway {
    // Buffered, so that a result that arrives before the coordinator collects is not lost.
    private val updates = Channel<PurchaseUpdate>(Channel.UNLIMITED)

    override val purchaseUpdates: Flow<PurchaseUpdate> = updates.receiveAsFlow()

    private val client: BillingClient = BillingClient.newBuilder(context.applicationContext)
        .setListener(
            PurchasesUpdatedListener { result, purchases ->
                val update = purchaseUpdate(result.responseCode, result.debugMessage, purchases.orEmpty().map { it.toStorePurchase() })
                updates.trySend(update)
            },
        )
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()

    private val connecting = Mutex()

    /** Connects to Google Play. False if billing is not available, for example without the Play Store. */
    public suspend fun connect(): Boolean = connecting.withLock {
        if (client.isReady) return@withLock true
        val result = suspendCancellableCoroutine<BillingResult?> { cont ->
            val answered = AtomicBoolean(false)
            client.startConnection(
                object : BillingClientStateListener {
                    override fun onBillingSetupFinished(billingResult: BillingResult) {
                        if (answered.compareAndSet(false, true)) cont.resume(billingResult)
                    }

                    // Later disconnects need nothing: the library reconnects on the next call.
                    override fun onBillingServiceDisconnected() {
                        if (answered.compareAndSet(false, true)) cont.resume(null)
                    }
                },
            )
        }
        result?.responseCode == BillingResponseCode.OK
    }

    public fun close() {
        client.endConnection()
        updates.close()
    }

    /** Details of one-time products (consumable or not), or null if Google Play could not be queried. */
    public suspend fun queryProducts(productIds: List<String>): List<ProductDetails>? {
        if (productIds.isEmpty()) return emptyList()
        if (!connect()) return null
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                productIds.map {
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(it)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                },
            )
            .build()
        return suspendCancellableCoroutine { cont ->
            client.queryProductDetailsAsync(params) { result, details ->
                cont.resume(if (result.responseCode == BillingResponseCode.OK) details.productDetailsList else null)
            }
        }
    }

    /**
     * Opens Google Play's purchase screen. The outcome arrives on [purchaseUpdates].
     *
     * [obfuscatedAccountId] must come from PurchaseCoordinator.checkoutAccountId(): the server
     * grants a purchase only to the player whose id it carries. [offerToken] picks one of the
     * product's one-time offers; by default the first one Google Play returned.
     */
    public fun launchPurchase(
        activity: Activity,
        product: ProductDetails,
        obfuscatedAccountId: String,
        offerToken: String? = product.oneTimePurchaseOfferDetailsList?.firstOrNull()?.offerToken,
    ): BillingResult {
        require(obfuscatedAccountId.length in 1..64) { "obfuscatedAccountId must be 1 to 64 characters" }
        val item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product)
        if (offerToken != null) item.setOfferToken(offerToken)
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(item.build()))
            .setObfuscatedAccountId(obfuscatedAccountId)
            .build()
        val result = client.launchBillingFlow(activity, params)
        // An earlier purchase of this item is unfinished: let the coordinator finish it.
        if (result.responseCode == BillingResponseCode.ITEM_ALREADY_OWNED) updates.trySend(PurchaseUpdate.AlreadyOwned)
        return result
    }

    override suspend fun queryUnfinishedPurchases(): List<StorePurchase>? {
        if (!connect()) return null
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        return suspendCancellableCoroutine { cont ->
            client.queryPurchasesAsync(params) { result, purchases ->
                cont.resume(if (result.responseCode == BillingResponseCode.OK) purchases.map { it.toStorePurchase() } else null)
            }
        }
    }
}
