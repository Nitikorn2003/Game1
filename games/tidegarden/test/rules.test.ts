import { describe, expect, it } from 'vitest';
import { movesOf } from '../src/sim/board.js';
import * as C from '../src/sim/content.js';
import { MORE_MOVES } from '../src/sim/dive.js';
import { levelAt } from '../src/sim/levels.js';
import * as R from '../src/sim/rules.js';
import { createState, type GameState } from '../src/sim/state.js';
import { DAY, T0, dayAfter, playToWin, reachedTo, runOut } from './helpers.js';

const fresh = (): GameState => createState(T0);

describe('the reef', () => {
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
    expect(R.zoneOpen(s, 'shallows')).toBe(true);
    expect(R.zoneOpen(s, 'meadow')).toBe(false);
    expect(R.zoneOpen(reachedTo(fresh(), 13), 'meadow')).toBe(true);
  });

  it('pays for a level reached the first time, and again only for the stars it did not have', () => {
    const s = fresh();
    R.startLevel(s, 1);
    const first = playToWin(s);
    expect(first).toMatchObject({ mode: 'reef', level: 1, won: true, stars: 3, before: 0, pay: C.LEVEL_COINS + 3 * C.STAR_COINS, zone: null });
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
    const move = a ? movesOf(a.dive.board)[0] : undefined;
    if (!move) throw new Error('no move');
    R.swap(s, move.from, move.to);
    expect(R.startLevel(s, 2)).toBe(a);
    expect(a?.dive.movesMade).toBe(1);
    const b = R.startLevel(s, 3);
    expect(b).not.toBe(a);
    expect(s.current).toBe(b);
    expect(s.stats.dives).toBe(2);
  });

  it('gives each try at a level a new board', () => {
    const s = fresh();
    const one = R.startLevel(s, 1)?.dive.board.pieces.map((piece) => piece?.kind);
    R.giveUp(s);
    const two = R.startLevel(s, 1)?.dive.board.pieces.map((piece) => piece?.kind);
    expect(two).not.toEqual(one);
  });

  it('ends a dive given up with nothing paid, and lets it be tried again', () => {
    const s = fresh();
    R.startLevel(s, 1);
    expect(R.giveUp(s)).toMatchObject({ won: false, stars: 0, pay: 0 });
    expect(s.current).toBeNull();
    expect(s.coins).toBe(0);
    expect(s.stars).toEqual([]);
    expect(R.giveUp(s)).toBeNull();
    expect(R.startLevel(s, 1)).not.toBeNull();
  });

  it('brings a zone’s creature home on its last level, with sand dollars and a tool of each kind', () => {
    const s = reachedTo(fresh(), 12);
    expect(R.zoneDone(s, 'shallows')).toBe(false);
    R.startLevel(s, 12);
    const result = playToWin(s);
    expect(result).toMatchObject({ zone: 'shallows', zoneCoins: C.ZONE_COINS });
    expect(s.coins).toBe(result.pay + C.ZONE_COINS);
    expect(s.tools).toEqual({ claw: C.START_TOOLS.claw + 1, tide: C.START_TOOLS.tide + 1, crab: C.START_TOOLS.crab + 1 });
    expect(R.zoneDone(s, 'shallows')).toBe(true);
    expect(R.zoneStars(s, 'shallows')).toBe(36);
    // Reached again, the zone pays nothing more.
    R.startLevel(s, 12);
    expect(playToWin(s)).toMatchObject({ zone: null, zoneCoins: 0, pay: 0 });
  });

  it('goes on past the reef into the open sea', () => {
    const s = reachedTo(fresh(), 97);
    expect(R.levelOpen(s, 97)).toBe(true);
    const c = R.startLevel(s, 97);
    expect(c?.dive.movesLeft).toBe(levelAt(97).moves);
    expect(playToWin(s)).toMatchObject({ level: 97, won: true, pay: 40, zone: null });
    expect(R.nextLevel(s)).toBe(98);
  });
});

