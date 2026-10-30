import { ManualClock, MemoryStore, exportSave, localDayKey } from '@game1/engine';
import { TestStore, noStore, type StoreService } from '@game1/platform';
import { FakeAds, manualFrames, settle } from '@game1/shell/testing';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, type GameOptions, type MoveEvent, type SoundName } from '../src/game.js';
import { movesOf } from '../src/sim/board.js';
import * as C from '../src/sim/content.js';
import { MORE_MOVES } from '../src/sim/dive.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat } from '../src/sim/state.js';
import { DAY, T0, dayAfter } from './helpers.js';

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

/** Plays the dive in progress to its goals through the game, the way the bot would, with all the moves it needs. */
function reach(game: Game): void {
  const c = game.state.current;
  if (!c) throw new Error('no dive in progress');
  c.dive.movesLeft = 150;
  for (let i = 0; i < 150 && game.state.current === c; i++) {
    const move = R.hintMove(game.state);
    if (!move || !game.swap(move.from, move.to)) throw new Error('the swap did nothing');
  }
  if (game.state.current) throw new Error('the goals were not reached');
}

/** One swap that does not reach the goals, with the last move. */
function runOut(game: Game): void {
  const c = game.state.current;
  if (!c) throw new Error('no dive in progress');
  c.dive.movesLeft = 1;
  const move = movesOf(c.dive.board)[0];
  if (!move || !game.swap(move.from, move.to) || !R.isStuck(game.state)) throw new Error('the dive is not out of moves');
}

