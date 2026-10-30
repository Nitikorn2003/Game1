import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import { ALL_CELLS, LAST_ROW, ROWS, cellAt, rowOf } from '../src/sim/hive.js';
import { levelAt } from '../src/sim/levels.js';
import { CLEARED_ROWS, MORE_SHOTS } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import { createState, type GameState } from '../src/sim/state.js';
import { DAY, T0, dayAfter, playToWin, reachedTo, runOut } from './helpers.js';

const fresh = (): GameState => createState(T0);
const colours = (s: GameState) => s.current?.round.board.cells.map((bud) => bud?.colour);

describe('the meadow', () => {
  it('opens one level at a time', () => {
    const s = fresh();
    expect(R.nextLevel(s)).toBe(1);
    expect(R.levelOpen(s, 1)).toBe(true);
    expect(R.levelOpen(s, 2)).toBe(false);
    expect(R.startLevel(s, 2)).toBeNull();
    expect(R.startLevel(s, 0)).toBeNull();
    expect(R.startLevel(s, 1.5)).toBeNull();
    R.startLevel(s, 1);
    playToWin(s);
    expect(R.levelOpen(s, 2)).toBe(true);
    expect(R.zoneOpen(s, 'clover')).toBe(true);
    expect(R.zoneOpen(s, 'sunflower')).toBe(false);
    expect(R.zoneOpen(reachedTo(fresh(), 13), 'sunflower')).toBe(true);
  });

  it('pays for a level reached the first time, and again only for the stars it did not have', () => {
    const s = fresh();
    R.startLevel(s, 1);
    const first = playToWin(s);
    expect(first).toMatchObject({ mode: 'meadow', level: 1, won: true, stars: 3, before: 0, pay: C.LEVEL_COINS + 3 * C.STAR_COINS, zone: null });
    expect(s.coins).toBe(40);
    expect(s.stars).toEqual([3]);
    expect(s.current).toBeNull();
    expect(s.result).toBe(first);
    // Reached with one star before: two stars more pay for themselves.
    s.stars[0] = 1;
    R.startLevel(s, 1);
    expect(s.result).toBeNull();
    expect(playToWin(s)).toMatchObject({ stars: 3, before: 1, pay: 2 * C.STAR_COINS });
    expect(s.stars).toEqual([3]);
    R.startLevel(s, 1);
    expect(playToWin(s).pay).toBe(0);
    expect(s.coins).toBe(60);
    expect(s.stats.won).toBe(3);
    expect(R.totalStars(s)).toBe(3);
  });

  it('keeps a try going: the same level goes on with it, another lets it go', () => {
    const s = reachedTo(fresh(), 3);
    const a = R.startLevel(s, 2);
    expect(R.shoot(s, 90)).not.toBeNull();
    expect(R.startLevel(s, 2)).toBe(a);
    expect(a?.round.shotsMade).toBe(1);
    const b = R.startLevel(s, 3);
    expect(b).not.toBe(a);
    expect(s.current).toBe(b);
    expect(s.stats.rounds).toBe(2);
  });

  it('gives each try at a level new colours', () => {
    const s = fresh();
    R.startLevel(s, 1);
    const one = colours(s);
    R.giveUp(s);
    R.startLevel(s, 1);
    expect(colours(s)).not.toEqual(one);
  });

  it('ends a round given up with nothing paid, and lets it be tried again', () => {
    const s = fresh();
    R.startLevel(s, 1);
    expect(R.giveUp(s)).toMatchObject({ won: false, stars: 0, pay: 0 });
    expect(s.current).toBeNull();
    expect(s.coins).toBe(0);
    expect(s.stars).toEqual([]);
    expect(R.giveUp(s)).toBeNull();
    expect(R.startLevel(s, 1)).not.toBeNull();
  });

  it('makes a zone’s flower bloom on its last level, with honey and a tool of each kind', () => {
    const s = reachedTo(fresh(), 12);
    expect(R.zoneDone(s, 'clover')).toBe(false);
    R.startLevel(s, 12);
    const result = playToWin(s);
    expect(result).toMatchObject({ zone: 'clover', zoneCoins: C.ZONE_COINS });
    expect(s.coins).toBe(result.pay + C.ZONE_COINS);
    expect(s.tools).toEqual({ rainbow: C.START_TOOLS.rainbow + 1, bomb: C.START_TOOLS.bomb + 1, sunbeam: C.START_TOOLS.sunbeam + 1 });
    expect(R.zoneDone(s, 'clover')).toBe(true);
    expect(R.zoneStars(s, 'clover')).toBe(36);
    // Reached again, the zone pays nothing more.
    R.startLevel(s, 12);
    expect(playToWin(s)).toMatchObject({ zone: null, zoneCoins: 0, pay: 0 });
  });

  it('goes on past the meadow into the wild meadow', () => {
    const s = reachedTo(fresh(), 97);
    expect(R.levelOpen(s, 97)).toBe(true);
    const c = R.startLevel(s, 97);
    expect(c?.round.shotsLeft).toBe(levelAt(97).shots);
    expect(playToWin(s)).toMatchObject({ level: 97, won: true, pay: 40, zone: null });
    expect(R.nextLevel(s)).toBe(98);
  });
});

