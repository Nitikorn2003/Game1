# Android purchase client

Two modules that take Google Play purchases to [iap-server](../../services/iap-server) and
show the result. The device never grants anything by itself and never consumes or
acknowledges a purchase; the server does that after verifying it with Google.

| Module | What it is | Build needs |
| --- | --- | --- |
| `billing-core` | `PurchaseCoordinator` (sends each purchase token to the server once, retries with backoff, recovers unfinished purchases) and `HttpPurchaseBackend` (HTTPS client for the server). Plain Kotlin. | Any JDK 17 or later |
| `billing-play` | `PlayBillingGateway`, the adapter for Google Play Billing Library 9.1.0 (minSdk 23). | Android SDK (compileSdk 36) |

## Using it in a game

```kotlin
// Once per process, for example in Application.onCreate().
val gateway = PlayBillingGateway(context)
val backend = HttpPurchaseBackend(
    baseUrl = "https://iap.example.com",
    gameId = "game1",
    // The signed-in player's session token, or null when signed out.
    sessionToken = { currentIdToken() },
)
val coordinator = PurchaseCoordinator(gateway, backend, appScope)
coordinator.start()

// When the app starts and every time it returns to the foreground. This finishes purchases
// interrupted by a crash, a lost connection or a closed app, and pending payments that
// completed in the meantime.
appScope.launch { coordinator.restore() }

// Buying.
val products = gateway.queryProducts(listOf("gems_100", "remove_ads")) ?: return // Play unavailable
when (val account = coordinator.checkoutAccountId()) {
    is AccountIdResult.Ok -> gateway.launchPurchase(activity, products.first(), account.obfuscatedAccountId)
    AccountIdResult.SignInRequired -> showSignIn()
    is AccountIdResult.Unavailable -> showTryLater()
}

// Results. The wallet always comes from the server's ledger.
appScope.launch { coordinator.events.collect { event -> showPurchaseEvent(event) } }
appScope.launch { coordinator.wallet.collect { wallet -> showWallet(wallet) } }
```

`appScope` is a long-lived scope such as `CoroutineScope(SupervisorJob() + Dispatchers.Main)`.

Never launch a billing flow without the obfuscated account id from `checkoutAccountId()`:
it is how the server proves which player paid. Never grant items from a `Purchase` object,
and never call `consumeAsync` or `acknowledgePurchase` in the app.

Events the game should handle:

| Event | Meaning |
| --- | --- |
| `Granted` | The server credited the purchase. `newlyGranted` is false when it had already done so, for example after a restart. |
| `Pending` | Payment is not complete yet. Nothing is granted; tell the player it will arrive when the payment completes. |
| `Canceled`, `Revoked` | The purchase was cancelled, or refunded and its items taken back. |
| `Refused` | Final refusal from the server, for example a purchase that belongs to another player. |
| `Deferred` | The server could not be reached. Google Play keeps the purchase and the next `restore()` finishes it. |
| `SignInRequired` | No valid session. Sign in, then call `restore()`. |
| `UserCanceled`, `BillingError` | The billing flow was closed or failed on the device. |

## Building and testing

```sh
./gradlew -p billing-core test                                         # any JDK 17+
./gradlew :billing-play:assembleRelease :billing-play:testDebugUnitTest  # needs the Android SDK
```