describe('moves', () => {
  it('are swaps that work; one that does not takes nothing', () => {
    const s = fresh();
    expect(R.swap(s, 0, 1)).toBeNull();
    const c = R.startLevel(s, 1);
    if (!c) throw new Error('no dive');
    const [move] = movesOf(c.dive.board);
    if (!move) throw new Error('no move');
    // Two pieces that are not neighbours.
    expect(R.canSwap(s, 0, 2)).toBe(false);
    expect(R.swap(s, 0, 2)).toBeNull();
    expect(R.canSwap(s, move.from, move.to)).toBe(true);
    const moved = R.swap(s, move.from, move.to);
    expect(moved?.played.steps[0]?.kind).toBe('swap');
    expect(c.dive.movesLeft).toBe(levelAt(1).moves - 1);
    expect(s.stats.moves).toBe(1);
    expect(s.stats.cleared).toBeGreaterThanOrEqual(3);
    expect(R.hintMove(s)).not.toBeNull();
  });

  it('run out: five more for sand dollars, and a level reached after that has one star', () => {
    const s = fresh();
    R.startLevel(s, 1);
    expect(R.buyMoreMoves(s)).toBe(false);
    runOut(s);
    expect(R.isStuck(s)).toBe(true);
    expect(R.noMoves(s)).toBe(false);
    expect(R.buyMoreMoves(s)).toBe(false);
    s.coins = C.MORE_MOVES_COST;
    expect(R.buyMoreMoves(s)).toBe(true);
    expect(s.coins).toBe(0);
    expect(s.current?.dive.movesLeft).toBe(MORE_MOVES);
    expect(s.stats.continues).toBe(1);
    const c = s.current;
    if (!c) throw new Error('no dive');
    // Played on to the goals, with all the moves it takes: one star all the same.
    expect(playToWin(s)).toMatchObject({ won: true, stars: 1, pay: C.LEVEL_COINS + C.STAR_COINS });
  });
});

describe('tools', () => {
  it('come from the bag and take no move', () => {
    const s = fresh();
    const c = R.startLevel(s, 1);
    if (!c) throw new Error('no dive');
    const moves = c.dive.movesLeft;
    expect(R.playTool(s, { tool: 'claw', cell: 10 })?.played.steps[0]?.kind).toBe('clear');
    expect(s.tools.claw).toBe(C.START_TOOLS.claw - 1);
    expect(R.playTool(s, { tool: 'tide', row: 6 })).not.toBeNull();
    expect(s.tools.tide).toBe(0);
    expect(R.playTool(s, { tool: 'tide', row: 5 })).toBeNull();
    expect(R.playTool(s, { tool: 'crab', from: 0, to: 1 })).not.toBeNull();
    expect(s.tools.crab).toBe(C.START_TOOLS.crab - 1);
    expect(c.dive.movesLeft).toBe(moves);
    expect(s.stats.toolsUsed).toBe(3);
  });

  it('take nothing from the bag where they would do nothing', () => {
    const s = fresh();
    expect(R.playTool(s, { tool: 'claw', cell: 0 })).toBeNull();
    // Level 3 is drawn with gaps in its corners.
    R.startLevel(reachedTo(s, 3), 3);
    expect(R.toolWorks(s, { tool: 'claw', cell: 0 })).toBe(false);
    expect(R.playTool(s, { tool: 'claw', cell: 0 })).toBeNull();
    expect(R.toolWorks(s, { tool: 'tide', row: -1 })).toBe(false);
    expect(R.toolWorks(s, { tool: 'crab', from: 1, to: 3 })).toBe(false);
    expect(s.tools).toEqual(C.START_TOOLS);
  });

  it('can be bought for the bag', () => {
    const s = fresh();
    expect(R.buyTool(s, 'claw')).toBe(false);
    s.coins = C.TOOL_COSTS.claw + C.TOOL_COSTS.tide;
    expect(R.buyTool(s, 'claw')).toBe(true);
    expect(R.buyTool(s, 'tide')).toBe(true);
    expect(s.tools).toMatchObject({ claw: C.START_TOOLS.claw + 1, tide: C.START_TOOLS.tide + 1 });
    expect(s.coins).toBe(0);
    s.coins = 10_000;
    s.tools.crab = C.MAX_TOOLS;
    expect(R.buyTool(s, 'crab')).toBe(false);
  });
});

