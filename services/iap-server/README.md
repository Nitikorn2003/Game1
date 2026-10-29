# iap-server

Server-side verification of Google Play one-time purchases (consumable and non-consumable)
for one or more games. The game client never decides that a purchase was paid: it sends the
purchase token here, and this server asks the Google Play Developer API, credits the player's
ledger exactly once, and only then consumes or acknowledges the purchase with Google.
Refunds and revocations take back what was granted.

Subscriptions are not supported.

## How a purchase flows

1. The client asks `POST /v1/games/{gameId}/billing/account` for the player's obfuscated
   account id and passes it to `BillingFlowParams.Builder.setObfuscatedAccountId()`.
2. Google Play takes the payment and gives the client a purchase token.
3. The client sends `{productId, purchaseToken}` to `POST /v1/games/{gameId}/purchases/google-play`.
4. The server reads the purchase from Google (`purchases.productsv2.getproductpurchasev2`)
   and checks the package, product, quantity, payment state, test-purchase flag and the
   obfuscated account id against the signed-in player.
5. In one database transaction it records the purchase, writes the ledger entries (unique
   idempotency key per purchase and currency) or activates the entitlement.
6. After the commit it consumes (consumables) or acknowledges (non-consumables) the purchase.
   If that call fails, a background job retries it with backoff inside Google's three-day window.

Google also sends real-time developer notifications through Pub/Sub. They are only hints:
the server re-reads the purchase from Google before acting on one, so a replayed or forged
notification cannot grant anything.

| Situation | What happens |
| --- | --- |
| Payment pending (cash, slow card) | Recorded as `pending`, nothing granted. Granted when Google reports it paid (notification, client retry or the recheck job). |
| Purchase cancelled | Nothing granted. A granted purchase that Google later reports cancelled is revoked. |
| Full or partial refund, chargeback, revocation | Currency is clawed back (only the refunded units for a partial refund) or the entitlement revoked. The balance may go negative; spending is then blocked. |
| Lost notification | The recheck job (pending purchases) and the voided purchases sync (`purchases.voidedpurchases.list`, every 10 minutes) catch up. |
| Paid purchase that fails validation | Held by default: not granted and not acknowledged, so Google refunds it after three days. See `REJECTED_PURCHASE_POLICY`. |

## HTTP API

Player endpoints need `Authorization: Bearer <session token>` from the identity provider
configured in `AUTH_*` (for example a Firebase ID token). The player id always comes from the
verified token.

| Method and path | Answer |
| --- | --- |
| `POST /v1/games/{gameId}/billing/account` | `{"obfuscatedAccountId": "..."}`, a random id per player and game. |
| `POST /v1/games/{gameId}/purchases/google-play` | Body must be exactly `{"productId", "purchaseToken"}`. Answers `{"status", "productId", "quantity", "wallet"}` with status `granted`, `already_granted`, `pending`, `canceled` or `revoked`. |
| `GET /v1/games/{gameId}/wallet` | `{"balances": {...}, "entitlements": [...]}` |
| `POST /v1/rtdn/google-play` | Pub/Sub push endpoint. Needs Google's OIDC token for `RTDN_PUSH_SERVICE_ACCOUNT` and `RTDN_PUSH_AUDIENCE`. |
| `GET /healthz`, `GET /readyz` | Liveness, and readiness including the database. |

Errors are `{"error": {"code", "message", "retryable"}}`. When `retryable` is true (HTTP 429,
500, 503) the client must keep the purchase and try again later. Other codes are final:
`invalid_request` (400), `unauthorized` (401), `purchase_not_owned` (403), `unknown_game`
(404), `unknown_product`, `product_mismatch`, `invalid_purchase_token` and
`purchase_rejected` (422).

Spending currency is game logic and has no HTTP endpoint here. Call `spendCurrency()` from
`src/wallet/ledger.ts` in your own server code; it is idempotent per request id and refuses
to go below zero.

## Configuration

Everything is read from environment variables; see [`.env.example`](.env.example). Never
commit a real `.env` file or a service account key. The Play Developer API credentials come
from Application Default Credentials (workload identity, or `GOOGLE_APPLICATION_CREDENTIALS`
pointing at a key file outside the repository).

The product catalog is a JSON file (`IAP_CATALOG_PATH`), validated at start-up. See
[`config/catalog.example.json`](config/catalog.example.json). Product ids must match the
Play Console exactly.

Settings that change what gets granted:

| Variable | Default | Meaning |
| --- | --- | --- |
| `ALLOW_TEST_PURCHASES` | `false` | Grant purchases made by license testers. They cost nothing, so turn this on only while testing. |
| `REQUIRE_OBFUSCATED_ACCOUNT_ID` | `false` | Refuse purchases without an account id (for example promo codes redeemed in the Play Store). When false, the first signed-in player who claims such a purchase gets it. |
| `REJECTED_PURCHASE_POLICY` | `hold` | `hold` leaves an invalid paid purchase unacknowledged (Google refunds it after three days). `refund` refunds and revokes it at once through `orders.refund`, which is what Google recommends but moves money. |

External setup (Play Console, service account, Pub/Sub, identity provider) is described in
[docs/iap/PLAY_CONSOLE_SETUP.md](../../docs/iap/PLAY_CONSOLE_SETUP.md).

## Running

Requires Node.js 22 or later and PostgreSQL. CI tests Node.js 22 and 24 with PostgreSQL 16.

```sh
npm ci
npm run build
node dist/cli.js migrate          # or MIGRATE_ON_START=true
npm start
```

Background jobs (fulfillment retries, pending rechecks, voided purchases sync) run inside the
server unless `RUN_BACKGROUND_JOBS=false`. To run them from an external scheduler instead,
use `node dist/cli.js jobs --once`, which exits non-zero if a job failed. Several instances
can run at once: work is claimed with row locks and leases, and the voided purchases sync
takes an advisory lock.

`node dist/cli.js refund-rejected --purchase-id <id> --confirm` refunds and revokes one held
purchase. It moves real money and cannot be undone.

## Tests

The tests run against a real PostgreSQL database and a local fake of the Google Play
Developer API that follows the documented request and response formats. They never call
Google.

```sh
export TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/iap_test   # the name must contain "test"; it is wiped
npm test
npm run typecheck && npm run lint
```
