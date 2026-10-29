# Releasing Lodelings on Google Play

Everything the store asks for is made from the game's code and kept in step with it:

```sh
npx tsx tools/store-assets.ts games/lodelings store screens
```

That writes `store/out/` (git ignores it): `play-icon.png`, `privacy.html`, and for each
language (`en`, `th`) `feature-graphic.jpg`, six phone screenshots, `listing.txt` and
`listing-ads-only.txt`. The listing text is checked against Play Console's length limits and
its banned words (`test/listing.test.ts`). Building the app itself is in [ANDROID.md](ANDROID.md).

**Status:** nothing has been uploaded and no Android build has been made yet. These steps
were checked against Google's published rules on 29 October 2026. Google changes Play
Console often; where a screen differs, follow the help link Play Console shows next to it.

## Pick the edition for the first release

| | Ads only | Full |
| --- | --- | --- |
| Players get | rewarded ads and ad breaks; gems, eggs and everything else earned by playing | the same, plus gem packs, Starter Pack, No Ad Breaks, Ore Doubler, cloud saves and Google sign-in |
| You set up | Play Console and AdMob | also Firebase, a hosted purchase server with PostgreSQL, a Google Cloud service account and Pub/Sub ([setup](../../docs/iap/PLAY_CONSOLE_SETUP.md)) |
| Running cost | none | the server and its database (Google Cloud asks for a billing account even for its free tier) |
| Build settings | AdMob ids only; no `VITE_IAP_SERVER_URL`, no `google-services.json` | everything in ANDROID.md, section 2 |
| Store text | `listing-ads-only.txt` | `listing.txt` |

Recommendation: start with **ads only**, and switch to the full edition in an update once the
server runs. Saves live on the phone in both editions, so players keep their progress when
the update adds sign-in. When you switch, replace the store text with `listing.txt`, create
the in-app products, and update the Data safety and content rating answers below.

## 1. Accounts and decisions only you can make