describe('the daily dive', () => {
  it('is reached once a day, for more each day of a streak', () => {
    const s = fresh();
    expect(R.dailyPay(s, DAY)).toBe(C.DAILY_COINS);
    expect(R.openDaily(s, DAY)).toMatchObject({ mode: 'daily', day: DAY, level: 0 });
    expect(playToWin(s)).toMatchObject({ mode: 'daily', won: true, pay: C.DAILY_COINS, streak: 1 });
    expect(R.dailyDoneToday(s, DAY)).toBe(true);
    expect(R.openDaily(s, DAY)).toBeNull();
    // The stars of the reef are not touched.
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

  it('gives everyone the same board on the first try of a day, and a new one on each try after', () => {
    const a = R.openDaily(fresh(), DAY)?.dive.board.pieces.map((piece) => piece?.kind);
    const s = fresh();
    expect(R.openDaily(s, DAY)?.dive.board.pieces.map((piece) => piece?.kind)).toEqual(a);
    R.giveUp(s);
    expect(R.openDaily(s, DAY)?.dive.board.pieces.map((piece) => piece?.kind)).not.toEqual(a);
    expect(R.openDaily(fresh(), dayAfter(DAY))?.dive.board.pieces.map((piece) => piece?.kind)).not.toEqual(a);
  });

  it('counts a dive started on one day for that day', () => {
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
    expect(R.tipFor(s, { mode: 'reef', level: 1, day: null })).toBe('swap');
    expect(R.tipFor(s, { mode: 'reef', level: 3, day: null })).toBeNull();
    expect(R.tipFor(s, { mode: 'daily', level: 0, day: DAY })).toBeNull();
    expect(R.seeTip(s, 'swap')).toBe(true);
    expect(R.seeTip(s, 'swap')).toBe(false);
    expect(R.tipFor(s, { mode: 'reef', level: 1, day: null })).toBeNull();
    // Reaching the level counts as seeing its note.
    R.startLevel(reachedTo(s, 13), 13);
    expect(R.tipFor(s, { mode: 'reef', level: 13, day: null })).toBe('sand');
    playToWin(s);
    expect(s.tips).toEqual(['swap', 'sand']);
    for (const tip of C.TIPS) expect(R.tipOf(C.TIP_LEVELS[tip])).toBe(tip);
  });
});

describe('ads', () => {
  it('give five more moves only to a dive out of them', () => {
    const s = fresh();
    expect(R.adOffered(s, 'more_moves', DAY, 0)).toBe(false);
    R.startLevel(s, 1);
    expect(R.adOffered(s, 'more_moves', DAY, 0)).toBe(false);
    runOut(s);
    expect(R.adOffered(s, 'more_moves', DAY, 0)).toBe(true);
    expect(R.grantAdReward(s, 'more_moves', T0, DAY, 0)).toBe(true);
    expect(s.current?.dive.movesLeft).toBe(MORE_MOVES);
    expect(R.adOffered(s, 'more_moves', DAY, 0)).toBe(false);
    expect(R.adsLeft(s, 'more_moves', DAY)).toBe(R.AD_LIMITS.perPlacement.more_moves - 1);
  });

  it('give a tool for the bag during a dive, the tool known by its slot', () => {
    const s = fresh();
    expect(R.adOffered(s, 'tool', DAY, R.slotOfTool('tide'))).toBe(false);
    R.startLevel(s, 1);
    expect(R.adOffered(s, 'tool', DAY, R.slotOfTool('tide'))).toBe(true);
    expect(R.adOffered(s, 'tool', DAY, 9)).toBe(false);
    expect(R.grantAdReward(s, 'tool', T0, DAY, R.slotOfTool('tide'))).toBe(true);
    expect(s.tools.tide).toBe(C.START_TOOLS.tide + 1);
    expect(R.toolOfSlot(R.slotOfTool('crab'))).toBe('crab');
  });

  it('double what a level reached paid, once', () => {
    const s = fresh();
    expect(R.adOffered(s, 'double_coins', DAY, 0)).toBe(false);
    R.startLevel(s, 1);
    R.giveUp(s);
    // Nothing to double after a dive given up.
    expect(R.adOffered(s, 'double_coins', DAY, 0)).toBe(false);
    R.startLevel(s, 1);
    playToWin(s);
    expect(R.grantAdReward(s, 'double_coins', T0, DAY, 0)).toBe(true);
    expect(s.coins).toBe(80);
    expect(s.result?.doubled).toBe(true);
    expect(R.grantAdReward(s, 'double_coins', T0, DAY, 0)).toBe(false);
  });

  it('give free sand dollars a few times a day, and no more than fifteen ads in all', () => {
    const s = fresh();
    for (let i = 0; i < R.AD_LIMITS.perPlacement.free_coins; i++) expect(R.grantAdReward(s, 'free_coins', T0, DAY, 0)).toBe(true);
    expect(R.grantAdReward(s, 'free_coins', T0, DAY, 0)).toBe(false);
    expect(s.coins).toBe(R.AD_LIMITS.perPlacement.free_coins * C.FREE_COINS);
    expect(R.adOffered(s, 'free_coins', dayAfter(DAY), 0)).toBe(true);
    R.startLevel(s, 1);
    let watched = R.AD_LIMITS.perPlacement.free_coins;
    while (R.grantAdReward(s, 'tool', T0, DAY, R.slotOfTool('claw'))) watched += 1;
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
  it('add sand dollars and tools, and a refund takes them back without emptying a bag below nothing', () => {
    const s = fresh();
    R.grantPurchase(s, { coins: 1000, claw: 5, tide: 5, crab: 5 });
    expect(s.coins).toBe(1000);
    expect(s.tools).toEqual({ claw: C.START_TOOLS.claw + 5, tide: C.START_TOOLS.tide + 5, crab: C.START_TOOLS.crab + 5 });
    s.tools.claw = 1;
    R.grantPurchase(s, { coins: -1500, claw: -5, tide: -5, crab: -5 });
    expect(s.coins).toBe(-500);
    expect(s.tools).toEqual({ claw: 0, tide: C.START_TOOLS.tide, crab: C.START_TOOLS.crab });
  });

  it('know only the game’s own entitlements', () => {
    const s = fresh();
    R.setEntitlements(s, ['remove_ads', 'something_else', 'diver_kit']);
    expect(s.shop.entitlements).toEqual(['remove_ads', 'diver_kit']);
    expect(R.hasEntitlement(s, 'remove_ads')).toBe(true);
  });
});

describe('looks', () => {
  it('are bought with sand dollars and chosen, and the first of each is free', () => {
    const s = fresh();
    expect(R.waterInUse(s)).toBe('sunlit');
    expect(R.buddyInUse(s)).toBe('clownfish');
    expect(R.buyLook(s, 'sunset')).toBe(false);
    s.coins = C.LOOK_COSTS.sunset;
    expect(R.buyLook(s, 'sunset')).toBe(true);
    expect(R.waterInUse(s)).toBe('sunset');
    expect(R.buyLook(s, 'sunset')).toBe(false);
    expect(R.chooseLook(s, 'sunlit')).toBe(true);
    expect(R.chooseLook(s, 'glow')).toBe(false);
    expect(R.chooseLook(s, 'sunset')).toBe(true);
    expect(R.ownsLook(s, 'clownfish')).toBe(true);
  });

  it('come with the Diver’s Kit and the Reef Collection, and go back with a refund', () => {
    const s = fresh();
    expect(R.diverKitOffered(s)).toBe(true);
    R.setEntitlements(s, ['diver_kit']);
    expect(R.ownsLook(s, C.DIVER_KIT_BUDDY)).toBe(true);
    expect(R.diverKitOffered(s)).toBe(false);
    expect(R.chooseLook(s, C.DIVER_KIT_BUDDY)).toBe(true);
    R.setEntitlements(s, ['reef_collection']);
    expect(R.collectionOffered(s)).toBe(false);
    expect(R.chooseLook(s, 'glow')).toBe(true);
    R.setEntitlements(s, []);
    expect(R.waterInUse(s)).toBe('sunlit');
    expect(R.buddyInUse(s)).toBe('clownfish');
    expect(R.collectionOffered(s)).toBe(true);
  });
});
