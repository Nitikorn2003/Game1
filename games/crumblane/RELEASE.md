# Releasing Crumb Lane

The steps every game goes through are in [docs/RELEASE.md](../../docs/RELEASE.md). This page
has Crumb Lane's own answers for them. Building the app is in [ANDROID.md](ANDROID.md).

```sh
npx tsx tools/store-assets.ts games/crumblane store screens
```

## The editions

| | Ads only | Full |
| --- | --- | --- |
| Players get | rewarded ads and ad breaks; sugar, tools, every tile set and every season earned by playing | the same, plus sugar packs, Baker’s Kit, No Ad Breaks, Lane Collection, cloud saves and Google sign-in |

## Play Console

- **App name:** `Crumb Lane: Tile Match Bakery`.
- **Category:** Games, Puzzle.
- **Screenshots:** `1-counter.jpg` to `6-daily.jpg`, in that order.
- **In-app products** (full edition): the ids, names and descriptions are at the end of
  `listing.txt`. The browser version shows $0.99 to $9.99 as placeholder prices.
- **Countries:** all. Nothing for sale is random.

## Play it before every upload

On the phone, from the internal test link: the first level, tapping pastries onto the tray
and three of a kind boxing up, a pastry under another that will not come, keeping the tray at
four for three stars, the spatula, the rolling pin and the whisk, a tool from a rewarded ad
when the apron is empty, a full tray and room made with a rewarded ad, a pastry taken back
from the cooling rack, ending a round and trying again, clearing a level and doubling its
sugar with an ad, an ad break (they start after three counters cleared, after the first five
minutes of a session, and only when the results close), a paper bag, a stack, a ribbon box
and sprinkles on their first levels, the last level of a shop and the shop opening on the
lane, the daily special, a tile set and a season bought with sugar, the back button during a
round, and switching to Thai.

## Facts for the content rating

Answer the IARC questionnaire yourself, honestly; these are the facts to answer from:

- No violence, fear, sexual content, bad language, drugs, alcohol, tobacco or crude humour.
  Players match pastries on a bakery counter and pack them into boxes.
- No gambling and no simulated gambling: there are no bets and no wagers, and the sugar the
  game pays can only be spent in the game. Nothing can be won or cashed out.
- Players cannot talk to each other or share content. The app does not share their location.
- Full edition: yes, in-app purchases of digital goods, with no random items.
- Ads-only edition: no purchases.
