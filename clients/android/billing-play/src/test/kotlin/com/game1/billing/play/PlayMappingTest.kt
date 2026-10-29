package com.game1.billing.play

import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.Purchase
import com.game1.billing.PurchaseUpdate
import com.game1.billing.StorePurchase
import com.game1.billing.StorePurchaseState
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File

class PlayMappingTest {
    private val purchase = StorePurchase("token-1", listOf("gems_100"), StorePurchaseState.PURCHASED, 1, "GPA.1", "acct-1", false)

    @Test
    fun `maps billing flow results`() {
        assertEquals(PurchaseUpdate.Purchases(listOf(purchase)), purchaseUpdate(BillingResponseCode.OK, "", listOf(purchase)))
        assertEquals(PurchaseUpdate.UserCanceled, purchaseUpdate(BillingResponseCode.USER_CANCELED, "", emptyList()))
        assertEquals(PurchaseUpdate.AlreadyOwned, purchaseUpdate(BillingResponseCode.ITEM_ALREADY_OWNED, "", emptyList()))
        val failures = listOf(
            BillingResponseCode.SERVICE_DISCONNECTED,
            BillingResponseCode.FEATURE_NOT_SUPPORTED,
            BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingResponseCode.BILLING_UNAVAILABLE,
            BillingResponseCode.ITEM_UNAVAILABLE,
            BillingResponseCode.DEVELOPER_ERROR,
            BillingResponseCode.ERROR,
            BillingResponseCode.ITEM_NOT_OWNED,
            BillingResponseCode.NETWORK_ERROR,
        )
        for (code in failures) {
            assertEquals(PurchaseUpdate.Failed(code, "debug"), purchaseUpdate(code, "debug", listOf(purchase)))
        }
    }

    @Test
    fun `only a paid purchase counts as purchased`() {
        assertEquals(StorePurchaseState.PURCHASED, storePurchaseState(Purchase.PurchaseState.PURCHASED))
        assertEquals(StorePurchaseState.PENDING, storePurchaseState(Purchase.PurchaseState.PENDING))
        assertEquals(StorePurchaseState.UNSPECIFIED, storePurchaseState(Purchase.PurchaseState.UNSPECIFIED_STATE))
        assertEquals(StorePurchaseState.UNSPECIFIED, storePurchaseState(99))
    }

    @Test
    fun `the app never consumes or acknowledges purchases itself`() {
        // Unit tests run in the module directory.
        val sources = File("src/main").walkTopDown().filter { it.isFile }.toList()
        assertTrue(sources.isNotEmpty())
        for (file in sources) {
            val text = file.readText()
            for (call in listOf("consumeAsync", "acknowledgePurchase", "ConsumeParams", "AcknowledgePurchaseParams")) {
                assertTrue(call !in text, "${file.path} mentions $call")
            }
        }
    }
}
