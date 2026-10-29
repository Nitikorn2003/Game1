# External setup and launch checklist

Everything here happens outside the repository and needs a person with access to the Google
Play Console and a Google Cloud project. Nothing in this list has been done yet. Use license
testers and test payment methods only until every manual test below has passed.

Google moves these screens around; if a step does not match what you see, follow the current
page named in brackets.

## 1. Google Play Console

1. Create the app. Its package name must equal `packageName` in the server catalog.
2. Upload a build that includes Google Play Billing Library 9.1.0 to the internal testing
   track (for Lodelings, `games/lodelings/ANDROID.md` explains the build). Play Console only
   lets you create products once a build with the billing library is uploaded.
3. Create the one-time products under Monetize with Play, Products, One-time products. The
   product ids must match the catalog exactly (`gems_100`, `remove_ads`, ...). Give each one
   a "buy" purchase option. The server refuses rentals.
4. Add license testers under Settings, License testing, and add the same accounts to the
   internal testing track. License testers can pay with test cards that always approve,
   always decline, or approve or decline after a few minutes (the slow cards produce
   pending purchases). [Test your Google Play Billing Library integration]

## 2. Service account for the Play Developer API

1. In a Google Cloud project, enable the Google Play Android Developer API.
2. Create a service account for the server. Prefer workload identity on your hosting
   platform; if you must use a key file, store it in the platform's secret store and point
   `GOOGLE_APPLICATION_CREDENTIALS` at it. Never commit it.
3. In Play Console, Users and permissions, invite the service account's email and give it,
   for this app, "View financial data, orders, and cancellation survey responses" and
   "Manage orders and subscriptions". [Getting started with the Google Play Developer API]

If the server logs "Google Play Developer API rejected the service account", this step is
incomplete. Permission changes can take a while to apply.

## 3. Real-time developer notifications

1. In the same Cloud project, create a Pub/Sub topic, for example `play-rtdn`.
2. Grant `google-play-developer-notifications@system.gserviceaccount.com` the Pub/Sub
   Publisher role on that topic.
3. Create a push subscription on the topic:
   - endpoint: `https://<your server>/v1/rtdn/google-play`
   - authentication enabled, with a dedicated service account; put its email in
     `RTDN_PUSH_SERVICE_ACCOUNT`
   - audience: the endpoint URL, also set as `RTDN_PUSH_AUDIENCE`
   - put the subscription's full name in `RTDN_EXPECTED_SUBSCRIPTION`
   - retry policy: exponential backoff

   For projects created before 8 April 2021, Google's push authentication guide also asks
   you to grant the Pub/Sub service agent the Service Account Token Creator role on that
   service account. [Pub/Sub: Authentication for push subscriptions]
4. In Play Console, Monetize with Play, Monetization setup, enter the topic
   (`projects/<project>/topics/play-rtdn`) and choose to receive notifications for voided
   purchases and all one-time products, not only subscriptions. Press "Send test
   notification"; the server answers it and logs it. [Real-time developer notifications reference]

## 4. Player sign-in

The server accepts any OpenID Connect or JWT issuer. For Firebase Authentication:

```
AUTH_JWKS_URL=https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
AUTH_ISSUER=https://securetoken.google.com/<firebase project id>
AUTH_AUDIENCE=<firebase project id>
FIREBASE_PROJECT_ID=<firebase project id>
```

With `FIREBASE_PROJECT_ID` set, deleting a player in the game also deletes their Firebase
account from the server. Give the server's service account the **Firebase Authentication
Admin** role (`roles/firebaseauth.admin`) in the Firebase project's IAM page in the Google
Cloud console, and make sure the Identity Toolkit API is enabled there (Firebase enables it
when Authentication is turned on).

In Firebase Authentication, turn on the **Anonymous** and **Google** sign-in providers: every
player starts as a guest and can link Google later.

The Android client passes the current ID token through `HttpPurchaseBackend(sessionToken = ...)`.
In the games, the Game1Billing plugin (`packages/capacitor-billing`) does this with the token
the game hands it.

## 5. Hosting

- An HTTPS endpoint that Pub/Sub can reach, a PostgreSQL database with backups (the ledger
  is the record of what each player owns), and the environment variables from
  `services/iap-server/.env.example`.
- Run `node dist/cli.js migrate` before the first start.
- Alert on these log messages (logs never contain purchase or session tokens):

  | Message starts with | Why |
  | --- | --- |
  | `Google Play Developer API rejected the service account` | Step 2 is incomplete; no purchase can be verified. |
  | `chargeback review requested` | A person must respond in Play Console within 24 hours. |
  | `gave up acknowledging a granted purchase` | Google will refund it after three days; the voided sync then claws it back. |
  | `paid purchase rejected` | A paid purchase was not granted (for example a product missing from the catalog). Fix the cause, or refund it with `cli.js refund-rejected`. |
  | `purchase submitted by a player who did not make it` | Someone tried to claim another player's purchase. |
  | `background job failed` or `voided purchases backlog exceeds one run` | Refunds or retries are falling behind. |

## 6. Manual tests with license testers

Run these on a real device with a license tester account and record the result before
launch. Each one repeats one of the automated cases against the real Google Play.

| # | Case | Steps | Expected |
| --- | --- | --- | --- |
| 1 | Successful purchase | Buy `gems_100` with the always-approves card. | Balance +100 once. The purchase can be bought again (it was consumed). Server log shows granted, then consumed. |
| 2 | Non-consumable | Buy `remove_ads`. | Entitlement active. Order shows acknowledged. Buying again says already owned. |
| 3 | Declined payment | Buy with the always-declines card. | `BillingError` or `UserCanceled`, nothing granted, nothing recorded as paid. |
| 4 | Pending, then paid | Buy with the slow card that approves. | `Pending` first, no gems. Gems arrive once after approval (notification or next app start). |
| 5 | Pending, then cancelled | Buy with the slow card that declines. | `Pending`, then cancelled. Nothing granted. |
| 6 | Cancelled flow | Close the purchase screen. | `UserCanceled`, no server call. |
| 7 | Network failure | Turn on airplane mode right after paying. | `Deferred`. After reconnecting and reopening the app, gems arrive once. |
| 8 | App restart mid-transaction | Kill the app as soon as the payment sheet closes. | On the next start, `restore()` grants once (`newlyGranted` true), never twice. |
| 9 | Duplicate and replayed requests | Reopen the app several times after a purchase; in Pub/Sub, redeliver the purchase message (seek the subscription back). | Balance unchanged after the first grant. |
| 10 | Ownership | Sign in as player B on the same device and reopen the app after player A's purchase. | Player B gets nothing. The server logs the refused attempt if one is made. |
| 11 | Invalid token | Send a made-up token to the verify endpoint with a valid session. | HTTP 422 `invalid_purchase_token`, nothing stored. |
| 12 | Refund | Refund a test order in Play Console (Order management) with "revoke". | Gems clawed back once (balance may go negative); `remove_ads` refund revokes the entitlement. |

## 7. Before launch

- Set `ALLOW_TEST_PURCHASES=false`, unless license-tester purchases should grant real items.
- Decide `REJECTED_PURCHASE_POLICY`. Google recommends refunding and revoking purchases you
  will not fulfil (`refund`); the default `hold` lets Google refund them automatically after
  three days.
- Decide `REQUIRE_OBFUSCATED_ACCOUNT_ID`. With `false`, purchases without an account id
  (promo codes redeemed in the Play Store) go to the first signed-in player who claims them.
- Make sure every manual test above passed.