describe('shots', () => {
  it('take one pollen each, and the next pollen comes up', () => {
    const s = fresh();
    expect(R.shoot(s, 90)).toBeNull();
    const c = R.startLevel(s, 1);
    if (!c) throw new Error('no round');
    const next = c.round.queue[1];
    const shot = R.shoot(s, 90);
    expect(shot?.shot.steps[0]?.kind).toBe('stick');
    expect(shot?.shot.kind).toBe('pollen');
    expect(c.round.shotsLeft).toBe(levelAt(1).shots - 1);
    expect(c.round.queue[0]).toBe(next);
    expect(s.stats.shots).toBe(1);
    expect(R.hintAim(s)).not.toBeNull();
  });

  it('swap the pollen in hand for the next, which takes none', () => {
    const s = fresh();
    expect(R.swapPollen(s)).toBe(false);
    const c = R.startLevel(s, 1);
    if (!c) throw new Error('no round');
    c.round.queue = [0, 1];
    expect(R.swapPollen(s)).toBe(true);
    expect(c.round.queue).toEqual([1, 0]);
    expect(c.round.shotsLeft).toBe(levelAt(1).shots);
    c.round.queue = [2, 2];
    expect(R.swapPollen(s)).toBe(false);
  });

  it('run out: five more for honey, and a level reached after that has one star', () => {
    const s = fresh();
    R.startLevel(s, 1);
    expect(R.buyMoreShots(s)).toBe(false);
    runOut(s);
    expect(R.isStuck(s)).toBe(true);
    expect(R.shoot(s, 90)).toBeNull();
    expect(R.swapPollen(s)).toBe(false);
    expect(R.buyMoreShots(s)).toBe(false);
    s.coins = C.MORE_SHOTS_COST;
    expect(R.buyMoreShots(s)).toBe(true);
    expect(s.coins).toBe(0);
    expect(s.current?.round.shotsLeft).toBe(MORE_SHOTS);
    expect(s.stats.continues).toBe(1);
    // Played on to the goals, with all the pollen it takes: one star all the same.
    expect(playToWin(s)).toMatchObject({ won: true, stars: 1, pay: C.LEVEL_COINS + C.STAR_COINS });
  });

  it('stop when a bud reaches Pip; five more pollen blow the lowest buds away, and the bees in them fly free', () => {
    const s = fresh();
    const c = R.startLevel(s, 1);
    if (!c) throw new Error('no round');
    const b = c.round.board;
    // Every bee but one freed already; the last one hangs in a long chain down to Pip.
    const bees = ALL_CELLS.filter((cell) => b.cells[cell]?.bee);
    c.round.freed = bees.length - 1;
    for (const cell of bees) {
      const bud = b.cells[cell];
      if (bud) b.cells[cell] = { ...bud, bee: false };
    }
    for (let row = 5; row <= LAST_ROW; row++) b.cells[cellAt(row, 0)] = { id: 1000 + row, kind: 'bud', colour: 0, bee: row === LAST_ROW, honey: false, butterfly: false };
    expect(R.isStuck(s)).toBe(true);
    expect(R.shoot(s, 90)).toBeNull();
    expect(R.adOffered(s, 'more_shots', DAY, 0)).toBe(true);
    s.coins = C.MORE_SHOTS_COST;
    expect(R.buyMoreShots(s)).toBe(true);
    // The bee at Pip flew free, which reached the goals: the round ended there, with one star.
    expect(s.current).toBeNull();
    expect(s.result).toMatchObject({ won: true, stars: 1 });
    expect(b.cells.filter((bud, cell) => bud && rowOf(cell) >= ROWS - CLEARED_ROWS)).toEqual([]);
  });

  it('shoot the jar’s bomb before the pollen when the jar is full, which takes no pollen', () => {
    const s = fresh();
    const c = R.startLevel(s, 1);
    if (!c) throw new Error('no round');
    c.round.shotsLeft = 0;
    c.round.bomb = true;
    expect(R.isStuck(s)).toBe(false);
    expect(R.shoot(s, 90)?.shot.kind).toBe('jar');
    expect(c.round.bomb).toBe(false);
    expect(c.round.shotsLeft).toBe(0);
    expect(R.isStuck(s)).toBe(true);
  });
});

