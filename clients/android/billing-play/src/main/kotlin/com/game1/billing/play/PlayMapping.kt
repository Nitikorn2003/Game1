package com.game1.billing.play

import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.Purchase
import com.game1.billing.PurchaseUpdate
import com.game1.billing.StorePurchase
import com.game1.billing.StorePurchaseState

internal fun purchaseUpdate(responseCode: Int, debugMessage: String, purchases: List<StorePurchase>): PurchaseUpdate =
    when (responseCode) {
        BillingResponseCode.OK -> PurchaseUpdate.Purchases(purchases)
        BillingResponseCode.USER_CANCELED -> PurchaseUpdate.UserCanceled
        BillingResponseCode.ITEM_ALREADY_OWNED -> PurchaseUpdate.AlreadyOwned
        else -> PurchaseUpdate.Failed(responseCode, debugMessage)
    }

internal fun storePurchaseState(purchaseState: Int): StorePurchaseState =
    when (purchaseState) {
        Purchase.PurchaseState.PURCHASED -> StorePurchaseState.PURCHASED
        Purchase.PurchaseState.PENDING -> StorePurchaseState.PENDING
        else -> StorePurchaseState.UNSPECIFIED
    }

internal fun Purchase.toStorePurchase(): StorePurchase =
    StorePurchase(
        purchaseToken = purchaseToken,
        productIds = products,
        state = storePurchaseState(purchaseState),
        quantity = quantity,
        orderId = orderId,
        obfuscatedAccountId = accountIdentifiers?.obfuscatedAccountId,
        acknowledged = isAcknowledged,
    )
