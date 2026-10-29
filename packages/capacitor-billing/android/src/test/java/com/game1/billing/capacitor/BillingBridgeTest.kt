package com.game1.billing.capacitor

import com.game1.billing.AccountIdResult
import com.game1.billing.BillingGateway
import com.game1.billing.PurchaseBackend
import com.game1.billing.PurchaseEvent
import com.game1.billing.PurchaseUpdate
import com.game1.billing.StorePurchase
import com.game1.billing.StorePurchaseState
import com.game1.billing.Verdict
import com.game1.billing.Wallet
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class BillingBridgeTest {
    private val wallet = Wallet(mapOf("gems" to 100L), emptySet())

    private class FakeGateway : BillingGateway {
        val updates = MutableSharedFlow<PurchaseUpdate>()
        override val purchaseUpdates = updates
        var unfinished: List<StorePurchase>? = emptyList()

        override suspend fun queryUnfinishedPurchases(): List<StorePurchase>? = unfinished
    }

    /** The purchase server, which only answers players with a session. */
    private class FakeBackend(private val token: suspend () -> String?, private val verdict: Verdict) : PurchaseBackend {
        var accountId: AccountIdResult? = null
        val verified = mutableListOf<String>()

        override suspend fun obfuscatedAccountId(): AccountIdResult =
            accountId ?: if (token() == null) AccountIdResult.SignInRequired else AccountIdResult.Ok("acct-${token()}")

        override suspend fun verify(productId: String, purchaseToken: String): Verdict {
            if (token() == null) return Verdict.SignInRequired
            verified += purchaseToken
            return verdict
        }

        override suspend fun wallet(): Wallet? = null
    }

    /** Google Play: one price list, and a purchase sheet that opens or answers with [launchFailure]. */
    private class FakeStorefront : Storefront<String> {
        var prices: Map<String, String>? = mapOf("gems_100" to "฿35.00")
        var launchFailure: String? = null
        val launched = mutableListOf<String>()

        override suspend fun prices(productIds: List<String>) = prices?.filterKeys { it in productIds }

        override suspend fun launch(host: String, productId: String, obfuscatedAccountId: String): String? {
            launched += "$host $productId $obfuscatedAccountId"
            return launchFailure
        }
    }

    private class World(scope: CoroutineScope, verdict: Verdict) {
        val gateway = FakeGateway()
        val storefront = FakeStorefront()
        lateinit var backend: FakeBackend
        val bridge = BillingBridge(storefront, gateway, { token -> FakeBackend(token, verdict).also { backend = it } }, scope)
    }

    private fun held(token: String) = StorePurchase(token, listOf("gems_100"), StorePurchaseState.PURCHASED, 1, "GPA.1", "acct-player", false)

    @Test
    fun `prices only what Google Play prices`() = runTest {
        val world = World(backgroundScope, Verdict.Pending("gems_100", wallet))
        assertEquals(
            listOf(mapOf("productId" to "gems_100", "price" to "฿35.00")),
            world.bridge.products(listOf("gems_100", "remove_ads")),
        )
        world.storefront.prices = null
        assertNull(world.bridge.products(listOf("gems_100")))
    }

    @Test
    fun `opens the purchase sheet with the signed-in player's account id`() = runTest {
        val world = World(backgroundScope, Verdict.Pending("gems_100", wallet))
        assertEquals("signed_out", world.bridge.purchase("activity", "gems_100"))
        assertTrue(world.storefront.launched.isEmpty())

        world.bridge.sessionToken = "player"
        assertNull(world.bridge.purchase("activity", "gems_100"))
        assertEquals(listOf("activity gems_100 acct-player"), world.storefront.launched)

        world.storefront.launchFailure = "already_owned"
        assertEquals("already_owned", world.bridge.purchase("activity", "gems_100"))

        world.backend.accountId = AccountIdResult.Unavailable("HTTP 503")
        assertEquals("server_unavailable", world.bridge.purchase("activity", "gems_100"))
        assertEquals(2, world.storefront.launched.size)
    }

    @Test
    fun `reports what the server decided about each purchase as an event`() = runTest {
        val world = World(backgroundScope, Verdict.Granted("gems_100", 1, wallet, newlyGranted = true))
        val events = mutableListOf<Map<String, Any>>()
        backgroundScope.launch { world.bridge.events.toList(events) }
        runCurrent()

        // Signed out, the held purchase waits for a session.
        world.gateway.unfinished = listOf(held("token-1"))
        world.bridge.restore()
        runCurrent()
        assertEquals(listOf(mapOf<String, Any>("type" to "sign_in_required", "productId" to "gems_100")), events)

        world.bridge.sessionToken = "player"
        world.bridge.restore()
        runCurrent()
        assertEquals(mapOf<String, Any>("type" to "granted", "productId" to "gems_100", "newlyGranted" to true), events.last())
        assertEquals(listOf("token-1"), world.backend.verified)

        // A purchase from the purchase sheet goes the same way.
        world.gateway.updates.emit(PurchaseUpdate.Purchases(listOf(held("token-2"))))
        runCurrent()
        assertEquals(listOf("token-1", "token-2"), world.backend.verified)
        world.gateway.updates.emit(PurchaseUpdate.UserCanceled)
        runCurrent()
        assertEquals(mapOf<String, Any>("type" to "user_canceled"), events.last())
    }

    @Test
    fun `every outcome has the shape the game expects`() {
        val cases = mapOf(
            PurchaseEvent.Granted("gems_100", 1, wallet, newlyGranted = false) to
                mapOf("type" to "granted", "productId" to "gems_100", "newlyGranted" to false),
            PurchaseEvent.Pending("gems_100") to mapOf("type" to "pending", "productId" to "gems_100"),
            PurchaseEvent.Canceled("gems_100") to mapOf("type" to "canceled", "productId" to "gems_100"),
            PurchaseEvent.Revoked("remove_ads") to mapOf("type" to "revoked", "productId" to "remove_ads"),
            PurchaseEvent.Deferred("gems_100", "HTTP 503") to mapOf("type" to "deferred", "productId" to "gems_100"),
            PurchaseEvent.SignInRequired("gems_100") to mapOf("type" to "sign_in_required", "productId" to "gems_100"),
            PurchaseEvent.Refused("gems_100", "purchase_not_owned", "Another player made this purchase.") to
                mapOf("type" to "refused", "productId" to "gems_100", "code" to "purchase_not_owned", "message" to "Another player made this purchase."),
            PurchaseEvent.UserCanceled to mapOf("type" to "user_canceled"),
            PurchaseEvent.BillingError(6, "Internal error") to mapOf("type" to "billing_error", "responseCode" to 6, "message" to "Internal error"),
        )
        for ((event, expected) in cases) assertEquals<Map<String, Any>>(expected, event.toJs())
    }
}
