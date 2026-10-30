# Releasing Quilt Nook

The steps every game goes through are in [docs/RELEASE.md](../../docs/RELEASE.md). This page
has Quilt Nook's own answers for them. Building the app is in [ANDROID.md](ANDROID.md).

```sh
npx tsx tools/store-assets.ts games/quiltnook store screens
```

## The editions

| | Ads only | Full |
| --- | --- | --- |
| Players get | rewarded ads and ad breaks; spools and every fabric set earned by playing | the same, plus spool packs, Sewing Kit, No Ad Breaks, Fabric Chest, cloud saves and Google sign-in |

## Play Console

- **App name:** `Quilt Nook: Cozy Block Puzzle`.
- **Category:** Games, Puzzle.
- **Screenshots:** `1-sew.jpg` to `4-fabrics.jpg`, in that order.
- **In-app products** (full edition): the ids, names and descriptions are at the end of
  `listing.txt`. The browser version shows $0.99 to $9.99 as placeholder prices.
- **Countries:** all. Nothing for sale is random.

## Play it before every upload

On the phone, from the internal test link: a patch dragged with a finger and one placed by
tapping, a seam, the second chance from a rewarded ad when the quilt is out of room,
finishing a quilt and doubling its spools with an ad, an ad break (they start after three
finished quilts, after the first five minutes of a session, and only when the results
close), the daily quilt, the back button, and switching to Thai.

## Facts for the content rating

Answer the IARC questionnaire yourself, honestly; these are the facts to answer from:

- No violence, fear, sexual content, bad language, drugs, alcohol, tobacco or crude humour.
  Players sew fabric patches onto a quilt.
- No gambling: nothing can be won or cashed out.
- Players cannot talk to each other or share content. The app does not share their location.
- Full edition: yes, in-app purchases of digital goods, with no random items.
- Ads-only edition: no purchases.