describe('tools', () => {
  it('come from the pouch and take no pollen', () => {
    const s = fresh();
    const c = R.startLevel(s, 1);
    if (!c) throw new Error('no round');
    const shots = c.round.shotsLeft;
    expect(R.shoot(s, 80, 'rainbow')?.shot.kind).toBe('rainbow');
    expect(s.tools.rainbow).toBe(C.START_TOOLS.rainbow - 1);
    expect(R.shoot(s, 100, 'bomb')?.shot.kind).toBe('bomb');
    expect(s.tools.bomb).toBe(C.START_TOOLS.bomb - 1);
    expect(R.shoot(s, 90, 'sunbeam')?.shot.cell).toBeNull();
    expect(s.tools.sunbeam).toBe(0);
    expect(R.canShoot(s, 'sunbeam')).toBe(false);
    expect(R.shoot(s, 90, 'sunbeam')).toBeNull();
    expect(c.round.shotsLeft).toBe(shots);
    expect(c.round.shotsMade).toBe(0);
    expect(s.stats.toolsUsed).toBe(3);
  });

  it('can be bought for the pouch', () => {
    const s = fresh();
    expect(R.buyTool(s, 'rainbow')).toBe(false);
    s.coins = C.TOOL_COSTS.rainbow + C.TOOL_COSTS.bomb;
    expect(R.buyTool(s, 'rainbow')).toBe(true);
    expect(R.buyTool(s, 'bomb')).toBe(true);
    expect(s.tools).toMatchObject({ rainbow: C.START_TOOLS.rainbow + 1, bomb: C.START_TOOLS.bomb + 1 });
    expect(s.coins).toBe(0);
    s.coins = 10_000;
    s.tools.sunbeam = C.MAX_TOOLS;
    expect(R.buyTool(s, 'sunbeam')).toBe(false);
  });
});

describe('the daily meadow', () => {
  it('is reached once a day, for more each day of a streak', () => {
    const s = fresh();
    expect(R.dailyPay(s, DAY)).toBe(C.DAILY_COINS);
    expect(R.openDaily(s, DAY)).toMatchObject({ mode: 'daily', day: DAY, level: 0 });
    expect(playToWin(s)).toMatchObject({ mode: 'daily', won: true, pay: C.DAILY_COINS, streak: 1 });
    expect(R.dailyDoneToday(s, DAY)).toBe(true);
    expect(R.openDaily(s, DAY)).toBeNull();
    // The stars of the meadow are not touched.
    expect(s.stars).toEqual([]);
    const next = dayAfter(DAY);
    expect(R.dailyStreak(s, next)).toBe(1);
    expect(R.dailyPay(s, next)).toBe(C.DAILY_COINS + C.STREAK_COINS);
    R.openDaily(s, next);
    expect(playToWin(s)).toMatchObject({ pay: C.DAILY_COINS + C.STREAK_COINS, streak: 2 });
    // A day missed ends the streak.
    const later = dayAfter(DAY, 3);
    expect(R.dailyStreak(s, later)).toBe(0);
    R.openDaily(s, later);
    expect(playToWin(s)).toMatchObject({ pay: C.DAILY_COINS, streak: 1 });
    expect(s.daily.bestStreak).toBe(2);
    expect(s.stats.dailies).toBe(3);
  });

  it('pays at most five days of streak more', () => {
    const s = fresh();
    s.daily = { day: null, tries: 0, lastDone: DAY, streak: 9, bestStreak: 9 };
    expect(R.dailyPay(s, dayAfter(DAY))).toBe(C.DAILY_COINS + C.STREAK_DAYS * C.STREAK_COINS);
  });

  it('gives everyone the same colours on the first try of a day, and new ones on each try after', () => {
    const first = fresh();
    R.openDaily(first, DAY);
    const s = fresh();
    R.openDaily(s, DAY);
    expect(colours(s)).toEqual(colours(first));
    R.giveUp(s);
    R.openDaily(s, DAY);
    expect(colours(s)).not.toEqual(colours(first));
  });

  it('counts a round started on one day for that day', () => {
    const s = fresh();
    R.openDaily(s, DAY);
    // Reached after midnight.
    expect(playToWin(s).streak).toBe(1);
    expect(s.daily.lastDone).toBe(DAY);
  });
});

