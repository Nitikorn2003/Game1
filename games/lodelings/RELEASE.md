# Releasing Lodelings

The steps every game goes through are in [docs/RELEASE.md](../../docs/RELEASE.md). This page
has Lodelings' own answers for them. Building the app is in [ANDROID.md](ANDROID.md).

```sh
npx tsx tools/store-assets.ts games/lodelings store screens
```

## The editions

| | Ads only | Full |
| --- | --- | --- |
| Players get | rewarded ads and ad breaks; gems, eggs and everything else earned by playing | the same, plus gem packs, Starter Pack, No Ad Breaks, Ore Doubler, cloud saves and Google sign-in |

## Play Console

- **App name:** `Lodelings: Idle Mining RPG`.
- **Category:** Games, Role Playing (or Casual).
- **Screenshots:** `1-mine.jpg` to `6-relics.jpg`, in that order.
- **In-app products** (full edition): the ids, names and descriptions are at the end of
  `listing.txt`. The browser version shows $0.99 to $19.99 as placeholder prices.
- **Countries:** for the full edition, consider leaving out Belgium, where the regulator
  treats paid random items as gambling.

## Play it before every upload

On the phone, from the internal test link: the first Guardian, a rewarded ad, an ad break
(they start once you have reached depth 12, after the first five minutes of a session),
leaving the app and coming back (offline progress), the back button, and switching to Thai.

## Facts for the content rating

Answer the IARC questionnaire yourself, honestly; these are the facts to answer from:

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
