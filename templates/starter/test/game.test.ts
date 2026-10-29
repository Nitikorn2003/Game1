import { ManualClock, MemoryStore, exportSave, localDayKey } from '@game1/engine';
import { TestStore, type StoreService } from '@game1/platform';
import { FakeAds, manualFrames, settle } from '@game1/shell/testing';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, type GameOptions } from '../src/game.js';
import * as R from '../src/sim/rules.js';
import { createState, restoreState, saveFormat } from '../src/sim/state.js';

const T0 = Date.UTC(2026, 9, 29, 3, 0, 0);

interface Rig {
  clock: ManualClock;
  storage: MemoryStore;
  ads: FakeAds;
  store: StoreService;
  options: GameOptions;
}

function rig(overrides: Partial<Omit<Rig, 'options'>> = {}): Rig {
  const clock = overrides.clock ?? new ManualClock(T0);
  const storage = overrides.storage ?? new MemoryStore();
  const ads = overrides.ads ?? new FakeAds();
  const store = overrides.store ?? new TestStore(CATALOG, storage, { ask: () => Promise.resolve('buy') });
  return { clock, storage, ads, store, options: { clock, scheduler: manualFrames, storage, ads, store, dayKey: (ms) => localDayKey(ms, 0) } };
}

async function started(r: Rig): Promise<Game> {
  const game = await Game.load(r.options);
  game.start();
  await settle(game);
  return game;
}

describe('the rules', () => {
  it('pays a coin a tap, and more after each upgrade', () => {
    const s = createState(T0);
    expect(R.tap(s)).toBe(1);
    s.coins = R.upgradeCost(s);
    expect(R.upgrade(s)).toBe(true);
    expect(s.coins).toBe(0);
    expect(R.tap(s)).toBe(2);
    expect(R.upgrade(s)).toBe(false);
  });

  it('makes every upgrade cost more than the one before', () => {
    const s = createState(T0);
    let last = 0;
    for (let level = 0; level < 30; level++) {
      s.tapLevel = level;
      expect(R.upgradeCost(s)).toBeGreaterThan(last);
      last = R.upgradeCost(s);
    }
  });

  it('reads back what it saved, and replaces damaged fields with safe values', () => {
    const s = createState(T0);
    R.tap(s);
    s.tapLevel = 3;
    expect(restoreState(JSON.parse(JSON.stringify(s)) as Record<string, unknown>)).toEqual(s);
    const damaged = restoreState({ coins: 'lots', tapLevel: -4, stats: null, shop: 7 });
    expect(damaged.coins).toBe(0);
    expect(damaged.tapLevel).toBe(0);
    expect(damaged.stats).toEqual({ taps: 0, playSeconds: 0 });
  });
});

describe('the game', () => {
  it('starts a new game, saves it and continues it after a restart', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    for (let i = 0; i < 25; i++) first.tap();
    expect(first.upgrade()).toBe(true);
    await first.save();
    first.stop();
    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(second.state.tapLevel).toBe(1);
    expect(second.state.coins).toBe(25 - 20);
  });

  it('counts time played on its clock', async () => {
    const r = rig();
    const game = await started(r);
    for (let i = 0; i < 30; i++) {
      r.clock.advance(1000);
      game.pump();
    }
    expect(game.state.stats.playSeconds).toBe(30);
  });

  it('gives the free coins only when the ad network confirms the ad, up to the daily limit', async () => {
    const r = rig();
    const game = await started(r);
    r.ads.next = 'skipped';
    expect(await game.watchAd('bonus')).toBe(false);
    expect(game.state.coins).toBe(0);
    r.ads.next = 'rewarded';
    for (let i = 0; i < R.AD_LIMITS.total; i++) expect(await game.watchAd('bonus')).toBe(true);
    expect(game.adOffered('bonus')).toBe(false);
    expect(game.state.coins).toBe(R.AD_LIMITS.total * R.bonusCoins(game.state));
  });

  it('delivers a purchase once, and No Ad Breaks ends ad breaks', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('coins_small');
    await settle(game);
    expect(game.state.coins).toBe(500);
    for (let i = 0; i < R.AD_BREAKS_AFTER_TAPS; i++) game.tap();
    r.clock.advance(10 * 60_000);
    expect(game.adBreakAllowed()).toBe(true);
    await game.purchase('remove_ads');
    expect(game.adsRemoved).toBe(true);
    expect(game.adBreakAllowed()).toBe(false);
  });

  it('shows no ad breaks to a player who has only just started', async () => {
    const r = rig();
    const game = await started(r);
    r.clock.advance(10 * 60_000);
    for (let i = 0; i < R.AD_BREAKS_AFTER_TAPS - 1; i++) game.tap();
    expect(await game.naturalBreak()).toBe(false);
    game.tap();
    expect(await game.naturalBreak()).toBe(true);
    expect(r.ads.interstitials).toBe(1);
  });

  it('loads a save copied from another phone', async () => {
    const r = rig();
    const game = await started(r);
    const other = createState(T0);
    other.tapLevel = 4;
    other.coins = 77;
    expect(await game.importSave(exportSave(saveFormat, other, T0))).toBe(true);
    expect(game.state.tapLevel).toBe(4);
    expect(game.state.coins).toBe(77);
  });
});
