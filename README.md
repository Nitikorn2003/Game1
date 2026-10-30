# Game1

Mobile games for Google Play, built on one shared framework, with ads (AdMob) and in-app
purchases verified on a server.

| Path | What it is |
| --- | --- |
| [`games/lodelings`](games/lodelings) | **Lodelings**, an idle mining RPG: tap through the Deep, hatch and level crystal creatures, beat a Guardian every five depths, resurface for relics. English and Thai. Browser version for testing, Android app through Capacitor. [Android build](games/lodelings/ANDROID.md), [Google Play release](games/lodelings/RELEASE.md). |
| [`games/quiltnook`](games/quiltnook) | **Quilt Nook**, a cozy block puzzle: drag fabric patches onto an 8 by 8 quilt, stitch full rows and columns into seams, keep a streak going, sew the daily quilt, fill commissions for spools and collect fabric sets. No timers, and nothing for sale is random. English and Thai. Made from the starter template. [Android build](games/quiltnook/ANDROID.md), [Google Play release](games/quiltnook/RELEASE.md). |
| [`games/skyjars`](games/skyjars) | **Sky Jars**, a calm colour sort puzzle under the night sky: pour starlight between glass jars until each holds one colour, with undo, restart, hints and an extra jar when a shelf gets hard. Every solved level lights a star of a 24-constellation sky atlas; a daily sky keeps a streak, and stardust buys jar styles and skies. Ten colours, each with its own symbol. English and Thai. Made from the starter template. [Android build](games/skyjars/ANDROID.md), [Google Play release](games/skyjars/RELEASE.md). |
| [`games/lotuscanal`](games/lotuscanal) | **Lotus Canal**, a peaks solitaire card game on a boat trip through a floating market: play face-up cards one rank higher or lower than the open card, with runs that pay bonus coins, undo, a lotus wild and five more cards when a deal gets hard. Every cleared level takes the boat one stop along twelve canals, each ending in a postcard; a daily deal keeps a streak, and coins buy card backs and scenes. Every deal can be cleared. English and Thai. Made from the starter template. [Android build](games/lotuscanal/ANDROID.md), [Google Play release](games/lotuscanal/RELEASE.md). |
| [`games/ricefield`](games/ricefield) | **Rice Field Art**, a picture logic puzzle (nonogram) set in the rice fields: read the numbers along each row and column, plant rice where it must go and pebble the cells that stay empty, tap by tap or by dragging along a line, and watch the picture grow in colour. 72 hand-made pictures in six albums, from 5 by 5 to 12 by 12, each one proven to need no guessing; three hearts per field, a free hint per field, and a daily pattern with a streak. Seeds buy scenes and markers. English and Thai. Made from the starter template. [Android build](games/ricefield/ANDROID.md), [Google Play release](games/ricefield/RELEASE.md). |
| [`games/tidegarden`](games/tidegarden) | **Tide Garden**, a match-three puzzle on a coral reef: swap pieces side by side to line up three or more, make waves, bubble bombs and pearls and swap them together for bigger splashes, wash away sand, cut pieces free of kelp, crack rocks and help baby turtles crawl down to the sea. 96 levels in eight zones, each bringing a sea creature home, then the open sea; three tools that take no move, five more moves when a dive runs out, and a daily dive with a streak. Every kind of piece has its own shape as well as its colour. Sand dollars buy tools, waters and buddies. English and Thai. Made from the starter template. [Android build](games/tidegarden/ANDROID.md), [Google Play release](games/tidegarden/RELEASE.md). |
| [`games/bloomhive`](games/bloomhive) | **Bloom Hive**, a bubble shooter in a flower meadow: Pip the bee aims pollen up at the buds hanging from a branch, with a dotted line that shows where it will stick and shots that bounce off the sides. Three or more of one colour pop and whatever hangs from them falls, freeing the baby bees inside; wax, honey, dandelion puffs and butterflies join zone by zone. 96 levels in eight zones, each making a flower bloom in Pip's garden, then the wild meadow; a nectar jar that fills into a bomb, three tools that take no pollen, five more pollen when a round runs out, and a daily meadow with a streak. Every colour of bud has its own mark. Honey buys tools, skies and hats. English and Thai. Made from the starter template. [Android build](games/bloomhive/ANDROID.md), [Google Play release](games/bloomhive/RELEASE.md). |
| [`games/crumblane`](games/crumblane) | **Crumb Lane**, a cozy tile-match puzzle on a lane of bakeries: tap pastries on a layered counter to put them on a tray of seven, where three of a kind box themselves up; a pastry under another, even under a corner of it, waits until the one on top is gone. Paper bags, stacks, ribbon boxes and sprinkled pastries join shop by shop. 96 levels in eight shops, each opening on the lane, then the late shift; every counter is dealt so it can be cleared with three stars. Three tools that take no place on the tray, room made on a full tray by sending three pastries up to a cooling rack, and a daily special with a streak. Every pastry is its own drawing. Sugar buys tools, tiles and seasons. English and Thai. Made from the starter template. [Android build](games/crumblane/ANDROID.md), [Google Play release](games/crumblane/RELEASE.md). |
| [`templates/starter`](templates/starter) | **Starter**, the smallest complete game (tap a coin, buy upgrades, a rewarded ad, two products), with its Android project, store files and tests. `tools/new-game.ts` copies it to start a new game: see [the framework](docs/FRAMEWORK.md). |
| [`packages/engine`](packages/engine) | Game-agnostic core: fixed-step loop, clocks, versioned saves with checksums, seeded random numbers, economy math, number formatting, daily resets, i18n. |
| [`packages/platform`](packages/platform) | Device services behind small interfaces: storage, ads (test ads, AdMob with Google's consent form), purchases (test store, Google Play through the purchase server), sign-in (Firebase), cloud saves, haptics. |
| [`packages/ui`](packages/ui) | Preact building blocks: buttons, panels, tabs, modals, toasts, the Android back button, and the store art renderer. |
| [`packages/shell`](packages/shell) | Everything around a game's gameplay: saving, purchases settled exactly once, rewarded ads and ad break rules, sign-in, cloud saves and account deletion, the settings and privacy screens, sound, start-up, and the browser and Android services. A game extends its `Session` with its own state, rules and screens. |
| [`packages/capacitor-billing`](packages/capacitor-billing) | The Capacitor plugin that connects a game's Android app to Google Play Billing. |
| [`services/iap-server`](services/iap-server) | Purchase server: verifies Google Play purchases, keeps an idempotent ledger, consumes and acknowledges purchases, takes back refunds, and stores cloud saves. Node.js, TypeScript, PostgreSQL. |
| [`clients/android`](clients/android) | The Android purchase client the billing plugin compiles in (Play Billing Library 9.1.0). Kotlin. |
| [`tools`](tools) | `new-game.ts` starts a game from the template; `store-assets.ts` draws a game's launcher icons, splash icon, store graphics and screenshots and writes its listing and privacy page; `gradlew.ts`, `inline-html.ts`, and the Lodelings balance scripts. |
| [`docs`](docs) | [How the framework fits together and how to make a new game](docs/FRAMEWORK.md), [releasing a game on Google Play](docs/RELEASE.md), the [security audit](docs/iap/SECURITY_AUDIT.md) of the purchase system and its [external setup checklist](docs/iap/PLAY_CONSOLE_SETUP.md). |

**Status: not released.** The games and the server are tested here (below), but no Android
build has been made yet, because this environment cannot download Google's Android
libraries, and no real Google Play purchase has gone through the server. The first Android
build runs on a computer with Android Studio or in CI. Publishing needs a Google Play
developer account and the steps in [docs/RELEASE.md](docs/RELEASE.md).

## Working on the games

Node.js 22 or later.

```sh
npm ci
npm run dev -w games/lodelings      # the browser version, with test ads and a test store
npm run dev -w games/quiltnook
npm run dev -w games/skyjars
npm run dev -w games/lotuscanal
npm run dev -w games/ricefield
npm run dev -w games/tidegarden
npm run dev -w games/bloomhive
npm run dev -w games/crumblane
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

# Android Play Billing adapter and the games' apps: need the Android SDK.
./gradlew :billing-play:assembleRelease :billing-play:testDebugUnitTest
npm run android:apk -w games/lodelings
npm run android:apk -w games/quiltnook
npm run android:apk -w games/skyjars
npm run android:apk -w games/lotuscanal
npm run android:apk -w games/ricefield
npm run android:apk -w games/tidegarden
npm run android:apk -w games/bloomhive
npm run android:apk -w games/crumblane
```

CI runs all of these on every pull request.

This repository is public. Never commit service account keys, `.env` files,
`google-services.json`, upload keys or their passwords, or real AdMob ids; the settings
files that hold them are git-ignored and have committed `.example` versions.
