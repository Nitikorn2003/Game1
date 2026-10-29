import { ManualClock, MemoryStore, localDayKey, type FrameScheduler } from '@game1/engine';
import { TestStore, noStore, type AdOutcome, type AdsService, type Settlement, type StoreService } from '@game1/platform';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, type GameOptions } from '../src/game.js';
import * as C from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { T0 } from './helpers.js';

/** The loop never runs by itself in tests; they call game.pump() after moving the clock. */
const manualFrames: FrameScheduler = { request: () => 0, cancel: () => undefined };

class FakeAds implements AdsService {
  readonly name = 'admob' as const;
  next: AdOutcome = 'rewarded';
  rewarded: string[] = [];
  interstitials = 0;
  init(): Promise<void> {
    return Promise.resolve();
  }
  showRewarded(placement: string): Promise<AdOutcome> {
    this.rewarded.push(placement);
    return Promise.resolve(this.next);
  }
  showInterstitial(): Promise<boolean> {
    this.interstitials += 1;
    return Promise.resolve(true);
  }
  privacyOptionsRequired(): boolean {
    return false;
  }
  showPrivacyOptions(): Promise<void> {
    return Promise.resolve();
  }
}

interface Rig {
  clock: ManualClock;
  storage: MemoryStore;
  ads: FakeAds;
  store: StoreService;
  options: GameOptions;
}

function rig(overrides: Partial<Rig> = {}): Rig {
  const clock = overrides.clock ?? new ManualClock(T0);
  const storage = overrides.storage ?? new MemoryStore();
  const ads = overrides.ads ?? new FakeAds();
  const store = overrides.store ?? new TestStore(CATALOG, storage, { ask: () => Promise.resolve('buy') });
  return {
    clock,
    storage,
    ads,
    store,
    options: { clock, scheduler: manualFrames, storage, ads, store, dayKey: (ms) => localDayKey(ms, 0), seed: () => 42 },
  };
}

async function started(r: Rig): Promise<Game> {
  const game = await Game.load(r.options);
  game.start();
  await settle(game);
  return game;
}

