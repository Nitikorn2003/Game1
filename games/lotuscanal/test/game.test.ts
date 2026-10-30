import { ManualClock, MemoryStore, exportSave, localDayKey } from '@game1/engine';
import { TestStore, noStore, type StoreService } from '@game1/platform';
import { FakeAds, manualFrames, settle } from '@game1/shell/testing';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, type GameOptions, type PlayEvent, type SoundName } from '../src/game.js';
import { botChoice } from '../src/sim/bot.js';
import * as C from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat } from '../src/sim/state.js';
import { dealtOf, T0 } from './helpers.js';

interface Rig {
  clock: ManualClock;
  storage: MemoryStore;
  ads: FakeAds;
  store: StoreService;
  sounds: SoundName[];
  options: GameOptions;
}

function rig(overrides: Partial<Omit<Rig, 'options' | 'sounds'>> = {}): Rig {
  const clock = overrides.clock ?? new ManualClock(T0);
  const storage = overrides.storage ?? new MemoryStore();
  const ads = overrides.ads ?? new FakeAds();
  const store = overrides.store ?? new TestStore(CATALOG, storage, { ask: () => Promise.resolve('buy') });
  const sounds: SoundName[] = [];
  const sound = { play: (name: SoundName) => sounds.push(name), setEnabled: () => undefined };
  return {
    clock,
    storage,
    ads,
    store,
    sounds,
    options: { clock, scheduler: manualFrames, storage, ads, store, sound, dayKey: (ms) => localDayKey(ms, 0) },
  };
}

async function started(r: Rig): Promise<Game> {
  const game = await Game.load(r.options);
  game.start();
  await settle(game);
  return game;
}

/** Clears the deal in a mode through the game, the way a careful player would tap it. */
function clear(game: Game, mode: C.Mode): void {
  if (!game.open(mode)) throw new Error('no deal');
  for (let moves = 0; moves < 200; moves++) {
    const deal = game.deal(mode);
    if (!deal) return;
    const spot = botChoice(R.tableOf(deal));
    if (spot === null ? !game.draw(mode) : !game.play(mode, spot)) throw new Error('move refused');
  }
  throw new Error('the deal went on too long');
}

/** Nothing face up fits the ace the pile starts with, and the stock is empty. */
const STUCK = dealtOf('peaks2', [9, 9, 10, 10, 11, 11, 6, 7, 8, 5, 6, 7, 3, 4, 5, 6, 7, 8, 3, 4], [0], [1, 2, 3, 4, 5, 2]);

function stick(game: Game, mode: C.Mode): void {
  const deal = game.open(mode);
  if (!deal) throw new Error('no deal');
  deal.dealt = STUCK;
  deal.moves = [];
}

