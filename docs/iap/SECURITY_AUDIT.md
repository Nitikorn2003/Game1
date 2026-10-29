# Security audit: Google Play in-app purchases

Date: 29 October 2026. Covers `services/iap-server`, `clients/android/billing-core` and
`clients/android/billing-play`.

## Verdict

**Not production-ready.** No known critical or high-severity issue remains in the code after
the fixes listed below, but the system has never run against the real Google Play:

1. Every automated test talks to a local fake of the Google Play Developer API. No real
   purchase, refund or notification has gone through it yet.
2. The Google Play adapter (`billing-play`) is compiled and unit-tested in CI only. It has
   not run on a device.
3. None of the external setup exists yet: Play Console products, license testers, the
   service account, Pub/Sub, sign-in and hosting
   ([PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md)).

The manual tests in PLAY_CONSOLE_SETUP.md section 6, run with license testers, are the
remaining gate before launch.

The repository was empty when the audit was requested, so there was no existing purchase
system to audit. This one was built for the audit and then tested against every requested
case.

## Sources checked

| Source | Used for |
| --- | --- |
| Google Play Billing Library release notes (developer.android.com) | 9.1.0, released 18 June 2026, is current; it needs minSdk 23. |
| Integrate the Google Play Billing Library (developer.android.com) | Pending purchases (`enableOneTimeProducts`), automatic reconnection, `queryPurchasesAsync` on start and resume, `setObfuscatedAccountId`, one-time offers, `ITEM_ALREADY_OWNED`, acknowledgement within three days. |
| Fight fraud and abuse, backend integration (developer.android.com) | Verify on a backend with the Play Developer API, never trust the device, refund and revoke purchases you will not fulfil, handle voided purchases. |
| Real-time developer notifications reference (developer.android.com) | Message format, one-time product and voided purchase notification types, test notifications, refund reviews. |
| androidpublisher v3 discovery document | Exact request and response fields for `purchases.productsv2.getproductpurchasev2`, `purchases.products.consume` and `acknowledge`, `purchases.voidedpurchases.list` and `orders.refund`. |
| Pub/Sub push authentication | OIDC token claims (`iss`, `aud`, `email`, `email_verified`). |

developers.google.com and cloud.google.com could not be reached from the build environment,
so the Play Developer API reference pages and the Pub/Sub guide were checked through the
discovery document and search results. Re-read Google's Pub/Sub push authentication page
during setup.

## The server never trusts the device

