# Releasing Lotus Canal

The steps every game goes through are in [docs/RELEASE.md](../../docs/RELEASE.md). This page
has Lotus Canal's own answers for them. Building the app is in [ANDROID.md](ANDROID.md).

```sh
npx tsx tools/store-assets.ts games/lotuscanal store screens
```

## The editions

| | Ads only | Full |
| --- | --- | --- |
| Players get | rewarded ads and ad breaks; coins, every card back and every scene earned by playing | the same, plus coin packs, Market Kit, No Ad Breaks, Canal Collection, cloud saves and Google sign-in |

## Play Console

- **App name:** `Lotus Canal Solitaire`.
- **Category:** Games, Card.
- **Screenshots:** `1-run.jpg` to `6-looks.jpg`, in that order.
- **In-app products** (full edition): the ids, names and descriptions are at the end of
  `listing.txt`. The browser version shows $0.99 to $9.99 as placeholder prices.
- **Countries:** all. Nothing for sale is random.

## Play it before every upload

On the phone, from the internal test link: the first level by tapping, a card that does not
fit, turning the stock, a run of five and its bonus, Undo until the free undos run out and
more from a rewarded ad, a lotus wild and five more cards from a rewarded ad, ending a stuck
deal, clearing a level and doubling its coins with an ad, an ad break (they start after five
cleared deals, after the first five minutes of a session, and only when the results close),
the daily deal, a card back and a scene bought with coins, the back button during a deal,
and switching to Thai.

## Facts for the content rating

Answer the IARC questionnaire yourself, honestly; these are the facts to answer from:

- No violence, fear, sexual content, bad language, drugs, alcohol, tobacco or crude humour.
  Players clear a solitaire (patience) card game on a boat trip through a floating market.
- No gambling and no simulated gambling: there are no bets, no casino games and no wagers,
  and the coins the game pays can only be spent in the game. Nothing can be won or cashed out.
- Players cannot talk to each other or share content. The app does not share their location.
- Full edition: yes, in-app purchases of digital goods, with no random items.
- Ads-only edition: no purchases.
