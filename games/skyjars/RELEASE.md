# Releasing Sky Jars

The steps every game goes through are in [docs/RELEASE.md](../../docs/RELEASE.md). This page
has Sky Jars' own answers for them. Building the app is in [ANDROID.md](ANDROID.md).

```sh
npx tsx tools/store-assets.ts games/skyjars store screens
```

## The editions

| | Ads only | Full |
| --- | --- | --- |
| Players get | rewarded ads and ad breaks; stardust, every jar style and every sky earned by playing | the same, plus stardust packs, Night Kit, No Ad Breaks, Sky Collection, cloud saves and Google sign-in |

## Play Console

- **App name:** `Sky Jars: Colour Sort Puzzle`.
- **Category:** Games, Puzzle.
- **Screenshots:** `1-pour.jpg` to `6-looks.jpg`, in that order.
- **In-app products** (full edition): the ids, names and descriptions are at the end of
  `listing.txt`. The browser version shows $0.99 to $9.99 as placeholder prices.
- **Countries:** all. Nothing for sale is random.

## Play it before every upload

On the phone, from the internal test link: the first level by tapping, a pour onto a jar
that cannot take it, Undo until the free undos run out and more from a rewarded ad, Restart,
a hint and an extra jar from a rewarded ad, solving a level and doubling its stardust with
an ad, an ad break (they start after six solved levels, after the first five minutes of a
session, and only when the results close), the daily sky, a jar style and a sky bought with
stardust, the back button while a jar is lifted, and switching to Thai.

## Facts for the content rating

Answer the IARC questionnaire yourself, honestly; these are the facts to answer from:

- No violence, fear, sexual content, bad language, drugs, alcohol, tobacco or crude humour.
  Players pour coloured light between glass jars and light up constellations.
- No gambling: nothing can be won or cashed out.
- Players cannot talk to each other or share content. The app does not share their location.
- Full edition: yes, in-app purchases of digital goods, with no random items.
- Ads-only edition: no purchases.