describe('notes on what is new', () => {
  it('show at the first level of each new thing until seen', () => {
    const s = fresh();
    expect(R.tipFor(s, { mode: 'meadow', level: 1, day: null })).toBe('aim');
    expect(R.tipFor(s, { mode: 'meadow', level: 4, day: null })).toBeNull();
    expect(R.tipFor(s, { mode: 'daily', level: 0, day: DAY })).toBeNull();
    expect(R.seeTip(s, 'aim')).toBe(true);
    expect(R.seeTip(s, 'aim')).toBe(false);
    expect(R.tipFor(s, { mode: 'meadow', level: 1, day: null })).toBeNull();
    // Reaching the level counts as seeing its note.
    R.startLevel(reachedTo(s, 13), 13);
    expect(R.tipFor(s, { mode: 'meadow', level: 13, day: null })).toBe('top');
    playToWin(s);
    expect(s.tips).toEqual(['aim', 'top']);
    for (const tip of C.TIPS) expect(R.tipOf(C.TIP_LEVELS[tip])).toBe(tip);
  });
});

describe('ads', () => {
  it('give five more pollen only to a round out of them', () => {
    const s = fresh();
    expect(R.adOffered(s, 'more_shots', DAY, 0)).toBe(false);
    R.startLevel(s, 1);
    expect(R.adOffered(s, 'more_shots', DAY, 0)).toBe(false);
    runOut(s);
    expect(R.adOffered(s, 'more_shots', DAY, 0)).toBe(true);
    expect(R.grantAdReward(s, 'more_shots', T0, DAY, 0)).toBe(true);
    expect(s.current?.round.shotsLeft).toBe(MORE_SHOTS);
    expect(R.adOffered(s, 'more_shots', DAY, 0)).toBe(false);
    expect(R.adsLeft(s, 'more_shots', DAY)).toBe(R.AD_LIMITS.perPlacement.more_shots - 1);
  });

  it('give a tool for the pouch during a round, the tool known by its slot', () => {
    const s = fresh();
    expect(R.adOffered(s, 'tool', DAY, R.slotOfTool('bomb'))).toBe(false);
    R.startLevel(s, 1);
    expect(R.adOffered(s, 'tool', DAY, R.slotOfTool('bomb'))).toBe(true);
    expect(R.adOffered(s, 'tool', DAY, 9)).toBe(false);
    expect(R.grantAdReward(s, 'tool', T0, DAY, R.slotOfTool('bomb'))).toBe(true);
    expect(s.tools.bomb).toBe(C.START_TOOLS.bomb + 1);
    expect(R.toolOfSlot(R.slotOfTool('sunbeam'))).toBe('sunbeam');
  });

  it('double what a level reached paid, once', () => {
    const s = fresh();
    expect(R.adOffered(s, 'double_coins', DAY, 0)).toBe(false);
    R.startLevel(s, 1);
    R.giveUp(s);
    // Nothing to double after a round given up.
    expect(R.adOffered(s, 'double_coins', DAY, 0)).toBe(false);
    R.startLevel(s, 1);
    playToWin(s);
    expect(R.grantAdReward(s, 'double_coins', T0, DAY, 0)).toBe(true);
    expect(s.coins).toBe(80);
    expect(s.result?.doubled).toBe(true);
    expect(R.grantAdReward(s, 'double_coins', T0, DAY, 0)).toBe(false);
  });

  it('give free honey a few times a day, and no more than fifteen ads in all', () => {
    const s = fresh();
    for (let i = 0; i < R.AD_LIMITS.perPlacement.free_coins; i++) expect(R.grantAdReward(s, 'free_coins', T0, DAY, 0)).toBe(true);
    expect(R.grantAdReward(s, 'free_coins', T0, DAY, 0)).toBe(false);
    expect(s.coins).toBe(R.AD_LIMITS.perPlacement.free_coins * C.FREE_COINS);
    expect(R.adOffered(s, 'free_coins', dayAfter(DAY), 0)).toBe(true);
    R.startLevel(s, 1);
    let watched = R.AD_LIMITS.perPlacement.free_coins;
    while (R.grantAdReward(s, 'tool', T0, DAY, R.slotOfTool('rainbow'))) watched += 1;
    expect(watched).toBe(R.AD_LIMITS.perPlacement.free_coins + R.AD_LIMITS.perPlacement.tool);
    expect(R.AD_LIMITS.total).toBe(15);
  });

  it('start breaks only after a few levels reached', () => {
    const s = fresh();
    expect(R.adBreaksEarned(s)).toBe(false);
    s.stats.won = C.AD_BREAKS_AFTER_WINS;
    expect(R.adBreaksEarned(s)).toBe(true);
  });
});

