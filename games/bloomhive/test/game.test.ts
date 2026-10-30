import { ManualClock, MemoryStore, exportSave, localDayKey } from '@game1/engine';
import { TestStore, noStore, type StoreService } from '@game1/platform';
import { FakeAds, manualFrames, settle } from '@game1/shell/testing';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, soundOf, type GameOptions, type ShotEvent, type SoundName } from '../src/game.js';
import * as C from '../src/sim/content.js';
import { ALL_CELLS, LAST_ROW, cellAt } from '../src/sim/hive.js';
import { MORE_SHOTS, type Shot, type Step } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type RoundResult } from '../src/sim/state.js';
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

/** Plays the round in progress to its goals through the game, the way the bot would, with all the pollen it needs. */
function reach(game: Game): void {
  const c = game.state.current;
  if (!c) throw new Error('no round in progress');
  c.round.shotsLeft = 200;
  for (let i = 0; i < 400 && game.state.current === c; i++) {
    const aim = R.hintAim(game.state);
    if (!aim) throw new Error('no shot to take');
    if (aim.swap) game.swapPollen();
    if (!game.shoot(aim.angle)) throw new Error('the shot did nothing');
  }
  if (game.state.current) throw new Error('the goals were not reached');
}

/** Leaves the round in progress out of pollen. */
function runOut(game: Game): void {
  const c = game.state.current;
  if (!c) throw new Error('no round in progress');
  c.round.shotsLeft = 0;
  c.round.bomb = false;
  if (!R.isStuck(game.state)) throw new Error('the round is not out of pollen');
}