1. **Google Play developer account** at [play.google.com/console](https://play.google.com/console).
   The fee is US$25, once. Google verifies your identity with a government ID. A personal
   account created after 13 November 2023 must run a closed test with at least 12 testers for
   14 days in a row before it can publish to production (step 5). Organization accounts skip
   that test but need a D-U-N-S number.
2. **The app id** (`applicationId` in `android/release.properties`), for example
   `com.yourname.lodelings`. It can never change after the first upload.
3. **A public contact e-mail.** Google shows it on the store page. Put it in
   `CONTACT_EMAIL` in `packages/shell/src/privacy.ts` (every game's policy then names it),
   rebuild the store files, and use the same address in Play Console.
4. **Your public details.** Play Console shows your developer name on the store page. For
   developers who sell in-app items, it can also show the address and phone number from your
   payments profile (for example in EU countries, under the Digital Services Act). Read what
   Play Console says it will publish, and use a business address if you don't want your home
   address shown.
5. **A website** for the privacy policy and AdMob's `app-ads.txt`. Any free static host with
   HTTPS works; see step 2.
6. **AdMob account** at [admob.google.com](https://admob.google.com), with your payment and
   tax details.

## 2. Publish the privacy policy and app-ads.txt

Upload `store/out/privacy.html` and an `app-ads.txt` file to the root of your website, for
example `https://<you>.github.io/privacy.html` and `https://<you>.github.io/app-ads.txt`.

- `app-ads.txt` holds one line that AdMob shows you under Apps, View all apps, app-ads.txt
  (it looks like `google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0`). AdMob looks for
  it at the root of the website you list in Play Console, so a subfolder does not work.
- On GitHub Pages, a repository named `<your GitHub user>.github.io` publishes at that root.
  Pages builds run on GitHub Actions, so the billing lock on your GitHub account may stop
  them; Firebase Hosting's free plan is another option.
- The account deletion link in Play Console is `https://<your site>/privacy.html#en-deleting`.
  It explains how to delete an account in the app or by e-mail, which is what Google asks for.
  Deletion requests by e-mail are handled with the server's `delete-player` command.

Republish `privacy.html` whenever the policy in `packages/shell/src/privacy.ts` changes.

## 3. Build and upload

1. Make the release build: [ANDROID.md](ANDROID.md), section 3 (`npm run android:bundle -w games/lodelings`).
   The app targets Android 16 (API 36), which Google Play requires for new apps and updates
   since 31 August 2026.
2. In Play Console, **Create app**: name `Lodelings: Idle Mining RPG`, default language
   English (United States), **Game**, **Free**. A free app can never become paid.
3. Testing, **Internal testing**: create a release, upload `app-release.aab`, and add your own
   Google account as a tester. Play App Signing is on by default; keep it.
4. Install from the internal test link and play: the first Guardian, a rewarded ad, an ad
   break (they start once you have reached depth 12, after the first five minutes of a
   session), leaving the app and coming back (offline progress), the back button, switching
   to Thai. With your ad unit ids set, the build shows real ads: add your phone under AdMob,
   Settings, Test devices first, and never tap your own live ads.
5. Full edition only: add the in-app products (Monetize with Play, Products, One-time
   products). The ids, names and descriptions are at the end of `listing.txt`; the prices are
   yours to set (the browser version shows $0.99 to $19.99 as placeholders). Then run the
   purchase tests with license testers in [PLAY_CONSOLE_SETUP.md](../../docs/iap/PLAY_CONSOLE_SETUP.md),
   section 6.

## 4. App content (Policy and programs, App content)

| Question | Answer |
| --- | --- |
| Privacy policy | `https://<your site>/privacy.html` |
| App access | All functionality is available without special access. Google sign-in is optional. |
| Ads | Yes, the app contains ads. |
| Advertising ID | Yes. Purposes: advertising or marketing, analytics, fraud prevention, security and compliance. The AdMob SDK adds the `AD_ID` permission to the app; after the first build, check that `com.google.android.gms.permission.AD_ID` is in the merged manifest (Android Studio, `AndroidManifest.xml`, Merged Manifest tab). |
| Target audience | 13 to 15, 16 to 17, and 18 and over. The game is not made for children under 13. If Google decides the store page appeals to children, it asks for the Families policy (an age question and child-directed ads); that needs a code change. |
| News app, government app, financial features, health | No, none. |
| Account deletion (full edition) | Players can create accounts. Delete account link: `https://<your site>/privacy.html#en-deleting`. |
| Content rating | See below. |
| Data safety | See below. |

### Content rating (IARC questionnaire)

Category: Game. Answer the questions yourself, honestly; these are the facts to answer from:

- Violence: players break rocks and beat stone Guardians by mining down their health bar.
  There are damage numbers, no blood, no injury, and no people or real animals are hurt.
- No fear, sexual content, bad language, drugs, alcohol, tobacco or crude humour.
- No gambling: nothing can be won or cashed out.
- Players cannot talk to each other or share content. The app does not share their location.
- Full edition: yes, in-app purchases of digital goods, **including random items**. Eggs hatch
  a random Lodeling, eggs cost gems, gems can be bought, and the Starter Pack contains a Prism
  Egg. The game shows the odds before every egg purchase. This adds the "In-game purchases
  (includes random items)" notice. In Australia, paid random items lead to an M rating or
  higher.
- Ads-only edition: no purchases.

### Data safety

Before filling this in, open Google's own disclosure pages for the SDKs in the app, because
they change with SDK versions: the Google Mobile Ads SDK
([AdMob](https://developers.google.com/admob/android/privacy/play-data-disclosure); this app
uses version 25.4 through `@capacitor-community/admob` 8.2.1) and, in the full edition,
Firebase Authentication ([Firebase](https://firebase.google.com/docs/android/play-data-disclosure);
`firebase-auth` 24.0.1). Use their answers for what each SDK collects and whether it counts as
shared. What the game itself does:

| Data type in the form | Edition | Collected by | Purpose | Optional for the player |
| --- | --- | --- | --- | --- |
| Location: approximate location | both | AdMob, from the IP address | advertising or marketing, analytics, fraud prevention | no |
| App activity: app interactions | both | AdMob (ad views and taps) | advertising or marketing, analytics | no |
| App info and performance: crash logs, diagnostics | both | AdMob (SDK performance) | analytics | no |
| Device or other IDs | both | AdMob (advertising ID, app set ID) | advertising or marketing, analytics, fraud prevention | no |
| Personal info: user IDs | full | Firebase Authentication and your purchase server (every player gets a guest account) | app functionality, account management | no |
| Personal info: email address | full | Firebase Authentication, only when the player links Google | account management | yes |
| Financial info: purchase history | full | your purchase server (product, order, purchase token) | app functionality, fraud prevention, security and compliance | yes |
| App activity: other actions (the game save) | full | your purchase server (cloud saves) | app functionality | no |

- Data your server holds is not shared with anyone and not sold. Nothing is processed
  ephemerally.
- All data is encrypted in transit: the app only talks to https addresses.
- Players can ask for deletion (full edition): in the app (Settings, Delete account and
  data) and by e-mail. The ads-only edition keeps nothing on a server.
- Nothing in the browser version applies; it is not on Google Play.

## 5. Store listing and the closed test

1. **Main store listing**: copy the title, short description and full description from
   `store/out/en/listing-ads-only.txt` (or `listing.txt` for the full edition). App icon
   `play-icon.png`, feature graphic `en/feature-graphic.jpg`, phone screenshots
   `en/screenshots/1-mine.jpg` to `6-relics.jpg` in that order.
2. **Add a translation**: Thai (`th`), with the text, feature graphic and screenshots from
   `store/out/th/`.
3. **Store settings**: category Games, Role Playing (or Casual); contact e-mail; website (the
   one with `app-ads.txt`).
4. **Countries**: all, or the ones you choose. For the full edition, consider leaving out
   Belgium, where the regulator treats paid random items as gambling.
5. **Closed testing** (new personal accounts): create a closed track, upload the same bundle,
   and add at least 12 testers by Google account e-mail or Google Group. They join through the
   opt-in link and install from Google Play. Keep at least 12 opted in for 14 days in a row;
   Google may also check that they really play. Play Console's dashboard shows the count and
   the days.
6. **Apply for production** from the dashboard once the test is done. Google asks how the
   test went and reviews the application, which can take about a week.
7. **Production release**: start with a staged rollout (for example 20%) and widen it while
   the crash rate stays low.

## 6. After the release

- In AdMob, link the app to its Google Play listing, then check that the app-ads.txt status
  turns to found and the app passes review. New AdMob apps can serve few ads at first.
- Each update: bump `version` in `package.json`, `npm run android:bundle -w games/lodelings`,
  upload through internal testing first.
- Once a year: Google raises the required target API level each August. Raise
  `targetSdkVersion` in `android/variables.gradle`, then test and release before the
  deadline.
- Watch Android vitals (crashes, ANRs) and reviews in Play Console. If ads or purchases
  change, review this page, the Data safety answers and `packages/shell/src/privacy.ts` together.
