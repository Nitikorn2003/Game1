# @game1/capacitor-billing

The `Game1Billing` Capacitor plugin: Google Play purchases for every game's Android app. The
game's web code talks to it through `PlayStore` and `NativeBilling` in `@game1/platform`.

The plugin holds no purchase logic of its own. It compiles the purchase client from
`clients/android` into the app (`billing-core`: the coordinator and the purchase server
client; `billing-play`: the Play Billing Library 9 adapter), so there is one copy of that
code. The device only opens Google Play and passes purchase tokens on; the purchase server
verifies, grants, consumes and acknowledges every purchase.

## Using it in a game

1. Add `"@game1/capacitor-billing": "*"` to the game's dependencies and to
   `android.includePlugins` in its `capacitor.config.ts`.
2. Set `ext.kotlin_version` and the Kotlin Gradle plugin in the game's `android/build.gradle`
   (see `games/lodelings/android/build.gradle`).
3. Run `npx cap sync android`. Capacitor registers the plugin; nothing goes in `MainActivity`.

## Tests

In a game's `android/` folder, `./gradlew :game1-capacitor-billing:testDebugUnitTest` runs the
plugin's tests together with those of `billing-core` and `billing-play`, against the library
versions the app ships with. That has not run yet, because no Android build has been made
(see `games/lodelings/ANDROID.md`). The same 35 tests passed on a plain JVM with Kotlin 2.2.20,
with stand-ins for the Android, Capacitor and Play Billing classes. `BillingBridge`, which is
everything except the Capacitor and Play Billing glue, needs none of them.
