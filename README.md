# Game1

In-app purchases for Game1 (and other games), verified on a server with Google Play.

| Path | What it is |
| --- | --- |
| [`services/iap-server`](services/iap-server) | Purchase server: verifies Google Play purchases with the Play Developer API, keeps an idempotent ledger of currency and entitlements, consumes and acknowledges purchases, and takes back refunded items. Node.js, TypeScript, PostgreSQL. |
| [`clients/android`](clients/android) | Android client: sends purchases from Google Play Billing Library 9.1.0 to the server and shows the server's answer. Kotlin. |
| [`docs/iap`](docs/iap) | [Security audit](docs/iap/SECURITY_AUDIT.md) and [external setup and launch checklist](docs/iap/PLAY_CONSOLE_SETUP.md). |

**Status: not production-ready.** The code is tested against a local fake of the Google
Play Developer API, but no real Google Play purchase has gone through it yet, and the Play
Console, service account and Pub/Sub setup does not exist yet. See the
[security audit](docs/iap/SECURITY_AUDIT.md).

## Running the tests

```sh
# Server: needs PostgreSQL; the database named here is wiped.
cd services/iap-server
npm ci
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/iap_test npm test

# Android purchase logic: any JDK 17 or later.
cd clients/android
./gradlew -p billing-core test

# Android Play Billing adapter: needs the Android SDK.
./gradlew :billing-play:assembleRelease :billing-play:testDebugUnitTest
```

CI runs all of these on every pull request.
