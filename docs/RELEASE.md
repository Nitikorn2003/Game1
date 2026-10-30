# Releasing a game on Google Play

These are the steps every Game1 game goes through. Each game's own `RELEASE.md`
([Lodelings](../games/lodelings/RELEASE.md), [Quilt Nook](../games/quiltnook/RELEASE.md),
[Sky Jars](../games/skyjars/RELEASE.md), [Lotus Canal](../games/lotuscanal/RELEASE.md),
[Rice Field Art](../games/ricefield/RELEASE.md), [Tide Garden](../games/tidegarden/RELEASE.md),
[Bloom Hive](../games/bloomhive/RELEASE.md), [Crumb Lane](../games/crumblane/RELEASE.md)) has
its answers: its name and category, what each edition sells, what to play through before an
upload, and the facts for its content rating.
Below, `<game>` is the game's folder name under `games/`.

Everything the store asks for is made from the game's code and kept in step with it:

```sh
npx tsx tools/store-assets.ts games/<game> store screens
```

That writes `games/<game>/store/out/` (git ignores it): `play-icon.png`, `privacy.html`, and
for each language (`en`, `th`) `feature-graphic.jpg`, the phone screenshots, `listing.txt` and
`listing-ads-only.txt`. The listing text is checked against Play Console's length limits and
its banned words (the game's `test/listing.test.ts`). Building the app itself is in the
game's `ANDROID.md`.

**Status:** no game has been uploaded and no Android build has been made yet. These steps
were checked against Google's published rules on 29 October 2026. Google changes Play
Console often; where a screen differs, follow the help link Play Console shows next to it.

## Pick the edition for the first release

| | Ads only | Full |
| --- | --- | --- |
| Players get | rewarded ads and ad breaks; everything else earned by playing | the same, plus the game's in-app products, cloud saves and Google sign-in |
| You set up | Play Console and AdMob | also Firebase, a hosted purchase server with PostgreSQL, a Google Cloud service account and Pub/Sub ([setup](iap/PLAY_CONSOLE_SETUP.md)) |
| Running cost | none | the server and its database (Google Cloud asks for a billing account even for its free tier); one server serves every game |
| Build settings | AdMob ids only; no `VITE_IAP_SERVER_URL`, no `google-services.json` | everything in the game's ANDROID.md, section 2 |
| Store text | `listing-ads-only.txt` | `listing.txt` |

Recommendation: start with **ads only**, and switch to the full edition in an update once the
server runs. Saves live on the phone in both editions, so players keep their progress when
the update adds sign-in. When you switch, replace the store text with `listing.txt`, create
the in-app products, and update the Data safety and content rating answers below.

## 1. Accounts and decisions only you can make

1. **Google Play developer account** at [play.google.com/console](https://play.google.com/console).
   The fee is US$25, once, for the account, and every game goes into the same account. Google
   verifies your identity with a government ID. A personal account created after 13 November 2023 must run a closed test
   with at least 12 testers for 14 days in a row before it can publish an app to production
   (step 5). Google's help describes it as a test "for your app", so plan one for every game.
   Organization accounts skip that test but need a D-U-N-S number.
2. **The app id** (`applicationId` in the game's `android/release.properties`), for example
   `com.yourname.<game>`. It can never change after the first upload.
3. **A public contact e-mail.** Google shows it on the store page. Put it in
   `CONTACT_EMAIL` in `packages/shell/src/privacy.ts` (every game's policy then names it),
   rebuild the store files, and use the same address in Play Console.
4. **Your public details.** Play Console shows your developer name on the store page. For
   developers who sell in-app items, it can also show the address and phone number from your
   payments profile (for example in EU countries, under the Digital Services Act). Read what
   Play Console says it will publish, and use a business address if you don't want your home
   address shown.
5. **A website** for the privacy policies and AdMob's `app-ads.txt`. Any free static host with
   HTTPS works; see step 2.
6. **AdMob account** at [admob.google.com](https://admob.google.com), with your payment and
   tax details. One account serves every game.

## 2. Publish the privacy policy and app-ads.txt

Upload each game's `store/out/privacy.html` into a folder named after the game, and one
`app-ads.txt` file to the root of your website: for example
`https://<you>.github.io/<game>/privacy.html` and `https://<you>.github.io/app-ads.txt`.

- `app-ads.txt` holds one line that AdMob shows you under Apps, View all apps, app-ads.txt
  (it looks like `google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0`). The same line
  covers every game in your AdMob account. AdMob looks for it at the root of the website you
  list in Play Console, so a subfolder does not work.
- On GitHub Pages, a repository named `<your GitHub user>.github.io` publishes at that root.
  Pages builds run on GitHub Actions, so the billing lock on your GitHub account may stop
  them; Firebase Hosting's free plan is another option.
- The account deletion link in Play Console is `https://<your site>/<game>/privacy.html#en-deleting`.
  It explains how to delete an account in the app or by e-mail, which is what Google asks for.
  Deletion requests by e-mail are handled with the purchase server's `delete-player` command.

Republish every game's `privacy.html` whenever the policy in `packages/shell/src/privacy.ts`
changes.

## 3. Build and upload

1. Make the release build: the game's ANDROID.md, section 3
   (`npm run android:bundle -w games/<game>`). Games target Android 16 (API 36), which Google
   Play requires for new apps and updates since 31 August 2026.
2. In Play Console, **Create app**: the name from the game's RELEASE.md, default language
   English (United States), **Game**, **Free**. A free app can never become paid.
3. Testing, **Internal testing**: create a release, upload `app-release.aab`, and add your own
   Google account as a tester. Play App Signing is on by default; keep it.
4. Install from the internal test link and play through the game's checklist in its
   RELEASE.md. With your ad unit ids set, the build shows real ads: add your phone under
   AdMob, Settings, Test devices first, and never tap your own live ads.
5. Full edition only: add the in-app products (Monetize with Play, Products, One-time
   products). The ids, names and descriptions are at the end of `listing.txt`; the prices are
   yours to set (the browser version shows placeholder prices). Then run the purchase tests
   with license testers in [PLAY_CONSOLE_SETUP.md](iap/PLAY_CONSOLE_SETUP.md), section 6.

## 4. App content (Policy and programs, App content)

| Question | Answer |
| --- | --- |
| Privacy policy | `https://<your site>/<game>/privacy.html` |
| App access | All functionality is available without special access. Google sign-in is optional. |
| Ads | Yes, the app contains ads. |
| Advertising ID | Yes. Purposes: advertising or marketing, analytics, fraud prevention, security and compliance. The AdMob SDK adds the `AD_ID` permission to the app; after the first build, check that `com.google.android.gms.permission.AD_ID` is in the merged manifest (Android Studio, `AndroidManifest.xml`, Merged Manifest tab). |
| Target audience | 13 to 15, 16 to 17, and 18 and over. The games are not made for children under 13. If Google decides the store page appeals to children, it asks for the Families policy (an age question and child-directed ads); that needs a code change. |
| News app, government app, financial features, health | No, none. |
| Account deletion (full edition) | Players can create accounts. Delete account link: `https://<your site>/<game>/privacy.html#en-deleting`. |
| Content rating | Answer the IARC questionnaire (category: Game) yourself, honestly, from the facts in the game's RELEASE.md. |
| Data safety | See below. |

### Data safety

Every game has the same SDKs and keeps the same data. Before filling this in, open Google's
own disclosure pages for the SDKs, because they change with SDK versions: the Google Mobile Ads
SDK ([AdMob](https://developers.google.com/admob/android/privacy/play-data-disclosure); the
games use version 25.4 through `@capacitor-community/admob` 8.2.1) and, in the full edition,
Firebase Authentication ([Firebase](https://firebase.google.com/docs/android/play-data-disclosure);
`firebase-auth` 24.0.1). Use their answers for what each SDK collects and whether it counts as
shared. What the games themselves do:

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
- All data is encrypted in transit: the apps only talk to https addresses.
- Players can ask for deletion (full edition): in the app (Settings, Delete account and
  data) and by e-mail. The ads-only edition keeps nothing on a server.
- Nothing in the browser version applies; it is not on Google Play.

## 5. Store listing and the closed test

1. **Main store listing**: copy the title, short description and full description from
   `store/out/en/listing-ads-only.txt` (or `listing.txt` for the full edition). App icon
   `play-icon.png`, feature graphic `en/feature-graphic.jpg`, and the phone screenshots in
   `en/screenshots/`, in the order of their numbers.
2. **Add a translation**: Thai (`th`), with the text, feature graphic and screenshots from
   `store/out/th/`.
3. **Store settings**: the category from the game's RELEASE.md; contact e-mail; website (the
   one with `app-ads.txt`).
4. **Countries**: all, or the ones you choose; the game's RELEASE.md says where one may need
   leaving out.
5. **Closed testing** (new personal accounts): create a closed track, upload the same bundle,
   and add at least 12 testers by Google account e-mail or Google Group. They join through the
   opt-in link and install from Google Play. Keep at least 12 opted in for 14 days in a row;
   Google may also check that they really play. Play Console's dashboard shows the count and
   the days. The same testers can test every game.
6. **Apply for production** from the dashboard once the test is done. Google asks how the
   test went and reviews the application, which can take about a week.
7. **Production release**: start with a staged rollout (for example 20%) and widen it while
   the crash rate stays low.

## 6. After the release

- In AdMob, link the app to its Google Play listing, then check that the app-ads.txt status
  turns to found and the app passes review. New AdMob apps can serve few ads at first.
- Each update: bump `version` in the game's `package.json`, `npm run android:bundle -w games/<game>`,
  upload through internal testing first.
- Once a year: Google raises the required target API level each August. Raise
  `targetSdkVersion` in every game's `android/variables.gradle`, then test and release
  before the deadline.
- Watch Android vitals (crashes, ANRs) and reviews in Play Console. If ads or purchases
  change, review this page, the Data safety answers and `packages/shell/src/privacy.ts` together.