describe('the game', () => {
  it('starts a new game, saves it and continues it after a restart, the round and all', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    first.startLevel(1);
    expect(first.shoot(90)).not.toBeNull();
    await first.save();
    const saved = JSON.stringify(first.state);
    first.stop();

    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(JSON.stringify(second.state)).toBe(saved);
    expect(second.state.current?.round.shotsMade).toBe(1);
  });

  it('tells the screens how a shot played out, and plays its sound when it lands', async () => {
    const r = rig();
    const game = await started(r);
    const events: ShotEvent[] = [];
    game.events.on('shot', (e) => events.push(e));
    expect(game.startLevel(2)).toBeNull();
    // No round: nothing to shoot, and a sound says so.
    expect(game.shoot(90)).toBeNull();
    expect(r.sounds).toEqual(['nope']);
    game.startLevel(1);
    reach(game);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.shot.kind === 'pollen' && e.shot.steps[0]?.kind === 'stick')).toBe(true);
    expect(events.at(-1)?.result).toMatchObject({ level: 1, won: true, stars: 3 });
    expect(events.slice(0, -1).every((e) => e.result === null)).toBe(true);
    // Each shot whooshes off; the board plays where it lands.
    expect(r.sounds.slice(1).every((name) => name === 'shoot' || name === 'swap')).toBe(true);
    const last = events.at(-1);
    if (!last) throw new Error('no shot');
    game.landed(last.shot);
    expect(r.sounds.at(-1)).toBe('won');
    expect(game.state.stars).toEqual([3]);
    expect(game.state.coins).toBe(40);
  });

  it('gives each shot the sound of the biggest thing in it', () => {
    const shot: Shot = { kind: 'pollen', colour: 0, points: [], cell: 0, steps: [], freed: 0, filled: false, won: false, stuck: false };
    const pop: Step = { kind: 'pop', cells: [], popped: [{ cell: 0, bud: { id: 1, kind: 'bud', colour: 0, bee: false, honey: false, butterfly: false } }], fallen: [], melted: [], changed: [] };
    expect(soundOf(shot)).toBe('stick');
    expect(soundOf({ ...shot, steps: [pop] })).toBe('pop');
    expect(soundOf({ ...shot, steps: [pop], filled: true })).toBe('jar');
    expect(soundOf({ ...shot, steps: [pop], filled: true, freed: 1 })).toBe('bee');
    expect(soundOf({ ...shot, won: true, freed: 1 })).toBe('won');
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

  it('gives five more pollen to a round that ran out, for an ad or for honey, or ends it', async () => {
    const r = rig();
    const game = await started(r);
    game.startLevel(1);
    expect(game.adOffered('more_shots')).toBe(false);
    runOut(game);
    expect(game.adOffered('more_shots')).toBe(true);
    expect(await game.watchAd('more_shots')).toBe(true);
    expect(game.state.current?.round.shotsLeft).toBe(MORE_SHOTS);
    runOut(game);
    expect(game.buyMoreShots()).toBe(false);
    game.state.coins = C.MORE_SHOTS_COST;
    expect(game.buyMoreShots()).toBe(true);
    expect(game.state.coins).toBe(0);
    runOut(game);
    expect(game.giveUp()).toMatchObject({ won: false, pay: 0 });
    expect(game.state.current).toBeNull();
    expect(game.giveUp()).toBeNull();
    expect(r.sounds.filter((name) => ['claim', 'buy', 'lost'].includes(name))).toEqual(['claim', 'buy', 'lost']);
  });

  it('ends the round there and then when five more pollen blow away the last bee in the way', async () => {
    const r = rig();
    const game = await started(r);
    const ended: RoundResult[] = [];
    game.events.on('ended', (e) => ended.push(e));
    const c = game.startLevel(1);
    if (!c) throw new Error('no round');
    const b = c.round.board;
    const bees = ALL_CELLS.filter((cell) => b.cells[cell]?.bee);
    c.round.freed = bees.length - 1;
    for (const cell of bees) {
      const bud = b.cells[cell];
      if (bud) b.cells[cell] = { ...bud, bee: false };
    }
    for (let row = 5; row <= LAST_ROW; row++) b.cells[cellAt(row, 0)] = { id: 1000 + row, kind: 'bud', colour: 0, bee: row === LAST_ROW, honey: false, butterfly: false };
    expect(R.isStuck(game.state)).toBe(true);
    expect(await game.watchAd('more_shots')).toBe(true);
    expect(game.state.current).toBeNull();
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ level: 1, won: true, stars: 1 });
    expect(r.sounds.slice(-2)).toEqual(['claim', 'won']);
  });

  it('shoots tools from the pouch, and fills the pouch for an ad or for honey', async () => {
    const r = rig();
    const game = await started(r);
    const events: ShotEvent[] = [];
    game.events.on('shot', (e) => events.push(e));
    game.startLevel(1);
    const shots = game.state.current?.round.shotsLeft;
    expect(game.shoot(90, 'sunbeam')).not.toBeNull();
    expect(game.shoot(90, 'sunbeam')).toBeNull();
    expect(game.state.current?.round.shotsLeft).toBe(shots);
    expect(events.map((e) => e.shot.kind)).toEqual(['sunbeam']);
    expect(await game.watchAd('tool', R.slotOfTool('sunbeam'))).toBe(true);
    expect(game.state.tools.sunbeam).toBe(1);
    game.state.coins = C.TOOL_COSTS.sunbeam;
    expect(game.buyTool('sunbeam')).toBe(true);
    expect(game.state.tools.sunbeam).toBe(2);
    expect(r.sounds).toEqual(['tool', 'nope', 'claim', 'buy']);
  });

  it('swaps the pollen in hand for the next', async () => {
    const r = rig();
    const game = await started(r);
    const c = game.startLevel(1);
    if (!c) throw new Error('no round');
    c.round.queue = [0, 1];
    expect(game.swapPollen()).toBe(true);
    expect(c.round.queue).toEqual([1, 0]);
    c.round.queue = [1, 1];
    expect(game.swapPollen()).toBe(false);
    expect(r.sounds).toEqual(['swap']);
  });

  it('opens the daily meadow once a day', async () => {
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
    expect(R.tipFor(game.state, { mode: 'meadow', level: 1, day: null })).toBe('aim');
    expect(game.seeTip('aim')).toBe(true);
    expect(game.seeTip('aim')).toBe(false);
    expect(R.tipFor(game.state, { mode: 'meadow', level: 1, day: null })).toBeNull();
  });

  it('sells looks for honey', async () => {
    const r = rig();
    const game = await started(r);
    game.state.coins = C.LOOK_COSTS.sunset;
    expect(game.buyLook('sunset')).toBe(true);
    expect(R.skyInUse(game.state)).toBe('sunset');
    expect(game.chooseLook('morning')).toBe(true);
    expect(game.chooseLook('beanie')).toBe(false);
    expect(game.buyLook('beanie')).toBe(false);
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
  it('gives free honey only when the ad network confirms the ad, up to the daily limit', async () => {
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

  it('delivers honey packs, and the Keeper’s Kit with its tools and its hat once', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('coins_medium');
    await settle(game);
    expect(game.state.coins).toBe(3000);
    expect(R.keeperKitOffered(game.state)).toBe(true);
    await game.purchase('keeper_kit');
    await settle(game);
    expect(game.state.coins).toBe(4000);
    expect(game.state.tools).toEqual({ rainbow: C.START_TOOLS.rainbow + 5, bomb: C.START_TOOLS.bomb + 5, sunbeam: C.START_TOOLS.sunbeam + 5 });
    expect(R.ownsLook(game.state, C.KEEPER_KIT_HAT)).toBe(true);
    expect((await game.purchase('keeper_kit')).status).not.toBe('purchased');
    await settle(game);
    expect(game.state.coins).toBe(4000);
    await game.purchase('meadow_collection');
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
    expect(await game.watchAd('tool', R.slotOfTool('rainbow'))).toBe(true);
    expect(game.state.tools.rainbow).toBe(C.START_TOOLS.rainbow + 1);
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
