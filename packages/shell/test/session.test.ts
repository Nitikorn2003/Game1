import { TestStore, noStore, type Settlement, type StoreService } from '@game1/platform';
import { describe, expect, it } from 'vitest';
import { CATALOG, CoinGame, T0, rig, settle, started } from './coins.js';

describe('a game session', () => {
  it('starts a new game, saves it and continues it after a restart', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    first.play(30);
    await first.save();
    first.stop();
    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(second.state.played).toBe(30);
  });

  it('delivers a purchase exactly once, with a thank-you', async () => {
    const r = rig();
    const game = await started(r);
    const toasts: string[] = [];
    game.events.on('toast', (toast) => toasts.push(toast.key));
    expect((await game.purchase('coins_small')).status).toBe('granted');
    await game.syncPurchases(false);
    await game.syncPurchases(false);
    expect(game.state.coins).toBe(100);
    expect(game.state.shop.settled).toHaveLength(1);
    expect(game.state.shop.pending).toBeNull();
    expect(toasts).toEqual(['shop.thanks']);
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
      settle: (id): Promise<Settlement> => (crash ? Promise.reject(new Error('app killed')) : real.settle(id)),
    };
    const first = await started(rig({ clock: r.clock, storage: r.storage, store: flaky }));
    await first.purchase('coins_small');
    expect(first.state.coins).toBe(0);
    expect(first.state.shop.pending).not.toBeNull();
    first.stop();

    crash = false;
    const second = await started(rig({ clock: r.clock, storage: r.storage, store: flaky }));
    expect(second.state.coins).toBe(100);
    expect(second.state.shop.pending).toBeNull();
  });

  it('gives an ad reward only when the network confirms it, up to the daily limit', async () => {
    const r = rig();
    const game = await started(r);
    r.ads.next = 'skipped';
    expect(await game.watchAd('bonus')).toBe(false);
    r.ads.next = 'rewarded';
    for (let i = 0; i < 3; i++) expect(await game.watchAd('bonus')).toBe(true);
    expect(await game.watchAd('bonus')).toBe(false);
    expect(game.state.coins).toBe(30);
    expect(r.ads.rewarded).toHaveLength(4);
    // A new day, new ads.
    r.clock.advance(24 * 3600 * 1000);
    expect(await game.watchAd('bonus')).toBe(true);
  });

  it('shows ad breaks only when the game allows them, never early and never too often', async () => {
    const r = rig();
    const game = await started(r);
    r.clock.advance(6 * 60_000);
    expect(await game.naturalBreak()).toBe(false);
    game.play(60);
    expect(await game.naturalBreak()).toBe(true);
    expect(await game.naturalBreak()).toBe(false);
    r.clock.advance(6 * 60_000);
    expect(await game.naturalBreak()).toBe(true);
    // Not right after the player chose to watch a rewarded ad.
    r.clock.advance(6 * 60_000);
    await game.watchAd('bonus');
    expect(await game.naturalBreak()).toBe(false);
    expect(r.ads.interstitials).toBe(2);
  });

  it('gives No Ad Breaks owners their rewards without ads and no ad breaks', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('remove_ads');
    expect(game.adsRemoved).toBe(true);
    expect(await game.watchAd('bonus')).toBe(true);
    expect(r.ads.rewarded).toEqual([]);
    game.play(600);
    r.clock.advance(3600 * 1000);
    expect(await game.naturalBreak()).toBe(false);
  });

  it('keeps what this save bought when a pasted save replaces it', async () => {
    const r = rig();
    const game = await started(r);
    game.play(10);
    const older = game.exportSave();
    await game.purchase('coins_small');
    expect(await game.importSave('not a save')).toBe(false);
    expect(await game.importSave(older)).toBe(true);
    expect(game.state.played).toBe(10);
    expect(game.state.coins).toBe(100);
    // Loading it again grants nothing twice.
    expect(await game.importSave(older)).toBe(true);
    expect(game.state.coins).toBe(100);
  });

  it('sells nothing in the ads-only edition and never asks for a wallet', async () => {
    const calls: string[] = [];
    const store: StoreService = {
      ...noStore,
      wallet: () => {
        calls.push('wallet');
        return noStore.wallet();
      },
    };
    const game = await started(rig({ store }));
    expect(game.sells).toBe(false);
    expect(await game.syncPurchases(false)).toBe(false);
    expect(game.storeError).toBe(false);
    expect(calls).toEqual([]);
    expect(await game.watchAd('bonus')).toBe(true);
  });

  it('saves settings at once and turns the sound on and off', async () => {
    const r = rig();
    const sound: boolean[] = [];
    const game = await CoinGame.load({ ...r.options, sound: { setEnabled: (on) => sound.push(on) } });
    game.start();
    await settle(game);
    game.setSettings({ sound: false, locale: 'th' });
    await settle(game);
    const again = await CoinGame.load(r.options);
    expect(again.state.settings).toEqual({ sound: false, haptics: true, locale: 'th' });
    expect(sound).toEqual([true, false]);
  });

  it('tells the player when a damaged save had to be replaced', async () => {
    const r = rig();
    await r.storage.set('save.a', 'garbage');
    await r.storage.set('save.b', 'garbage');
    const game = await CoinGame.load(r.options);
    const toasts: string[] = [];
    game.events.on('toast', (toast) => toasts.push(toast.key));
    game.start();
    expect(game.startNote).toBe('unreadable');
    expect(toasts).toEqual(['toast.saveUnreadable']);
    expect(game.now()).toBe(T0);
  });
});