- The verify endpoint accepts exactly `{productId, purchaseToken}`. Any other field, such as
  a claimed payment state, is refused (test: "refuses requests that try to report the
  payment result themselves").
- Payment state, product, quantity, test-purchase flag, refunds and the buyer's obfuscated
  account id all come from `getproductpurchasev2`. A purchase is granted only when Google
  says it is paid.
- The player id comes from a verified JWT, never from the request body.
- Notifications are hints: the server re-reads Google before acting on one.
- Only the server consumes and acknowledges, after the ledger transaction has committed.
  The Android client has no consume or acknowledge code (a unit test checks this).
- Wallet values on the device always come from the server.

## Results by requested case

All counts are tests that ran and passed. No test fails.

| # | Case | Server tests | Android tests | Result |
| --- | --- | --- | --- | --- |
| 1 | Invalid purchase tokens | `invalid-tokens.test.ts` (20): unknown, malformed and oversized tokens, path injection, other app, other product, unsold product, rentals, multi-item, bad quantities, license testers when not allowed | Malformed or unexpected server answers are never a grant (1) | Pass |
| 2 | Duplicate purchase requests | `duplicates.test.ts` (4): repeated requests, 25 identical concurrent requests, client and notification races, the same token sent to a second game | One request per token while in flight (1) | Pass |
| 3 | Replayed callbacks | `replayed-callbacks.test.ts` (22): redelivered and re-sent notifications, replay after refund, notification content ignored in favour of Google, plus 10 forged-push cases (wrong audience, account, issuer, expired, unsigned, unknown key, player token) | | Pass |
| 4 | Pending purchases | `pending-and-cancelled.test.ts` (7): no grant while pending, grant once on payment by notification, client retry or recheck job, recheck backoff | Pending is never shown as granted, recheck when it completes (2) | Pass |
| 5 | Cancelled purchases | `pending-and-cancelled.test.ts` (6): never granted, abandoned pending payments, lost cancel notification, late purchase notification, revocation of a granted purchase Google later cancels | Cancelled flows and billing errors (1) | Pass |
| 6 | Network failures | `network-failures.test.ts` (14): Google 500, 503, 429, connection reset and timeout; lost consume response; acknowledgement retries up to the three-day limit; database failure rollback; refund sync paging failure | Retries with bounded backoff, deferral and recovery on restore, unexpected client errors, timeouts, refused connections, redirects not followed (6) | Pass |
| 7 | App restarts during a transaction | `restarts.test.ts` (7): crash between grant and consume, connection killed mid-transaction, notification at a fresh instance, pending after restart, lock release on crash, concurrent migrations | Restore finishes unfinished purchases, skips finished ones, copes with Play being unavailable, and recovers `ITEM_ALREADY_OWNED` (4) | Pass |
| 8 | Duplicate currency grants | `duplicates.test.ts` (6): ledger idempotency keys, database constraint, all entry points at once, duplicated refund signals, idempotent spending | | Pass |
| 9 | Purchase ownership | `ownership.test.ts` (16): another player's purchase refused and logged, account ids per player and game, promo-code purchases claimed once, sign-in token checks | Account id fetched from the server for the billing flow, refusals are final and not retried (3) | Pass |
| 10 | Refunds and revoked purchases | `refunds.test.ts` (18): full and partial refunds, spent currency (negative balance, spending blocked), non-consumables, refund before grant, lost notifications found by the voided purchases sync, every page read, sync lock, chargeback reviews, refund policy for invalid purchases | Revoked purchase shows the reduced wallet (1) | Pass |

Other suites: `purchase-flow.test.ts` (8), `hardening.test.ts` (33: no tokens in logs, no
internal details in errors, body limit, rate limit, Google error classification,
configuration and catalog validation) and `jobs.test.ts` (2).

Totals from the local runs on 29 October 2026:

| Suite | Passed | Failed | Where |
| --- | --- | --- | --- |
| Server, PostgreSQL 16, Node.js 22 | 163 | 0 | Local; CI also runs Node.js 24 |
| Android `billing-core`, JDK 21 | 28 | 0 | Local and CI |
| Android `billing-play` | 3 | not run locally | CI only (needs the Android SDK and Google's Maven repository) |

The server suite was run five times in a row without a failure. `npm audit` found no known
vulnerabilities.

## Problems found and fixed

Severity: critical means a player could get items without paying or keep them after a
refund; high means a crash, a lost purchase or a grant in a state that must not grant;
medium means a wrong revocation, information exposure or a client that misbehaves; low is
operational.

| Severity | Problem | Fix | Regression test |
| --- | --- | --- | --- |
| Critical | A refund recorded before the purchase was granted (for example a refunded pending purchase, or a client that stayed offline) did not stop a later grant, so a refunded purchase could still be credited. | A fully refunded purchase is closed without a grant; a partly refunded one grants only the units that were kept. | "never grants a purchase whose refund arrived before the purchase itself", "does not grant units that were refunded before the grant" |
| High | A held purchase that the operator had already asked Google to refund could still be granted if the player retried after a policy change. | Purchases with a refund request are never granted. | "never grants a purchase after asking Google to refund it" |
| High | When the database connection dropped in the middle of a transaction, the PostgreSQL driver raised an unhandled error that stopped the whole server. | Error listeners on the pool and on every checked-out connection; broken connections are discarded. | "commits nothing when the database connection dies in the middle of the grant" (crashed the test run before the fix) |
| Medium | Refunding one of two purchases of the same non-consumable revoked the entitlement although the other purchase still paid for it. | The entitlement moves to the remaining purchase. | "keeps an entitlement that is still backed by a second, unrefunded purchase" |
| Medium | License-tester purchases, which cost nothing, were granted by default. | `ALLOW_TEST_PURCHASES` now defaults to false. | "rejects license-tester purchases when test purchases are not allowed", "defaults to the safe policy" |
| Medium | Missing or broken service account credentials were reported as a temporary network problem, and the Google client library's error text, which contains the request URL with the purchase token, could reach the logs. | Reported as a configuration problem; library error text is never copied. | "treats a failure before any request was sent (no credentials) as a configuration problem", "never copies the client library message, which can contain the purchase token" |
| Medium | Android: a second check of the same purchase (for example pending, then paid) that arrived while the first check was running was dropped, so the player saw nothing until the next app start. | The newest copy is checked again after the running check. | "sends a token only once while it is in flight, then checks once more", "rechecks a pending purchase that completes while its first check is still in flight" |
| Medium | Android: an unexpected exception in the server client (for example from the sign-in token provider) escaped into the game's coroutine scope and could crash the game. | Treated like a network error; Google Play keeps the purchase for the next restore. | "treats an unexpected backend failure like a network error" |
| Low | Android: handling `ITEM_ALREADY_OWNED` held up every later billing result until the server answered. | Unfinished purchases are sent without blocking. | "keeps handling billing results while an already-owned purchase is being finished" |
| Low | `DATABASE_POOL_MAX=1` was accepted, which deadlocks the voided purchases sync. | The minimum is 2. | "rejects missing and invalid settings" |
| Low | `cli.js jobs --once` exited with 0 when a job failed, so a cron scheduler would not notice. | Exits with 1. | "keeps running after a job fails, and reports the failure for cron use" |

Three Android HTTP client tests were silently skipped by JUnit at first, because the test
functions returned a value. They now run and pass.

## Database transactions and idempotency

- Each state change of a purchase runs in one transaction that locks the purchase row
  (`SELECT ... FOR UPDATE`). Serialization failures and deadlocks are retried.
- Unique constraints make duplicates impossible even if the code were wrong: one row per
  `(package_name, purchase_token)`, one ledger row per `(game_id, idempotency_key,
  currency)`, one row per voided-purchase record, one row per Pub/Sub message id. A check
  constraint refuses a granted purchase without an owner, product, quantity and grant.
- Google is called outside database transactions. Consume and acknowledge happen after the
  commit, under a lease, so a crash between the two is finished later without granting
  twice.
- The voided purchases sync takes a PostgreSQL advisory lock, which is released if its
  instance dies, and only advances its checkpoint after a complete run.

These properties are exercised by the concurrency and crash tests under cases 2, 6, 7 and 8.

## Remaining risks and owner decisions

- **Invalid paid purchases are held, not refunded.** Google recommends refunding and
  revoking a purchase you will not fulfil. The default `REJECTED_PURCHASE_POLICY=hold`
  leaves it unacknowledged instead, so Google refunds it automatically after three days.
  `refund` follows Google's recommendation but moves money automatically. The owner should
  choose before launch.
- **Purchases without an account id** (promo codes redeemed in the Play Store) go to the
  first signed-in player who submits the token, unless `REQUIRE_OBFUSCATED_ACCOUNT_ID=true`.
  Tokens are only given to the buying device, so this needs a leaked token to abuse.
- **Spent currency can go negative after a refund.** Spending is then blocked; the game
  should show this clearly.
- **Chargeback reviews are not automated.** The server logs them for a person, who has 24
  hours to respond.
- **Rate limiting is per server instance.** Several instances multiply the limit.
- **Subscriptions are not supported.** Their notifications are logged and ignored.
- **The fake Google API is only as accurate as the documentation.** Differences from the
  real service (for example how test purchases or partial refunds are reported) would only
  show up in the manual tests.
- **GitHub Actions are pinned to major versions, not commit hashes.** Pinning to hashes is
  stronger against a compromised action.

## Not verified

- Real Google Play purchases, refunds and notifications, real Google-signed push tokens and
  real sign-in tokens.
- `billing-play` on a device or emulator with the Play Store.
- Load beyond 25 concurrent requests for one purchase.
- Hosting security (TLS, secret storage, database access), which depends on where the
  server is deployed.

## Required external configuration

See [PLAY_CONSOLE_SETUP.md](PLAY_CONSOLE_SETUP.md): Play Console app, products and license
testers; a service account with Play Console permissions; a Pub/Sub topic and authenticated
push subscription with notifications enabled; a sign-in provider; HTTPS hosting with
PostgreSQL; and the launch decisions on test purchases, invalid purchases and account ids.
