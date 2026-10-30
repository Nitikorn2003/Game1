import { ManualClock, MemoryStore, exportSave, localDayKey } from '@game1/engine';
import { TestStore, noStore, type StoreService } from '@game1/platform';
import { FakeAds, manualFrames, settle } from '@game1/shell/testing';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, soundOf, type GameOptions, type SoundName } from '../src/game.js';
import * as C from '../src/sim/content.js';
import { MORE_ROOM, dealOf, type Take } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat } from '../src/sim/state.js';
import { DAY, T0, dayAfter, jam } from './helpers.js';

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

/** Clears the counter of the round in progress through the game, along the way its deal was made. */
function clear(game: Game): void {
  const c = game.state.current;
  const level = R.currentLevel(game.state);
  if (!c || !level) throw new Error('no round in progress');
  for (const tile of dealOf(level, c.round.seed).order) {
    if (game.state.current !== c) break;
    if (!game.take(tile)) throw new Error(`tile ${String(tile)} could not be taken`);
  }
  if (game.state.current) throw new Error('the counter was not cleared');
}

/** A tile of the round in progress that can be taken now. */
function free(game: Game): number {
  const tile = R.hintTile(game.state);
  if (tile === null) throw new Error('nothing to take');
  return tile;
}

describe('the game', () => {
  it('starts a new game, saves it and continues it after a restart, the round and all', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    first.startLevel(1);
    expect(first.take(free(first))).not.toBeNull();
    await first.save();
    const saved = JSON.stringify(first.state);
    first.stop();

    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(JSON.stringify(second.state)).toBe(saved);
    expect(second.state.current?.round.tray).toHaveLength(1);
  });

  it('tells the screens how each take played out, with its sound', async () => {
    const r = rig();
    const game = await started(r);
    const took: R.Took[] = [];
    game.events.on('took', (e) => took.push(e));
    expect(game.startLevel(2)).toBeNull();
    // No round: nothing to take, and a sound says so.
    expect(game.take(0)).toBeNull();
    expect(r.sounds).toEqual(['nope']);
    game.startLevel(1);
    clear(game);
    expect(took).toHaveLength(9);
    expect(took.filter((e) => e.take.set)).toHaveLength(3);
    expect(took.at(-1)?.result).toMatchObject({ level: 1, won: true, stars: 3 });
    expect(took.slice(0, -1).every((e) => e.result === null)).toBe(true);
    expect(r.sounds.slice(1)).toEqual(took.map((e) => soundOf(e.take)));
    expect(r.sounds.at(-1)).toBe('won');
    expect(game.state.stars).toEqual([3]);
    expect(game.state.coins).toBe(40);
  });

  it('gives each take the sound of the biggest thing in it', () => {
    const take: Take = { tile: 0, from: 'counter', slot: 0, set: null, sprinkled: 0, opened: [], won: false, stuck: false };
    expect(soundOf(take)).toBe('take');
    expect(soundOf({ ...take, set: [0, 1, 2] })).toBe('set');
    expect(soundOf({ ...take, set: [0, 1, 2], opened: [5] })).toBe('open');
    expect(soundOf({ ...take, set: [0, 1, 2], opened: [5], sprinkled: 1 })).toBe('sprinkle');
    expect(soundOf({ ...take, stuck: true })).toBe('full');
    expect(soundOf({ ...take, set: [0, 1, 2], won: true, sprinkled: 2 })).toBe('won');
  });

  it('doubles what a level paid for one rewarded ad', async () => {
    const r = rig();
    const game = await started(r);
    game.startLevel(1);
    clear(game);
    r.ads.next = 'skipped';
    expect(await game.watchAd('double_coins')).toBe(false);
    r.ads.next = 'rewarded';
    expect(await game.watchAd('double_coins')).toBe(true);
    expect(game.state.coins).toBe(80);
    expect(await game.watchAd('double_coins')).toBe(false);
    expect(r.ads.rewarded).toEqual(['double_coins', 'double_coins']);
  });

  it('makes room on a full tray for an ad or for sugar, and tells the screens what went up to the rack, or ends the round', async () => {
    const r = rig();
    const game = await started(r);
    const rooms: (readonly number[])[] = [];
    game.events.on('room', (moved) => rooms.push(moved));
    game.state.stars = [3, 3];
    game.startLevel(3);
    expect(game.adOffered('more_room')).toBe(false);
    jam(game.state);
    expect(game.adOffered('more_room')).toBe(true);
    expect(await game.watchAd('more_room')).toBe(true);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toHaveLength(MORE_ROOM);
    expect(game.state.current?.round.rack).toEqual(rooms[0]);
    jam(game.state);
    expect(game.buyRoom()).toBe(false);
    game.state.coins = C.MORE_ROOM_COST;
    expect(game.buyRoom()).toBe(true);
    expect(game.state.coins).toBe(0);
    expect(rooms).toHaveLength(2);
    expect(game.state.current?.round.rack).toHaveLength(2 * MORE_ROOM);
    expect(game.giveUp()).toMatchObject({ won: false, pay: 0 });
    expect(game.state.current).toBeNull();
    expect(game.giveUp()).toBeNull();
    expect(r.sounds.filter((name) => ['room', 'buy', 'lost'].includes(name))).toEqual(['room', 'room', 'lost']);
  });

  it('uses tools from the pocket, and fills the pocket for an ad or for sugar', async () => {
    const r = rig();
    const game = await started(r);
    const tools: R.ToolUse[] = [];
    game.events.on('tool', (e) => tools.push(e));
    game.startLevel(1);
    game.state.tools.whisk = 1;
    expect(game.applyTool('whisk')?.whisk?.set).toHaveLength(3);
    expect(game.applyTool('whisk')).toBeNull();
    expect(game.applyTool('spatula')).toBeNull();
    expect(tools.map((e) => e.tool)).toEqual(['whisk']);
    expect(await game.watchAd('tool', R.slotOfTool('whisk'))).toBe(true);
    expect(game.state.tools.whisk).toBe(1);
    game.state.coins = C.TOOL_COSTS.whisk;
    expect(game.buyTool('whisk')).toBe(true);
    expect(game.state.tools.whisk).toBe(2);
    expect(r.sounds).toEqual(['whisk', 'nope', 'nope', 'claim', 'buy']);
  });

  it('ends the round when the whisk clears the counter', async () => {
    const r = rig();
    const game = await started(r);
    const tools: R.ToolUse[] = [];
    game.events.on('tool', (e) => tools.push(e));
    game.startLevel(1);
    game.state.tools.whisk = 3;
    for (let i = 0; i < 3; i++) game.applyTool('whisk');
    expect(game.state.current).toBeNull();
    expect(tools.at(-1)?.result).toMatchObject({ level: 1, won: true, stars: 3 });
    expect(r.sounds).toEqual(['whisk', 'whisk', 'won']);
  });

  it('opens the daily special once a day', async () => {
    const r = rig();
    const game = await started(r);
    expect(game.openDaily()).toMatchObject({ mode: 'daily', day: DAY });
    clear(game);
    expect(game.state.result).toMatchObject({ mode: 'daily', streak: 1 });
    expect(game.openDaily()).toBeNull();
    r.clock.advance(86_400_000);
    expect(game.openDaily()?.day).toBe(dayAfter(DAY));
  });

  it('marks notes as seen', async () => {
    const game = await started(rig());
    expect(R.tipFor(game.state, { mode: 'lane', level: 1, day: null })).toBe('tap');
    expect(game.seeTip('tap')).toBe(true);
    expect(game.seeTip('tap')).toBe(false);
    expect(R.tipFor(game.state, { mode: 'lane', level: 1, day: null })).toBeNull();
  });

  it('sells looks for sugar', async () => {
    const r = rig();
    const game = await started(r);
    game.state.coins = C.LOOK_COSTS.rain;
    expect(game.buyLook('rain')).toBe(true);
    expect(R.seasonInUse(game.state)).toBe('rain');
    expect(game.chooseLook('spring')).toBe(true);
    expect(game.chooseLook('mint')).toBe(false);
    expect(game.buyLook('mint')).toBe(false);
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
  it('gives free sugar only when the ad network confirms the ad, up to the daily limit', async () => {
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

  it('delivers sugar packs, and the Baker’s Kit with its tools and its tiles once', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('coins_medium');
    await settle(game);
    expect(game.state.coins).toBe(3000);
    expect(R.bakerKitOffered(game.state)).toBe(true);
    await game.purchase('baker_kit');
    await settle(game);
    expect(game.state.coins).toBe(4000);
    expect(game.state.tools).toEqual({ spatula: C.START_TOOLS.spatula + 5, rollingpin: C.START_TOOLS.rollingpin + 5, whisk: C.START_TOOLS.whisk + 5 });
    expect(R.ownsLook(game.state, C.BAKER_KIT_TILES)).toBe(true);
    expect((await game.purchase('baker_kit')).status).not.toBe('purchased');
    await settle(game);
    expect(game.state.coins).toBe(4000);
    await game.purchase('lane_collection');
    await settle(game);
    expect(R.LOOKS.every((id) => R.ownsLook(game.state, id))).toBe(true);
  });

  it('shows ad breaks only after a few counters cleared and some minutes, and never after No Ad Breaks', async () => {
    const r = rig();
    const game = await started(r);
    r.clock.advance(10 * 60_000);
    for (let n = 1; n < C.AD_BREAKS_AFTER_WINS; n++) {
      game.startLevel(n);
      clear(game);
    }
    expect(await game.naturalBreak()).toBe(false);
    game.startLevel(C.AD_BREAKS_AFTER_WINS);
    clear(game);
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
    expect(await game.watchAd('tool', R.slotOfTool('spatula'))).toBe(true);
    expect(game.state.tools.spatula).toBe(C.START_TOOLS.spatula + 1);
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