describe('purchases', () => {
  it('add honey and tools, and a refund takes them back without emptying a pouch below nothing', () => {
    const s = fresh();
    R.grantPurchase(s, { coins: 1000, rainbow: 5, bomb: 5, sunbeam: 5 });
    expect(s.coins).toBe(1000);
    expect(s.tools).toEqual({ rainbow: C.START_TOOLS.rainbow + 5, bomb: C.START_TOOLS.bomb + 5, sunbeam: C.START_TOOLS.sunbeam + 5 });
    s.tools.rainbow = 1;
    R.grantPurchase(s, { coins: -1500, rainbow: -5, bomb: -5, sunbeam: -5 });
    expect(s.coins).toBe(-500);
    expect(s.tools).toEqual({ rainbow: 0, bomb: C.START_TOOLS.bomb, sunbeam: C.START_TOOLS.sunbeam });
  });

  it('know only the game’s own entitlements', () => {
    const s = fresh();
    R.setEntitlements(s, ['remove_ads', 'something_else', 'keeper_kit']);
    expect(s.shop.entitlements).toEqual(['remove_ads', 'keeper_kit']);
    expect(R.hasEntitlement(s, 'remove_ads')).toBe(true);
  });
});

describe('looks', () => {
  it('are bought with honey and chosen, and the first of each is free', () => {
    const s = fresh();
    expect(R.skyInUse(s)).toBe('morning');
    expect(R.hatInUse(s)).toBe('leaf');
    expect(R.buyLook(s, 'sunset')).toBe(false);
    s.coins = C.LOOK_COSTS.sunset;
    expect(R.buyLook(s, 'sunset')).toBe(true);
    expect(R.skyInUse(s)).toBe('sunset');
    expect(R.buyLook(s, 'sunset')).toBe(false);
    expect(R.chooseLook(s, 'morning')).toBe(true);
    expect(R.chooseLook(s, 'starry')).toBe(false);
    expect(R.chooseLook(s, 'sunset')).toBe(true);
    expect(R.ownsLook(s, 'leaf')).toBe(true);
  });

  it('come with the Keeper’s Kit and the Meadow Collection, and go back with a refund', () => {
    const s = fresh();
    expect(R.keeperKitOffered(s)).toBe(true);
    R.setEntitlements(s, ['keeper_kit']);
    expect(R.ownsLook(s, C.KEEPER_KIT_HAT)).toBe(true);
    expect(R.keeperKitOffered(s)).toBe(false);
    expect(R.chooseLook(s, C.KEEPER_KIT_HAT)).toBe(true);
    R.setEntitlements(s, ['meadow_collection']);
    expect(R.collectionOffered(s)).toBe(false);
    expect(R.chooseLook(s, 'starry')).toBe(true);
    R.setEntitlements(s, []);
    expect(R.skyInUse(s)).toBe('morning');
    expect(R.hatInUse(s)).toBe('leaf');
    expect(R.collectionOffered(s)).toBe(true);
  });
});
