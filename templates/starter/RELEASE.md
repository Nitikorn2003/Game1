# Releasing Starter

The steps every game goes through are in [docs/RELEASE.md](../../docs/RELEASE.md). This page
has Starter's own answers for them. Building the app is in [ANDROID.md](ANDROID.md).

```sh
npx tsx tools/store-assets.ts templates/starter store screens
```

## The editions

| | Ads only | Full |
| --- | --- | --- |
| Players get | rewarded ads and ad breaks; coins earned by tapping | the same, plus Coin Pouch, No Ad Breaks, cloud saves and Google sign-in |

## Play Console

- **App name:** `Starter: Tap and Upgrade`.
- **Category:** Games, Casual.
- **Screenshots:** `1-tap.jpg` and `2-shop.jpg`, in that order.
- **In-app products** (full edition): the ids, names and descriptions are at the end of
  `listing.txt`. The browser version shows $0.99 and $2.99 as placeholder prices.
- **Countries:** all.

## Play it before every upload

On the phone, from the internal test link: tapping and an upgrade, a rewarded ad, an ad
break (they start after 200 taps, once the first five minutes of a session have passed),
the back button, and switching to Thai.

## Facts for the content rating

Answer the IARC questionnaire yourself, honestly; these are the facts to answer from:

- No violence, fear, sexual content, bad language, drugs, alcohol, tobacco or crude humour.
- No gambling: nothing can be won or cashed out.
- Players cannot talk to each other or share content. The app does not share their location.
- Full edition: yes, in-app purchases of digital goods, with no random items.
- Ads-only edition: no purchases.