/** Lets pending saves and purchase syncs finish. */
async function settle(game: Game): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await game.syncPurchases(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function run(game: Game, clock: ManualClock, seconds: number): void {
  for (let i = 0; i < seconds * 10; i++) {
    clock.advance(100);
    game.pump();
  }
}

describe('the game controller', () => {
  it('starts a new game, saves it and continues it after a restart', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    run(first, r.clock, 12);
    expect(first.hatch(0)?.isNew).toBe(true);
    for (let i = 0; i < 20; i++) first.tap();
    await first.save();
    const saved = JSON.stringify(first.state);
    first.stop();

    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(JSON.stringify(second.state)).toBe(saved);
  });

  it('runs the simulation in fixed steps while the app is open and catches up short pauses', async () => {
    const r = rig();
    const game = await started(r);
    run(game, r.clock, 11);
    game.hatch(0);
    const played = game.state.stats.playSeconds;
    const hp = game.state.hp;
    run(game, r.clock, 3);
    expect(game.state.stats.playSeconds - played).toBeCloseTo(3);
    expect(hp - game.state.hp).toBeCloseTo(R.teamDps(game.state, r.clock.now()) * 3);
    // A 30 second pause (e.g. a rewarded ad) is simulated step by step, not paid as offline time.
    r.clock.advance(30_000);
    game.pump();
    expect(game.state.stats.playSeconds - played).toBeCloseTo(33);
    expect(game.state.offline).toBeNull();
    expect(game.state.lastSeenAt).toBe(r.clock.now());
  });

  it('pays offline time after a long gap, once, and can double it with an ad', async () => {
    const r = rig();
    const game = await started(r);
    run(game, r.clock, 11);
    game.hatch(0);
    r.clock.advance(3 * 3600 * 1000);
    game.pump();
    const report = game.state.offline;
    expect(report?.seconds).toBe(R.offlineCapSeconds(game.state));
    const ore = game.state.ore;
    expect(await game.watchAd('offline_double')).toBe(true);
    expect(game.state.offline).toBeNull();
    expect(game.state.ore).toBeCloseTo(ore + (report?.ore ?? 0) * 2);
    expect(game.collectOffline()).toBe(false);
  });

  it('limits taps to 25 a second', async () => {
    const r = rig();
    const game = await started(r);
    let counted = 0;
    for (let i = 0; i < 40; i++) if (game.tap()) counted += 1;
    expect(counted).toBe(C.MAX_TAPS_PER_SECOND);
    r.clock.advance(1000);
    expect(game.tap()).toBe(true);
  });

  it('gives an ad reward only when the ad network confirms it', async () => {
    const r = rig();
    const game = await started(r);
    const gems = game.state.gems;
    r.ads.next = 'skipped';
    expect(await game.watchAd('gem_crate')).toBe(false);
    r.ads.next = 'unavailable';
    expect(await game.watchAd('gem_crate')).toBe(false);
    expect(game.state.gems).toBe(gems);
    r.ads.next = 'rewarded';
    expect(await game.watchAd('gem_crate')).toBe(true);
    expect(game.state.gems).toBe(gems + C.GEM_CRATE_GEMS);
    expect(r.ads.rewarded).toEqual(['gem_crate', 'gem_crate', 'gem_crate']);
  });

  it('delivers a purchase exactly once', async () => {
    const r = rig();
    const game = await started(r);
    const gems = game.state.gems;
    expect((await game.purchase('gems_small')).status).toBe('granted');
    expect(game.state.gems).toBe(gems + 100);
    await game.syncPurchases(false);
    await game.syncPurchases(false);
    expect(game.state.gems).toBe(gems + 100);
    expect(game.state.shop.pending).toBeNull();
  });

  it('says when Google Play already has the item, and otherwise that nothing was charged', async () => {
    const r = rig();
    let reason = 'already_owned';
    const real = r.store;
    const store: StoreService = {
      name: 'test',
      products: (ids) => real.products(ids),
      purchase: () => Promise.resolve({ status: 'failed', reason, retryable: true }),
      wallet: () => real.wallet(),
      onChange: (listener) => real.onChange(listener),
      settle: (id) => real.settle(id),
    };
    const game = await started(rig({ clock: r.clock, storage: r.storage, store }));
    const toasts: string[] = [];
    game.events.on('toast', (toast) => toasts.push(toast.key));
    await game.purchase('gems_small');
    reason = 'billing_6';
    await game.purchase('gems_small');
    expect(toasts).toEqual(['shop.alreadyOwned', 'shop.failed']);
  });

  it('keeps a purchase that was paid while the app died before it was delivered', async () => {
    const r = rig();
    const real = new TestStore(CATALOG, r.storage, { ask: () => Promise.resolve('buy') });
    let crash = true;
    const flaky: StoreService = {
      name: 'test',
      products: (ids) => real.products(ids),
      purchase: (id) => real.purchase(id),
      wallet: () => real.wallet(),
      onChange: (listener) => real.onChange(listener),
      settle: (id): Promise<Settlement> => {
        if (crash) return Promise.reject(new Error('app killed'));
        return real.settle(id);
      },
    };
    const first = await started(rig({ clock: r.clock, storage: r.storage, store: flaky }));
    const gems = first.state.gems;
    await first.purchase('gems_medium');
    expect(first.state.gems).toBe(gems);
    expect(first.state.shop.pending).not.toBeNull();
    first.stop();

    crash = false;
    const second = await started(rig({ clock: r.clock, storage: r.storage, store: flaky }));
    expect(second.state.gems).toBe(gems + 550);
    expect(second.state.shop.pending).toBeNull();
    await second.syncPurchases(false);
    expect(second.state.gems).toBe(gems + 550);
  });

  it('in the ads-only edition sells nothing, never asks for a wallet and still pays ad rewards', async () => {
    const calls: string[] = [];
    const store: StoreService = {
      ...noStore,
      products: (ids) => {
        calls.push('products');
        return noStore.products(ids);
      },
      wallet: () => {
        calls.push('wallet');
        return noStore.wallet();
      },
    };
    const game = await started(rig({ store }));
    expect(game.sells).toBe(false);
    expect(await game.syncPurchases(false)).toBe(false);
    expect(calls).toEqual([]);
    expect(game.storeError).toBe(false);
    const gems = game.state.gems;
    expect(await game.watchAd('gem_crate')).toBe(true);
    expect(game.state.gems).toBe(gems + C.GEM_CRATE_GEMS);
  });

  it('turns on what non-consumables unlock and sells the starter pack once', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('remove_ads');
    expect(R.hasEntitlement(game.state, 'remove_ads')).toBe(true);
    await game.purchase('starter_pack');
    expect(game.state.shop.starterBought).toBe(true);
    const gems = game.state.gems;
    await game.purchase('starter_pack');
    expect(game.state.gems).toBe(gems);
  });

  it('gives No Ad Breaks owners rewards without ads and never shows them ad breaks', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('remove_ads');
    expect(await game.watchAd('gem_crate')).toBe(true);
    expect(r.ads.rewarded).toEqual([]);
    game.state.bestDepth = 50;
    r.clock.advance(3600 * 1000);
    expect(await game.naturalBreak()).toBe(false);
    expect(r.ads.interstitials).toBe(0);
  });

  it('shows ad breaks only at natural pauses the rules allow', async () => {
    const r = rig();
    const game = await started(r);
    expect(await game.naturalBreak()).toBe(false);
    game.state.bestDepth = 20;
    r.clock.advance(6 * 60_000);
    expect(await game.naturalBreak()).toBe(true);
    expect(await game.naturalBreak()).toBe(false);
    r.clock.advance(6 * 60_000);
    expect(await game.naturalBreak()).toBe(true);
    expect(r.ads.interstitials).toBe(2);
  });

  it('starts new daily quests when the day changes while playing', async () => {
    const r = rig();
    const game = await started(r);
    const today = game.state.daily.questDay;
    game.state.daily.quests[0] = { ...(game.state.daily.quests[0] ?? { metric: 'taps', target: 1, progress: 0, claimed: false }), progress: 5 };
    r.clock.advance(24 * 3600 * 1000);
    game.pump();
    run(game, r.clock, 2);
    expect(game.state.daily.questDay).not.toBe(today);
    expect(game.state.daily.quests.every((q) => q.progress === 0)).toBe(true);
  });

  it('copies a save out and loads it back in', async () => {
    const r = rig();
    const game = await started(r);
    for (let i = 0; i < 10; i++) game.tap();
    const text = game.exportSave();
    const taps = game.state.stats.taps;
    r.clock.advance(1000);
    for (let i = 0; i < 10; i++) game.tap();
    expect(await game.importSave('not a save')).toBe(false);
    expect(await game.importSave(text)).toBe(true);
    expect(game.state.stats.taps).toBe(taps);
    expect(game.state.lastSeenAt).toBe(r.clock.now());
  });
});
