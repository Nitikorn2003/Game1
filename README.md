# Game1

Mobile games for Google Play, built on one shared framework, with ads (AdMob) and in-app
purchases verified on a server.

| Path | What it is |
| --- | --- |
| [`games/lodelings`](games/lodelings) | **Lodelings**, an idle mining RPG: tap through the Deep, hatch and level crystal creatures, beat a Guardian every five depths, resurface for relics. English and Thai. Browser version for testing, Android app through Capacitor. [Android build](games/lodelings/ANDROID.md), [Google Play release](games/lodelings/RELEASE.md). |
| [`packages/engine`](packages/engine) | Game-agnostic core: fixed-step loop, clocks, versioned saves with checksums, seeded random numbers, economy math, number formatting, daily resets, i18n. |
| [`packages/platform`](packages/platform) | Device services behind small interfaces: storage, ads (test ads, AdMob with Google's consent form), purchases (test store, Google Play through the purchase server), sign-in (Firebase), cloud saves, haptics. |
| [`packages/ui`](packages/ui) | Preact building blocks: buttons, panels, tabs, modals, toasts, the Android back button, and the store art renderer. |
| [`packages/capacitor-billing`](packages/capacitor-billing) | The Capacitor plugin that connects a game's Android app to Google Play Billing. |
| [`services/iap-server`](services/iap-server) | Purchase server: verifies Google Play purchases, keeps an idempotent ledger, consumes and acknowledges purchases, takes back refunds, and stores cloud saves. Node.js, TypeScript, PostgreSQL. |
| [`clients/android`](clients/android) | The Android purchase client the billing plugin compiles in (Play Billing Library 9.1.0). Kotlin. |
| [`tools`](tools) | `store-assets.ts` draws a game's launcher icons, splash icon, store graphics and screenshots and writes its listing and privacy page; `gradlew.ts`, `inline-html.ts`, and the Lodelings balance scripts. |
| [`docs/iap`](docs/iap) | [Security audit](docs/iap/SECURITY_AUDIT.md) of the purchase system and its [external setup checklist](docs/iap/PLAY_CONSOLE_SETUP.md). |

**Status: not released.** The games and the server are tested here (below), but no Android
build has been made yet, because this environment cannot download Google's Android
libraries, and no real Google Play purchase has gone through the server. The first Android
build runs on a computer with Android Studio or in CI. Publishing needs a Google Play
developer account and the steps in [RELEASE.md](games/lodelings/RELEASE.md).

## Working on the games

Node.js 22 or later.

```sh
npm ci
npm run dev -w games/lodelings      # the browser version, with test ads and a test store
npm run typecheck && npm run lint
npm test                            # unit tests of the framework and the games
npm run build && npm run e2e        # builds, then plays each game in a phone-sized browser
```

The browser version never charges or shows real ads. Its saves stay in the browser.

## Running the other tests

```sh
# Purchase server: needs PostgreSQL; the database named here is wiped.
cd services/iap-server
npm ci
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/iap_test npm test

# Android purchase logic: any JDK 17 or later.
cd clients/android
./gradlew -p billing-core test

# Android Play Billing adapter and the Lodelings app: need the Android SDK.
./gradlew :billing-play:assembleRelease :billing-play:testDebugUnitTest
npm run android:apk -w games/lodelings
```

CI runs all of these on every pull request.

This repository is public. Never commit service account keys, `.env` files,
`google-services.json`, upload keys or their passwords, or real AdMob ids; the settings
files that hold them are git-ignored and have committed `.example` versions.
