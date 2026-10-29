# The Game1 framework

Every Game1 game is a small web app (TypeScript and Preact) that runs in the browser for
testing and inside an Android app (Capacitor) for Google Play. Everything a game does not
need to do differently lives in shared packages, so a new game is mostly its own rules,
screens and art.

## What is shared

| Package | Gives a game |
| --- | --- |
| [`@game1/engine`](../packages/engine) | A fixed-step game loop and clocks (a manual one for tests), versioned saves with checksums and two slots (a damaged save falls back to the previous one), seeded random numbers, economy math, number and time formatting, daily resets, translations. No browser or Android code. |
| [`@game1/platform`](../packages/platform) | Small interfaces for storage, ads, purchases, sign-in, cloud saves and vibration, each with a browser test version (test ads with a countdown, a test store that never charges) and an Android version (AdMob with Google's consent form, Google Play Billing through the purchase server, Firebase sign-in). |
| [`@game1/shell`](../packages/shell) | Everything around the gameplay. A game's `Game` class extends its `Session`, which saves (when the game asks, every 15 seconds, and when the app goes to the background), delivers each purchase exactly once even if the app dies mid-purchase, keeps the daily limits of rewarded ads and the rules for ad breaks, syncs the save to the cloud, and handles sign-in and account deletion. Also the settings and privacy screens, the privacy policy, sound effects made with Web Audio, the shared strings in English and Thai, and start-up. `@game1/shell/testing` has a fake ad network and the helpers the games' tests use. |
| [`@game1/ui`](../packages/ui) | Buttons, modals, tabs, toasts, toggles, progress bars, the Android back button, the `--g1-*` theme variables, and the renderer that draws launcher icons and store graphics from a game's SVG art. |
| [`@game1/capacitor-billing`](../packages/capacitor-billing) | The Android plugin between the app and Google Play Billing. |
| [`services/iap-server`](../services/iap-server) | One purchase server for every game: it verifies purchases with Google, keeps the ledger, takes back refunds and stores cloud saves. Each game is an entry in its catalog. |
| [`tools`](../tools) | `new-game.ts` starts a game from the template; `store-assets.ts` draws a game's icons, store graphics and screenshots and writes its listing and privacy page; `inline-html.ts` packs a one-file test build. |

The shell's rules apply to every game alike: rewarded ads are always the player's choice and
pay only when the ad network confirms them; ad breaks never come in the first five minutes
of a session, at most one every five minutes and ten a day, never right after a rewarded ad,
and only once the game says the player is well into it; No Ad Breaks (`remove_ads`) turns ad
breaks off and gives rewards without ads.

## What a game has

```
games/<id>/
  src/sim/state.ts    what is saved, and how a damaged save is read back safely
  src/sim/rules.ts    the rules, as plain functions of the state (no screens, no clock)
  src/game.ts         the Game class: actions for the screens, and the answers the shell asks for
  src/catalog.ts      the in-app products and what each grants
  src/i18n/           every string, in English and Thai
  src/ui/             the screens
  src/styles.css      the look, starting from the --g1-* theme variables
  src/audio.ts        the sound effects
  store/              listing text, screenshots and icon art for Google Play
  test/ and e2e/      unit tests, and play tests in a phone-sized browser
  android/            the Android project (Capacitor)
  ANDROID.md          building the app; RELEASE.md, the game's answers for Google Play
```

A game's `Game` class answers what the shell asks: a new state, the progress that decides
which save wins when two devices changed it, how to add what a purchase grants, which
entitlements it knows, whether a rewarded ad is on offer and what it gives, and when ad
breaks may start. Everything else (saving, purchases, ads, accounts) it calls from the shell.

## Making a new game

```sh
npx tsx tools/new-game.ts <id> "<Name>"     # for example: pondlife "Pond Life"
npm install
npm test && npm run e2e -w games/<id>
```

The tool copies [`templates/starter`](../templates/starter), the smallest complete game (tap a
coin, buy upgrades, one rewarded ad, two products), to `games/<id>` and puts the game's id and
name everywhere the template has its own: the npm package, the Android app and its Java
package, the save format, the storage prefix and the store text. It gives the game its own
port for the play tests and adds it to the purchase server's example catalog. The copy builds
and passes the template's tests before anything else changes. [Quilt Nook](../games/quiltnook)
started this way.

Then make it the new game, in this order:

1. **Rules and state:** `src/sim/state.ts` and `src/sim/rules.ts`, with unit tests in
   `test/`. Keep the rules free of screens and of the clock, so they can be tested and
   balanced on their own.
2. **The Game class:** `src/game.ts`, the actions the screens call and the shell's answers.
3. **Products and ads:** `src/catalog.ts` and the game's entry in
   `services/iap-server/config/catalog.example.json` (`test/catalog.test.ts` checks that they
   agree), the ad placements in `state.ts` and their limits in `rules.ts`.
4. **Screens, look and sound:** `src/ui/`, `src/styles.css`, `src/audio.ts`, the colours in
   `index.html`, `capacitor.config.ts` (`backgroundColor`) and
   `android/app/src/main/res/values/colors.xml`, and the font in `src/fonts.css`.
5. **Strings:** `src/i18n/en.ts` and `th.ts`; `test/i18n.test.ts` finds missing Thai.
6. **Store:** `store/listing.ts`, `store/screens.ts` and `store/art.tsx`, then
   `npx tsx tools/store-assets.ts games/<id> android store screens`. Commit the Android icons
   it draws.
7. **Play tests and release notes:** `e2e/`, and the game's facts in `RELEASE.md`.

Some files stay the same in every game apart from its names: the build and test configs,
start-up, the browser services, the privacy policy, the store config, `ANDROID.md` and most
of the Android project. `tools/test/new-game.test.ts` checks every game against the
template, so a fix to one of them goes into the template and every game at once. A game that
really needs its own version takes that file off the list in the test.

Each game must have its own gameplay, content and look. Use original names, characters and
art, and nothing taken from another game.
