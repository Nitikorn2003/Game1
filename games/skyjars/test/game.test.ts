import { ManualClock, MemoryStore, exportSave, localDayKey } from '@game1/engine';
import { TestStore, noStore, type StoreService } from '@game1/platform';
import { FakeAds, manualFrames, settle } from '@game1/shell/testing';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, type GameOptions, type PourEvent, type SoundName } from '../src/game.js';
import * as C from '../src/sim/content.js';
import * as J from '../src/sim/jars.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat } from '../src/sim/state.js';
import { T0 } from './helpers.js';

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

/** Solves the shelf in a mode through the game, the way a player would tap it. */
function solve(game: Game, mode: C.Mode): void {
  const shelf = game.open(mode);
  if (!shelf) throw new Error('no shelf');
  const solution = J.solve(R.puzzleOf(shelf));
  if (!solution) throw new Error('no solution');
  for (const [from, to] of solution.moves) if (!game.pour(mode, from, to)) throw new Error('pour refused');
}

/** Two jars that block each other: no pour is left. */
const STUCK: J.Jar[] = [
  [0, 1],
  [1, 0],
];

function stick(game: Game, mode: C.Mode): void {
  const shelf = game.open(mode);
  if (!shelf) throw new Error('no shelf');
  shelf.capacity = 2;
  shelf.start = STUCK.map((jar) => [...jar]);
  shelf.jars = STUCK.map((jar) => [...jar]);
}

