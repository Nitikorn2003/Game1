import { describe, expect, it } from 'vitest';
import {
  INTERSTITIAL_DEFAULTS,
  SETTLED_KEEP,
  adsLeft,
  applySettlement,
  createAdLedger,
  createShop,
  interstitialTimely,
  mergeSettlements,
  missingSettlements,
  recordInterstitial,
  recordRewarded,
  restoreAdLedger,
  restoreSettings,
  restoreShop,
  type ShopRecord,
} from '../src/index.js';

interface Wallet {
  shop: ShopRecord;
  coins: number;
}
const wallet = (): Wallet => ({ shop: createShop(), coins: 0 });
const grantCoins = (w: Wallet, amounts: Readonly<Record<string, number>>) => {
  w.coins += amounts.coins ?? 0;
};

describe('the purchase record', () => {
  it('applies each settlement once and drops amounts that are not whole numbers', () => {
    const w = wallet();
    expect(applySettlement(w, grantCoins, 'a', { coins: 100, junk: 0.5 }, 1)).toBe(true);
    expect(applySettlement(w, grantCoins, 'a', { coins: 100 }, 2)).toBe(false);
    expect(w.coins).toBe(100);
    expect(w.shop.settled).toEqual([{ id: 'a', amounts: { coins: 100 }, at: 1 }]);
  });

  it('remembers only the newest settlements, and never takes back over a full list what it forgot', () => {
    const into = wallet();
    for (let i = 0; i < SETTLED_KEEP + 5; i++) applySettlement(into, grantCoins, `n${i}`, { coins: 1 }, 1000 + i);
    expect(into.shop.settled).toHaveLength(SETTLED_KEEP);
    const from = wallet();
    applySettlement(from, grantCoins, 'n0', { coins: 1 }, 1000);
    applySettlement(from, grantCoins, 'later', { coins: 7 }, 5000);
    expect(missingSettlements(into.shop, from.shop).map((s) => s.id)).toEqual(['later']);
    expect(mergeSettlements(into, from, grantCoins, 6000)).toBe(1);
    expect(into.coins).toBe(SETTLED_KEEP + 5 + 7);
  });

  it('repairs a damaged record', () => {
    const shop = restoreShop(
      {
        entitlements: ['remove_ads', 'free_money', 'remove_ads', 3],
        settled: ['old-id', { id: 'x', amounts: { coins: 5, bad: 'y' }, at: 4 }, { id: 'x' }, { id: 'no spaces allowed' }],
        pending: 'p'.repeat(65),
      },
      ['remove_ads'],
    );
    expect(shop).toEqual({
      entitlements: ['remove_ads'],
      settled: [
        { id: 'old-id', amounts: {}, at: 0 },
        { id: 'x', amounts: { coins: 5 }, at: 4 },
      ],
      pending: null,
    });
    expect(restoreShop('nonsense', [])).toEqual(createShop());
  });
});

describe('the ad ledger', () => {
  const limits = { perPlacement: { bonus: 2, chest: 5 }, total: 3 };

  it('counts rewarded ads per placement and in total, and starts again each day', () => {
    const ads = createAdLedger(['bonus', 'chest'] as const);
    recordRewarded(ads, 'bonus', 10, '2026-10-01');
    recordRewarded(ads, 'bonus', 20, '2026-10-01');
    expect(adsLeft(ads, 'bonus', '2026-10-01', limits)).toBe(0);
    expect(adsLeft(ads, 'chest', '2026-10-01', limits)).toBe(1);
    expect(adsLeft(ads, 'bonus', '2026-10-02', limits)).toBe(2);
    recordRewarded(ads, 'chest', 30, '2026-10-02');
    expect(ads.counts).toEqual({ bonus: 0, chest: 1 });
    expect(ads.total).toBe(1);
  });

  it('allows an ad break only after the first minutes, with gaps, and a few a day', () => {
    const ads = createAdLedger(['bonus'] as const);
    const day = '2026-10-01';
    const rules = { ...INTERSTITIAL_DEFAULTS, maxPerDay: 2 };
    const start = 1_000_000;
    expect(interstitialTimely(ads, start + 60_000, day, start, rules)).toBe(false);
    let now = start + rules.minSessionMs;
    expect(interstitialTimely(ads, now, day, start, rules)).toBe(true);
    recordInterstitial(ads, now, day);
    expect(interstitialTimely(ads, now + rules.minGapMs - 1, day, start, rules)).toBe(false);
    now += rules.minGapMs;
    recordInterstitial(ads, now, day);
    now += rules.minGapMs;
    expect(interstitialTimely(ads, now, day, start, rules)).toBe(false);
    expect(interstitialTimely(ads, now, '2026-10-02', start, rules)).toBe(true);
    recordRewarded(ads, 'bonus', now, '2026-10-02');
    expect(interstitialTimely(ads, now + rules.afterRewardedMs - 1, '2026-10-02', start, rules)).toBe(false);
  });

  it('repairs a damaged ledger', () => {
    expect(restoreAdLedger({ day: 'yesterday', counts: { bonus: -3, other: 9 }, total: 'x', interstitials: 2.7 }, ['bonus'] as const)).toEqual({
      day: null,
      counts: { bonus: 0 },
      total: 0,
      lastInterstitialAt: 0,
      lastRewardedAt: 0,
      interstitials: 2,
    });
  });
});

describe('the settings', () => {
  it('repairs damaged settings', () => {
    expect(restoreSettings({ sound: 'loud', haptics: false, locale: 'fr' })).toEqual({ sound: true, haptics: false, locale: 'auto' });
    expect(restoreSettings(null)).toEqual({ sound: true, haptics: true, locale: 'auto' });
  });
});