describe('the game', () => {
  it('starts a new game, saves it and continues it after a restart, the dive and all', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    const c = first.startLevel(1);
    const move = c ? movesOf(c.dive.board)[0] : undefined;
    if (!move) throw new Error('no move');
    first.swap(move.from, move.to);
    await first.save();
    const saved = JSON.stringify(first.state);
    first.stop();

    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(JSON.stringify(second.state)).toBe(saved);
    expect(second.state.current?.dive.movesMade).toBe(1);
  });

  it('tells the screens how a move played out, with a sound for it', async () => {
    const r = rig();
    const game = await started(r);
    const events: MoveEvent[] = [];
    game.events.on('move', (e) => events.push(e));
    expect(game.startLevel(2)).toBeNull();
    game.startLevel(1);
    // Two pieces that are not neighbours: nothing happens, and a sound says so.
    expect(game.swap(0, 2)).toBeNull();
    expect(r.sounds).toEqual(['nope']);
    reach(game);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.by === 'swap' && e.played.steps[0]?.kind === 'swap')).toBe(true);
    expect(events.at(-1)?.result).toMatchObject({ level: 1, won: true, stars: 3 });
    expect(r.sounds.at(-1)).toBe('won');
    expect(r.sounds.slice(1, -1).every((name) => ['match', 'special', 'swap'].includes(name))).toBe(true);
    expect(game.state.stars).toEqual([3]);
    expect(game.state.coins).toBe(40);
  });

  it('doubles what a level paid for one rewarded ad', async () => {
    const r = rig();
    const game = await started(r);
    game.startLevel(1);
    reach(game);
    r.ads.next = 'skipped';
    expect(await game.watchAd('double_coins')).toBe(false);
    r.ads.next = 'rewarded';
    expect(await game.watchAd('double_coins')).toBe(true);
    expect(game.state.coins).toBe(80);
    expect(await game.watchAd('double_coins')).toBe(false);
    expect(r.ads.rewarded).toEqual(['double_coins', 'double_coins']);
  });

  it('gives five more moves to a dive that ran out, for an ad or for sand dollars, or ends it', async () => {
    const r = rig();
    const game = await started(r);
    game.startLevel(1);
    expect(game.adOffered('more_moves')).toBe(false);
    runOut(game);
    expect(game.adOffered('more_moves')).toBe(true);
    expect(await game.watchAd('more_moves')).toBe(true);
    expect(game.state.current?.dive.movesLeft).toBe(MORE_MOVES);
    runOut(game);
    expect(game.buyMoreMoves()).toBe(false);
    game.state.coins = C.MORE_MOVES_COST;
    expect(game.buyMoreMoves()).toBe(true);
    expect(game.state.coins).toBe(0);
    runOut(game);
    expect(game.giveUp()).toMatchObject({ won: false, pay: 0 });
    expect(game.state.current).toBeNull();
    expect(game.giveUp()).toBeNull();
    expect(r.sounds.filter((name) => ['claim', 'buy', 'lost'].includes(name))).toEqual(['claim', 'buy', 'lost']);
  });

  it('uses tools from the bag, and fills the bag for an ad or for sand dollars', async () => {
    const r = rig();
    const game = await started(r);
    const events: MoveEvent[] = [];
    game.events.on('move', (e) => events.push(e));
    game.startLevel(1);
    const moves = game.state.current?.dive.movesLeft;
    expect(game.playTool({ tool: 'tide', row: 3 })).not.toBeNull();
    expect(game.playTool({ tool: 'tide', row: 3 })).toBeNull();
    expect(game.state.current?.dive.movesLeft).toBe(moves);
    expect(events.map((e) => e.by)).toEqual(['tide']);
    expect(await game.watchAd('tool', R.slotOfTool('tide'))).toBe(true);
    expect(game.state.tools.tide).toBe(1);
    game.state.coins = C.TOOL_COSTS.tide;
    expect(game.buyTool('tide')).toBe(true);
    expect(game.state.tools.tide).toBe(2);
    expect(r.sounds).toEqual(['tool', 'nope', 'claim', 'buy']);
  });

  it('opens the daily dive once a day', async () => {
    const r = rig();
    const game = await started(r);
    expect(game.openDaily()).toMatchObject({ mode: 'daily', day: DAY });
    reach(game);
    expect(game.state.result).toMatchObject({ mode: 'daily', pay: C.DAILY_COINS, streak: 1 });
    expect(game.openDaily()).toBeNull();
    r.clock.advance(86_400_000);
    expect(game.openDaily()?.day).toBe(dayAfter(DAY));
  });

  it('marks notes as seen', async () => {
    const game = await started(rig());
    expect(R.tipFor(game.state, { mode: 'reef', level: 1, day: null })).toBe('swap');
    expect(game.seeTip('swap')).toBe(true);
    expect(game.seeTip('swap')).toBe(false);
    expect(R.tipFor(game.state, { mode: 'reef', level: 1, day: null })).toBeNull();
  });

  it('sells looks for sand dollars', async () => {
    const r = rig();
    const game = await started(r);
    game.state.coins = C.LOOK_COSTS.sunset;
    expect(game.buyLook('sunset')).toBe(true);
    expect(R.waterInUse(game.state)).toBe('sunset');
    expect(game.chooseLook('sunlit')).toBe(true);
    expect(game.chooseLook('manta')).toBe(false);
    expect(game.buyLook('manta')).toBe(false);
    expect(game.state.coins).toBe(0);
    expect(r.sounds).toEqual(['buy']);
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

describe('ads and purchases', () => {
  it('gives free sand dollars only when the ad network confirms the ad, up to the daily limit', async () => {
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
    expect(r.sounds).toEqual(Array.from({ length: limit }, () => 'claim'));
  });

  it('delivers coin packs, and the Diver’s Kit with its tools and its buddy once', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('coins_medium');
    await settle(game);
    expect(game.state.coins).toBe(3000);
    expect(R.diverKitOffered(game.state)).toBe(true);
    await game.purchase('diver_kit');
    await settle(game);
    expect(game.state.coins).toBe(4000);
    expect(game.state.tools).toEqual({ claw: C.START_TOOLS.claw + 5, tide: C.START_TOOLS.tide + 5, crab: C.START_TOOLS.crab + 5 });
    expect(R.ownsLook(game.state, C.DIVER_KIT_BUDDY)).toBe(true);
    expect((await game.purchase('diver_kit')).status).not.toBe('purchased');
    await settle(game);
    expect(game.state.coins).toBe(4000);
    await game.purchase('reef_collection');
    await settle(game);
    expect(R.LOOKS.every((id) => R.ownsLook(game.state, id))).toBe(true);
  });

  it('shows ad breaks only after a few levels reached and some minutes, and never after No Ad Breaks', async () => {
    const r = rig();
    const game = await started(r);
    r.clock.advance(10 * 60_000);
    for (let n = 1; n < C.AD_BREAKS_AFTER_WINS; n++) {
      game.startLevel(n);
      reach(game);
    }
    expect(await game.naturalBreak()).toBe(false);
    game.startLevel(C.AD_BREAKS_AFTER_WINS);
    reach(game);
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
    game.startLevel(1);
    expect(await game.watchAd('tool', R.slotOfTool('claw'))).toBe(true);
    expect(game.state.tools.claw).toBe(C.START_TOOLS.claw + 1);
    expect(r.ads.rewarded).toEqual([]);
  });

  it('loads a save copied from another phone', async () => {
    const r = rig();
    const game = await started(r);
    const other = createState(T0);
    other.coins = 77;
    other.stars = [3, 2];
    expect(await game.importSave(exportSave(saveFormat, other, T0))).toBe(true);
    expect(game.state.coins).toBe(77);
    expect(R.nextLevel(game.state)).toBe(3);
  });
});