describe('the game', () => {
  it('starts a new game, saves it and continues it after a restart', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    solve(first, 'level');
    const shelf = first.open('level');
    const hint = shelf && R.findHint(shelf);
    if (!hint) throw new Error('no hint');
    first.pour('level', hint[0], hint[1]);
    await first.save();
    const saved = JSON.stringify(first.state);
    expect(first.state.level).toBe(2);
    expect(first.state.shelves.level?.history).toHaveLength(1);
    first.stop();

    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(JSON.stringify(second.state)).toBe(saved);
  });

  it('tells the screens what a pour did, with a sound for it', async () => {
    const r = rig();
    const game = await started(r);
    const events: PourEvent[] = [];
    game.events.on('pour', (e) => events.push(e));
    game.open('level');
    game.pick();
    expect(game.pour('level', 2, 0)).toBeNull();
    expect(game.pour('level', 0, 2)?.n).toBe(1);
    expect(game.pour('level', 1, 0)?.filled).toBe(true);
    expect(game.pour('level', 2, 1)?.result?.level).toBe(1);
    expect(events.map((e) => [e.from, e.to, e.n])).toEqual([
      [0, 2, 1],
      [1, 0, 1],
      [2, 1, 1],
    ]);
    expect(events[2]?.result?.clean).toBe(true);
    expect(r.sounds).toEqual(['pick', 'nope', 'pour', 'fill', 'solved']);
  });

  it('solves into a result that one rewarded ad doubles', async () => {
    const r = rig();
    const game = await started(r);
    solve(game, 'level');
    const result = game.state.result;
    expect(result?.stardust).toBe(C.levelStardust(1) + C.CLEAN_BONUS);
    const stardust = game.state.stardust;
    r.ads.next = 'skipped';
    expect(await game.watchAd('double_stardust')).toBe(false);
    r.ads.next = 'rewarded';
    expect(await game.watchAd('double_stardust')).toBe(true);
    expect(game.state.stardust).toBe(stardust + (result?.stardust ?? 0));
    expect(await game.watchAd('double_stardust')).toBe(false);
    expect(r.ads.rewarded).toEqual(['double_stardust', 'double_stardust']);
  });

  it('gives a tool for a rewarded ad to the shelf it was watched for', async () => {
    const r = rig();
    const game = await started(r);
    game.open('level');
    stick(game, 'daily');
    expect(game.adOffered('extra_jar', R.slotOf('daily'))).toBe(true);
    expect(await game.watchAd('extra_jar', R.slotOf('daily'))).toBe(true);
    expect(game.state.shelves.daily?.jars).toHaveLength(3);
    expect(game.state.shelves.level?.extraJar).toBe(false);
    expect(R.stuck(game.state, 'daily')).toBe(false);
    expect(game.adOffered('hint', R.slotOf('daily'))).toBe(true);
    expect(await game.watchAd('hint', R.slotOf('daily'))).toBe(true);
    expect(game.state.shelves.daily?.hint).not.toBeNull();
    expect(r.sounds).toEqual(['claim', 'hint']);
  });

  it('uses the tools for stardust and refuses them without', async () => {
    const r = rig();
    const game = await started(r);
    stick(game, 'level');
    expect(game.buyTool('level', 'extraJar')).toBe(false);
    game.state.stardust = 100;
    expect(game.toolOffered('level', 'hint')).toBe(false);
    expect(game.buyTool('level', 'extraJar')).toBe(true);
    expect(game.toolOffered('level', 'hint')).toBe(true);
    expect(game.buyTool('level', 'hint')).toBe(true);
    expect(game.state.stardust).toBe(100 - C.TOOL_COSTS.extraJar - C.TOOL_COSTS.hint);
    expect(r.sounds).toEqual(['buy', 'hint']);
  });

  it('undoes and restarts a shelf', async () => {
    const r = rig();
    const game = await started(r);
    game.open('level');
    game.pour('level', 0, 2);
    expect(game.undo('level')).toBe(true);
    expect(game.undo('level')).toBe(false);
    game.pour('level', 0, 2);
    expect(game.restart('level')).toBe(true);
    expect(game.state.shelves.level?.undosLeft).toBe(C.UNDOS_PER_SHELF);
  });

  it('sells looks for stardust', async () => {
    const r = rig();
    const game = await started(r);
    game.state.stardust = C.LOOK_COSTS.moonrise;
    expect(game.buyLook('moonrise')).toBe(true);
    expect(R.skyInUse(game.state)).toBe('moonrise');
    expect(game.chooseLook('twilight')).toBe(true);
    expect(game.chooseLook('crystal')).toBe(false);
    expect(game.state.stardust).toBe(0);
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
  it('gives free stardust only when the ad network confirms the ad, up to the daily limit', async () => {
    const r = rig();
    const game = await started(r);
    r.ads.next = 'skipped';
    expect(await game.watchAd('free_stardust')).toBe(false);
    expect(game.state.stardust).toBe(0);
    r.ads.next = 'rewarded';
    const limit = R.AD_LIMITS.perPlacement.free_stardust;
    for (let i = 0; i < limit; i++) expect(await game.watchAd('free_stardust')).toBe(true);
    expect(game.adOffered('free_stardust')).toBe(false);
    expect(game.state.stardust).toBe(limit * C.FREE_STARDUST);
  });

  it('delivers stardust packs, and the Night Kit with its jars once', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('stardust_medium');
    await settle(game);
    expect(game.state.stardust).toBe(600);
    await game.purchase('night_kit');
    await settle(game);
    expect(game.state.stardust).toBe(900);
    expect(R.ownsLook(game.state, 'lantern')).toBe(true);
    expect((await game.purchase('night_kit')).status).not.toBe('purchased');
    await settle(game);
    expect(game.state.stardust).toBe(900);
    await game.purchase('sky_collection');
    await settle(game);
    expect(R.LOOKS.every((id) => R.ownsLook(game.state, id))).toBe(true);
  });

  it('shows ad breaks only after a few levels and some minutes, and never after No Ad Breaks', async () => {
    const r = rig();
    const game = await started(r);
    r.clock.advance(10 * 60_000);
    for (let i = 0; i < C.AD_BREAKS_AFTER_LEVELS - 1; i++) solve(game, 'level');
    expect(await game.naturalBreak()).toBe(false);
    solve(game, 'level');
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
    expect(await game.watchAd('free_stardust')).toBe(true);
    expect(game.state.stardust).toBe(C.FREE_STARDUST);
  });

  it('gives No Ad Breaks owners the ad rewards without showing ads', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('remove_ads');
    await settle(game);
    expect(await game.watchAd('free_stardust')).toBe(true);
    stick(game, 'level');
    expect(await game.watchAd('extra_jar')).toBe(true);
    expect(game.state.stardust).toBe(C.FREE_STARDUST);
    expect(r.ads.rewarded).toEqual([]);
  });

  it('loads a save copied from another phone', async () => {
    const r = rig();
    const game = await started(r);
    const other = createState(T0);
    other.stardust = 77;
    other.level = 42;
    expect(await game.importSave(exportSave(saveFormat, other, T0))).toBe(true);
    expect(game.state.stardust).toBe(77);
    expect(game.state.level).toBe(42);
  });
});
