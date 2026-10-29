# Releasing Rice Field Art

The steps every game goes through are in [docs/RELEASE.md](../../docs/RELEASE.md). This page
has Rice Field Art's own answers for them. Building the app is in [ANDROID.md](ANDROID.md).

```sh
npx tsx tools/store-assets.ts games/ricefield store screens
```

## The editions

| | Ads only | Full |
| --- | --- | --- |
| Players get | rewarded ads and ad breaks; seeds, every scene and every marker earned by playing | the same, plus seed packs, Farmer’s Kit, No Ad Breaks, Field Collection, cloud saves and Google sign-in |

## Play Console

- **App name:** `Rice Field Art: Picture Logic`.
- **Category:** Games, Puzzle.
- **Screenshots:** `1-grown.jpg` to `6-looks.jpg`, in that order.
- **In-app products** (full edition): the ids, names and descriptions are at the end of
  `listing.txt`. The browser version shows $0.99 to $9.99 as placeholder prices.
- **Countries:** all. Nothing for sale is random.

## Play it before every upload

On the phone, from the internal test link: the first field by tapping, a drag along a row, a
wrong move, the free hint and a hint from a rewarded ad, running out of hearts and filling
them up with a rewarded ad, starting a field over, growing a field and doubling its seeds with
an ad, an ad break (they start after three grown fields, after the first five minutes of a
session, and only when the results close), the daily field, a new album opening, a scene and
a marker bought with seeds, the back button during a field, and switching to Thai.

## Facts for the content rating

Answer the IARC questionnaire yourself, honestly; these are the facts to answer from:

- No violence, fear, sexual content, bad language, drugs, alcohol, tobacco or crude humour.
  Players solve picture logic puzzles (nonograms) by planting rice in fields.
- No gambling and no simulated gambling: there are no bets and no wagers, and the seeds the
  game pays can only be spent in the game. Nothing can be won or cashed out.
- Players cannot talk to each other or share content. The app does not share their location.
- Full edition: yes, in-app purchases of digital goods, with no random items.
- Ads-only edition: no purchases.
