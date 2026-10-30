# Lodelings for Android

The Android app is the web game in `dist/` inside a [Capacitor 8](https://capacitorjs.com)
shell. The game code is the same as in the browser; only the services differ
(`nativeServices` from `@game1/shell/native` instead of `src/browser.ts`, chosen in
`src/main.tsx`):

| Service | Browser version | Android app |
| --- | --- | --- |
| Ads | simulated, never pays | Google AdMob through `@capacitor-community/admob`, with Google's consent form (UMP) |
| Purchases | simulated, never charges | Google Play Billing through `@game1/capacitor-billing`, verified by the purchase server |
| Sign-in and cloud saves | none | Firebase Authentication (guest, then Google) through `@capacitor-firebase/authentication` |
| Back button | Escape closes the top screen | closes the top screen; on the main screen it sends the app to the background |

**Status: not built yet.** This environment cannot download Google's Android libraries, so
no APK has been built from this project. What was checked here: the web build, the unit and
browser tests, `cap sync`, and the billing plugin's Kotlin code, which was compiled with the
app's Kotlin version and tested on a plain JVM against stand-ins for the Android classes. The
first real build happens on your computer or in CI. Report anything that fails.

## What you need

- Node.js 22 or later, and `npm ci` run once at the repository root.
- [Android Studio](https://developer.android.com/studio). It brings the JDK (21), the Android
  SDK and the emulator. Open it once and let it install the SDK; accepting the Android SDK
  license is your decision.
- For a phone: developer options and USB debugging turned on, or use the emulator.

## 1. A first build, with no accounts

Nothing needs to be set up for this build. It shows Google's test ads and has no sign-in,
cloud saves or purchases (the shop offers only ad rewards).

```sh
npm run android:apk -w games/lodelings
```

This builds the web game, copies it into `android/` (`cap sync`) and runs Gradle. The APK is
`android/app/build/outputs/apk/debug/app-debug.apk`. Install it with Android Studio
(`npm run android:open -w games/lodelings`, then Run) or with
`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

Run `npm run android:sync -w games/lodelings` after every change to the game or to these
settings: Android Studio only sees what the last sync copied.

If Gradle says the SDK location is not found, create `android/local.properties` with
`sdk.dir=` and the SDK path from Android Studio's SDK Manager (on Windows escape the
backslashes, for example `sdk.dir=C\:\\Users\\you\\AppData\\Local\\Android\\Sdk`).

## 2. Connecting the real services

Each service is optional on its own: the app works without it and leaves that part out.
With only the AdMob settings, the app is the ads-only edition: its shop offers only ad
rewards, and it needs no server (see [docs/RELEASE.md](../../docs/RELEASE.md) for choosing an
edition).
Two files hold the settings, and git ignores both. Their committed `.example` files show
every setting.

| File | Holds |
| --- | --- |
| `games/lodelings/.env.production.local` (from `.env.example`) | purchase server URL, AdMob ad unit ids |
| `games/lodelings/android/release.properties` (from `release.properties.example`) | Google Play app id, AdMob app id, upload key |

### Choose the app id first

`applicationId` in `release.properties` is the app's permanent id on Google Play (for example
`com.yourstudio.lodelings`). It cannot change after the first upload, and the same id goes
into Firebase and into the purchase server's catalog (`packageName`). The default
`com.game1.lodelings` is only a placeholder.

### Upload key

Google Play signs the app it delivers with its own key (Play App Signing); you sign each
upload with an upload key. Make one with the `keytool` from Android Studio's JDK (on Windows
`"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"`):

```sh
keytool -genkeypair -v -keystore lodelings-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Keep the `.jks` file and its passwords outside the repository and back them up; a lost
upload key needs a reset request to Google. Put the path and passwords in `release.properties`.
Release builds refuse to run without them.

### Firebase (sign-in and cloud saves; purchases need it too)

1. Create a Firebase project and add an Android app with your `applicationId`.
2. Add the SHA-1 and SHA-256 fingerprints of every key that signs the app: the debug key
   (`cd android && ./gradlew signingReport`), your upload key, and the app signing key that
   Play Console shows under App integrity once the app exists there. Google sign-in fails
   without them.
3. In Authentication, turn on the **Anonymous** and **Google** providers.
4. Download `google-services.json` into `android/app/` and run `android:sync`. Sync adds the
   Firebase plugin only when this file is there.
5. Set up the purchase server's Firebase settings: see `docs/iap/PLAY_CONSOLE_SETUP.md`,
   section 4.

### Purchase server

Deploy `services/iap-server` (see its README and `docs/iap/PLAY_CONSOLE_SETUP.md`), add this
game to its catalog with `gameId` `lodelings` and your `applicationId` as `packageName`, and
set `VITE_IAP_SERVER_URL` in `.env.production.local`. Only https works. Sign-in, cloud saves
and purchases all need both the server and Firebase.

### AdMob

1. Add the app in AdMob and create one rewarded and one interstitial ad unit.
2. Put the AdMob app id in `release.properties` (`admobAppId`) and the two ad unit ids in
   `.env.production.local`. Until both unit ids are set the app requests test ads.
3. In AdMob, Privacy and messaging, publish a consent message for the EEA and UK. The app
   asks Google's consent SDK before it requests any ad.
4. Publish an `app-ads.txt` on the website listed in your Play Console store listing.

Never tap your own live ads. Use test devices (AdMob, Settings, Test devices) while testing.

## 3. A build for Google Play

Bump `version` in `games/lodelings/package.json` for every upload (`1.2.3` becomes version
code 1002003), then:

```sh
npm run android:bundle -w games/lodelings
```

The bundle is `android/app/build/outputs/bundle/release/app-release.aab`. Upload it to an
internal testing track first. A release build warns when it still uses Google's test AdMob
app id. [docs/RELEASE.md](../../docs/RELEASE.md) walks through Play Console from there, and
[RELEASE.md](RELEASE.md) has this game's answers for it.

## Icon and launch screen

The launcher icon (with its themed one-colour layer for Android 13 and later), the icons for
Android 7 and the launch screen icon are drawn from the game's own art in `store/art.tsx`:

```sh
npx tsx tools/store-assets.ts games/lodelings android
```

It writes the PNGs into `android/app/src/main/res/` for every screen density. Run it again
after changing the art and commit the result. Open `store/art.html` in the dev server
(`npm run dev -w games/lodelings`) to see every icon side by side; add `?guides` to see the
circle that every launcher shape keeps.

## Files in `android/`

`cap add android` made this project from Capacitor's template. Edited since:
`build.gradle` (one Kotlin version for every module), `variables.gradle` (Google sign-in),
`app/build.gradle` (app id, version, AdMob app id, signing), `app/src/main/AndroidManifest.xml`
(AdMob app id, vibration), `.gitignore`, and in `app/src/main/res/` the icons, the launch
screen (`drawable/splash.xml`, `values/colors.xml` and the launch theme in
`values/styles.xml`). `cap sync` rewrites `capacitor.settings.gradle` and
`app/capacitor.build.gradle` and fills the ignored `app/src/main/assets/`.