describe('the game', () => {
  it('starts a new game, saves it and continues it after a restart', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    clear(first, 'level');
    const deal = first.open('level');
    const spot = deal && botChoice(R.tableOf(deal));
    if (spot === null) first.draw('level');
    else first.play('level', spot);
    await first.save();
    const saved = JSON.stringify(first.state);
    expect(first.state.level).toBe(2);
    expect(first.state.deals.level?.moves).toHaveLength(1);
    first.stop();

    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(JSON.stringify(second.state)).toBe(saved);
  });

  it('tells the screens what a play did, with a sound for it', async () => {
    const r = rig();
    const game = await started(r);
    const events: PlayEvent[] = [];
    game.events.on('play', (e) => events.push(e));
    const draws: number[] = [];
    game.events.on('draw', (e) => draws.push(e.card));
    const deal = game.open('level');
    if (!deal) throw new Error('no deal');
    const covered = deal.dealt.cards.findIndex((_, spot) => !R.tableOf(deal).cleared[spot] && (R.tableOf(deal).layout.coveredBy[spot]?.length ?? 0) > 0);
    expect(game.play('level', covered)).toBeNull();
    clear(game, 'level');
    const last = events[events.length - 1];
    expect(last?.result?.level).toBe(1);
    expect(last?.deal.level).toBe(1);
    expect(events.length).toBe(deal.dealt.cards.length);
    expect(r.sounds[0]).toBe('nope');
    expect(r.sounds[r.sounds.length - 1]).toBe('won');
    expect(r.sounds.filter((s) => s === 'draw')).toHaveLength(draws.length);
    expect(r.sounds).toContain('flip');
  });

  it('clears into a result that one rewarded ad doubles', async () => {
    const r = rig();
    const game = await started(r);
    clear(game, 'level');
    const result = game.state.result;
    expect(result?.won).toBe(true);
    const coins = game.state.coins;
    r.ads.next = 'skipped';
    expect(await game.watchAd('double_coins')).toBe(false);
    r.ads.next = 'rewarded';
    expect(await game.watchAd('double_coins')).toBe(true);
    expect(game.state.coins).toBe(coins + (result?.coins ?? 0));
    expect(await game.watchAd('double_coins')).toBe(false);
    expect(r.ads.rewarded).toEqual(['double_coins', 'double_coins']);
  });

  it('gives help for a rewarded ad to the deal it was watched for', async () => {
    const r = rig();
    const game = await started(r);
    game.open('level');
    stick(game, 'daily');
    expect(game.adOffered('extra_cards', R.slotOf('daily'))).toBe(true);
    expect(game.adOffered('extra_cards', R.slotOf('level'))).toBe(false);
    expect(await game.watchAd('extra_cards', R.slotOf('daily'))).toBe(true);
    expect(R.tableOf(game.state.deals.daily ?? stickFailed()).stock).toHaveLength(5);
    expect(game.state.deals.level?.extras).toBe(0);
    expect(await game.watchAd('wild', R.slotOf('daily'))).toBe(true);
    expect(game.state.deals.daily?.wilds).toBe(1);
    expect(r.sounds).toEqual(['claim', 'wild']);
  });

  it('uses help for coins and refuses it without', async () => {
    const r = rig();
    const game = await started(r);
    stick(game, 'level');
    expect(game.buyTool('level', 'wild')).toBe(false);
    game.state.coins = 100;
    expect(game.buyTool('level', 'wild')).toBe(true);
    expect(game.buyTool('level', 'extraCards')).toBe(true);
    expect(game.state.coins).toBe(100 - C.TOOL_COSTS.wild - C.TOOL_COSTS.extraCards);
    expect(r.sounds).toEqual(['wild', 'buy']);
  });

  it('undoes a play, and ends a stuck deal for a new one', async () => {
    const r = rig();
    const game = await started(r);
    const deal = game.open('level');
    const spot = deal && botChoice(R.tableOf(deal));
    if (spot === null) throw new Error('no play');
    game.play('level', spot);
    expect(game.undo('level')).toBe(true);
    expect(game.state.deals.level?.moves).toEqual([]);
    expect(game.giveUp('level')).toBeNull();
    stick(game, 'level');
    expect(game.giveUp('level')?.won).toBe(false);
    expect(game.state.deals.level).toBeNull();
    expect(game.open('level')?.attempt).toBe(1);
    expect(r.sounds).toEqual(['play', 'undo', 'lost']);
  });

  it('sells looks for coins', async () => {
    const r = rig();
    const game = await started(r);
    game.state.coins = C.LOOK_COSTS.sunset;
    expect(game.buyLook('sunset')).toBe(true);
    expect(R.sceneInUse(game.state)).toBe('sunset');
    expect(game.chooseLook('morning')).toBe(true);
    expect(game.chooseLook('kanok')).toBe(false);
    expect(game.state.coins).toBe(0);
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
});

function stickFailed(): never {
  throw new Error('no daily deal');
}

describe('ads and purchases', () => {
  it('gives free coins only when the ad network confirms the ad, up to the daily limit', async () => {
    const r = rig();
    const game = await started(r);
    r.ads.next = 'skipped';
    expect(await game.watchAd('free_coins')).toBe(false);
    expect(game.state.coins).toBe(0);
    r.ads.next = 'rewarded';
    const limit = R.AD_LIMITS.perPlacement.free_coins;
    for (let i = 0; i < limit; i++) expect(await game.watchAd('free_coins')).toBe(true);
    expect(game.adOffered('free_coins')).toBe(false);
    expect(game.state.coins).toBe(limit * C.FREE_COINS);
  });

  it('delivers coin packs, and the Market Kit with its card backs once', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('coins_medium');
    await settle(game);
    expect(game.state.coins).toBe(3000);
    await game.purchase('market_kit');
    await settle(game);
    expect(game.state.coins).toBe(4000);
    expect(R.ownsLook(game.state, C.MARKET_KIT_BACK)).toBe(true);
    expect((await game.purchase('market_kit')).status).not.toBe('purchased');
    await settle(game);
    expect(game.state.coins).toBe(4000);
    await game.purchase('canal_collection');
    await settle(game);
    expect(R.LOOKS.every((id) => R.ownsLook(game.state, id))).toBe(true);
  });

  it('shows ad breaks only after a few cleared deals and some minutes, and never after No Ad Breaks', async () => {
    const r = rig();
    const game = await started(r);
    r.clock.advance(10 * 60_000);
    for (let i = 0; i < C.AD_BREAKS_AFTER_WINS - 1; i++) clear(game, 'level');
    expect(await game.naturalBreak()).toBe(false);
    clear(game, 'level');
    expect(await game.naturalBreak()).toBe(true);
    expect(r.ads.interstitials).toBe(1);
    await game.purchase('remove_ads');
    await settle(game);
    r.clock.advance(60 * 60_000);
    expect(game.adBreakAllowed()).toBe(false);
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
    expect(await game.watchAd('free_coins')).toBe(true);
    expect(game.state.coins).toBe(C.FREE_COINS);
  });

  it('gives No Ad Breaks owners the ad rewards without showing ads', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('remove_ads');
    await settle(game);
    expect(await game.watchAd('free_coins')).toBe(true);
    stick(game, 'level');
    expect(await game.watchAd('wild')).toBe(true);
    expect(game.state.coins).toBe(C.FREE_COINS);
    expect(r.ads.rewarded).toEqual([]);
  });

  it('loads a save copied from another phone', async () => {
    const r = rig();
    const game = await started(r);
    const other = createState(T0);
    other.coins = 77;
    other.level = 42;
    expect(await game.importSave(exportSave(saveFormat, other, T0))).toBe(true);
    expect(game.state.coins).toBe(77);
    expect(game.state.level).toBe(42);
  });
});
