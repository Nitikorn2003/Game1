import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import { levelAt } from '../src/sim/levels.js';
import { MORE_ROOM, dealOf, takeable } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import { createState, type GameState, type RoundResult } from '../src/sim/state.js';
import { DAY, T0, dayAfter, jam, pastriesLeft, playToWin, reachedTo, whiskToWin } from './helpers.js';

const fresh = (): GameState => createState(T0);
const kinds = (s: GameState) => s.current?.round.kinds;
/** What a round paid besides its sprinkles. */
const paid = (r: RoundResult | null) => (r ? r.pay - r.sprinkles : 0);

/** A tile of the round in progress that can be taken now. */
function free(s: GameState): number {
  const c = s.current;
  const level = R.currentLevel(s);
  if (!c || !level) throw new Error('no round in progress');
  const tile = takeable(c.round, level).indexOf(true);
  if (tile < 0) throw new Error('nothing to take');
  return tile;
}

describe('the lane', () => {
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
    expect(R.zoneOpen(s, 'bread')).toBe(true);
    expect(R.zoneOpen(s, 'cafe')).toBe(false);
    expect(R.zoneOpen(reachedTo(fresh(), 13), 'cafe')).toBe(true);
  });

  it('pays for a level cleared the first time, and again only for the stars it did not have', () => {
    const s = fresh();
    R.startLevel(s, 1);
    const first = playToWin(s);
    expect(first).toMatchObject({ mode: 'lane', level: 1, won: true, stars: 3, before: 0, pay: C.LEVEL_COINS + 3 * C.STAR_COINS, zone: null });
    expect(s.coins).toBe(40);
    expect(s.stars).toEqual([3]);
    expect(s.current).toBeNull();
    expect(s.result).toBe(first);
    // Cleared with one star before: two stars more pay for themselves.
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
    expect(R.take(s, free(s))).not.toBeNull();
    expect(R.startLevel(s, 2)).toBe(a);
    expect(a?.round.tray).toHaveLength(1);
    const b = R.startLevel(s, 3);
    expect(b).not.toBe(a);
    expect(s.current).toBe(b);
    expect(s.stats.rounds).toBe(2);
  });

  it('deals each try at a level anew', () => {
    const s = reachedTo(fresh(), 3);
    R.startLevel(s, 3);
    const one = kinds(s);
    R.giveUp(s);
    R.startLevel(s, 3);
    expect(kinds(s)).not.toEqual(one);
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

  it('opens a shop on the lane on its last level, with sugar and a tool of each kind', () => {
    const s = reachedTo(fresh(), 12);
    expect(R.zoneDone(s, 'bread')).toBe(false);
    R.startLevel(s, 12);
    const result = playToWin(s);
    expect(result).toMatchObject({ zone: 'bread', zoneCoins: C.ZONE_COINS });
    expect(s.coins).toBe(result.pay + C.ZONE_COINS);
    expect(s.tools).toEqual({ spatula: C.START_TOOLS.spatula + 1, rollingpin: C.START_TOOLS.rollingpin + 1, whisk: C.START_TOOLS.whisk + 1 });
    expect(R.zoneDone(s, 'bread')).toBe(true);
    expect(R.zoneStars(s, 'bread')).toBe(36);
    // Cleared again, the shop pays nothing more.
    R.startLevel(s, 12);
    expect(playToWin(s)).toMatchObject({ zone: null, zoneCoins: 0, pay: 0 });
  });

  it('goes on past the lane into the late shift', () => {
    const s = reachedTo(fresh(), 97);
    expect(R.levelOpen(s, 97)).toBe(true);
    const c = R.startLevel(s, 97);
    expect(c?.round.kinds).toHaveLength(levelAt(97).slots.length);
    expect(playToWin(s)).toMatchObject({ level: 97, won: true, pay: 40, zone: null });
    expect(R.nextLevel(s)).toBe(98);
  });
});

describe('taking pastries', () => {
  it('puts them on the tray, boxes up threes and counts them', () => {
    const s = fresh();
    expect(R.take(s, 0)).toBeNull();
    const c = R.startLevel(s, 1);
    if (!c) throw new Error('no round');
    const way = dealOf(levelAt(1), c.round.seed).order;
    const first = R.take(s, way[0] ?? -1);
    expect(first?.take).toMatchObject({ from: 'counter', slot: 0, set: null });
    expect(first?.result).toBeNull();
    R.take(s, way[1] ?? -1);
    R.take(s, way[2] ?? -1);
    expect(s.stats.taken).toBe(3);
    expect(s.stats.sets).toBe(c.round.sets);
    expect(R.hintTile(s)).not.toBeNull();
  });

  it('pays the sprinkles of every sprinkled pastry boxed up, every time', () => {
    // Level 61 is the first with sprinkles.
    const s = reachedTo(fresh(), 61);
    R.startLevel(s, 61);
    const result = playToWin(s);
    const sprinkled = levelAt(61).sprinkles.filter(Boolean).length;
    expect(sprinkled).toBeGreaterThan(0);
    expect(result.sprinkles).toBe(sprinkled * C.SPRINKLE_COINS);
    expect(result.pay).toBe(C.LEVEL_COINS + 3 * C.STAR_COINS + result.sprinkles);
    R.startLevel(s, 61);
    expect(playToWin(s).pay).toBe(sprinkled * C.SPRINKLE_COINS);
  });

  it('stop at a full tray: room for sugar sends three up to the rack, and a level cleared after that has one star', () => {
    const s = reachedTo(fresh(), 3);
    R.startLevel(s, 3);
    expect(R.buyRoom(s)).toBe(false);
    jam(s);
    expect(R.isStuck(s)).toBe(true);
    expect(R.take(s, free(s))).toBeNull();
    expect(R.hintTile(s)).toBeNull();
    expect(R.buyRoom(s)).toBe(false);
    s.coins = C.MORE_ROOM_COST;
    expect(R.buyRoom(s)).toBe(true);
    expect(s.coins).toBe(0);
    expect(s.current?.round.rack).toHaveLength(MORE_ROOM);
    expect(s.current?.round.tray).toHaveLength(7 - MORE_ROOM);
    expect(s.stats.continues).toBe(1);
    expect(whiskToWin(s)).toMatchObject({ won: true, stars: 1, pay: C.LEVEL_COINS + C.STAR_COINS });
  });
});

describe('tools', () => {
  it('come from the apron pocket and take no place on the tray', () => {
    const s = reachedTo(fresh(), 3);
    expect(R.applyTool(s, 'whisk')).toBeNull();
    const c = R.startLevel(s, 3);
    if (!c) throw new Error('no round');
    // Nothing on the tray for the spatula to put back yet.
    expect(R.canUse(s, 'spatula')).toBe(false);
    const tile = free(s);
    R.take(s, tile);
    const undo = R.applyTool(s, 'spatula');
    expect(undo).toMatchObject({ tool: 'spatula', undo: { tile, to: 'counter', slot: 0 }, whisk: null, result: null });
    expect(c.round.tray).toEqual([]);
    expect(s.tools.spatula).toBe(C.START_TOOLS.spatula - 1);
    const before = pastriesLeft(c.round);
    expect(R.applyTool(s, 'rollingpin')).toMatchObject({ tool: 'rollingpin', undo: null, whisk: null });
    expect(pastriesLeft(c.round)).toEqual(before);
    expect(s.tools.rollingpin).toBe(0);
    expect(R.canUse(s, 'rollingpin')).toBe(false);
    expect(R.applyTool(s, 'rollingpin')).toBeNull();
    const whisked = R.applyTool(s, 'whisk');
    expect(whisked?.whisk?.set).toHaveLength(3);
    expect(c.round.sets).toBe(1);
    expect(s.stats).toMatchObject({ toolsUsed: 3, sets: 1 });
  });

  it('end the round when the whisk boxes up the last of the counter', () => {
    const s = fresh();
    R.startLevel(s, 1);
    s.tools.whisk = 3;
    R.applyTool(s, 'whisk');
    R.applyTool(s, 'whisk');
    const last = R.applyTool(s, 'whisk');
    expect(last?.whisk?.won).toBe(true);
    expect(last?.result).toMatchObject({ level: 1, won: true, stars: 3 });
    expect(s.current).toBeNull();
    expect(s.stars).toEqual([3]);
  });

  it('free a full tray: the spatula and the whisk work on it, the rolling pin does not', () => {
    const s = reachedTo(fresh(), 3);
    R.startLevel(s, 3);
    jam(s);
    expect(R.toolWorks(s, 'rollingpin')).toBe(false);
    expect(R.toolWorks(s, 'spatula')).toBe(true);
    expect(R.toolWorks(s, 'whisk')).toBe(true);
    R.applyTool(s, 'spatula');
    expect(R.isStuck(s)).toBe(false);
  });

  it('can be bought for the pocket', () => {
    const s = fresh();
    expect(R.buyTool(s, 'spatula')).toBe(false);
    s.coins = C.TOOL_COSTS.spatula + C.TOOL_COSTS.whisk;
    expect(R.buyTool(s, 'spatula')).toBe(true);
    expect(R.buyTool(s, 'whisk')).toBe(true);
    expect(s.tools).toMatchObject({ spatula: C.START_TOOLS.spatula + 1, whisk: C.START_TOOLS.whisk + 1 });
    expect(s.coins).toBe(0);
    s.coins = 10_000;
    s.tools.rollingpin = C.MAX_TOOLS;
    expect(R.buyTool(s, 'rollingpin')).toBe(false);
  });
});

describe('the daily special', () => {
  it('is cleared once a day, for more each day of a streak', () => {
    const s = fresh();
    expect(R.dailyPay(s, DAY)).toBe(C.DAILY_COINS);
    expect(R.openDaily(s, DAY)).toMatchObject({ mode: 'daily', day: DAY, level: 0 });
    expect(playToWin(s)).toMatchObject({ mode: 'daily', won: true, streak: 1 });
    expect(paid(s.result)).toBe(C.DAILY_COINS);
    expect(R.dailyDoneToday(s, DAY)).toBe(true);
    expect(R.openDaily(s, DAY)).toBeNull();
    // The stars of the lane are not touched.
    expect(s.stars).toEqual([]);
    const next = dayAfter(DAY);
    expect(R.dailyStreak(s, next)).toBe(1);
    expect(R.dailyPay(s, next)).toBe(C.DAILY_COINS + C.STREAK_COINS);
    R.openDaily(s, next);
    expect(playToWin(s)).toMatchObject({ streak: 2 });
    expect(paid(s.result)).toBe(C.DAILY_COINS + C.STREAK_COINS);
    // A day missed ends the streak.
    const later = dayAfter(DAY, 3);
    expect(R.dailyStreak(s, later)).toBe(0);
    R.openDaily(s, later);
    expect(playToWin(s)).toMatchObject({ streak: 1 });
    expect(paid(s.result)).toBe(C.DAILY_COINS);
    expect(s.daily.bestStreak).toBe(2);
    expect(s.stats.dailies).toBe(3);
  });

  it('pays at most five days of streak more', () => {
    const s = fresh();
    s.daily = { day: null, tries: 0, lastDone: DAY, streak: 9, bestStreak: 9 };
    expect(R.dailyPay(s, dayAfter(DAY))).toBe(C.DAILY_COINS + C.STREAK_DAYS * C.STREAK_COINS);
  });

  it('deals everyone the same counter on the first try of a day, and a new deal on each try after', () => {
    const first = fresh();
    R.openDaily(first, DAY);
    const s = fresh();
    R.openDaily(s, DAY);
    expect(kinds(s)).toEqual(kinds(first));
    R.giveUp(s);
    R.openDaily(s, DAY);
    expect(kinds(s)).not.toEqual(kinds(first));
  });

  it('counts a round started on one day for that day', () => {
    const s = fresh();
    R.openDaily(s, DAY);
    // Cleared after midnight.
    expect(playToWin(s).streak).toBe(1);
    expect(s.daily.lastDone).toBe(DAY);
  });
});

describe('notes on what is new', () => {
  it('show at the first level of each new thing until seen', () => {
    const s = fresh();
    expect(R.tipFor(s, { mode: 'lane', level: 1, day: null })).toBe('tap');
    expect(R.tipFor(s, { mode: 'lane', level: 4, day: null })).toBeNull();
    expect(R.tipFor(s, { mode: 'daily', level: 0, day: DAY })).toBeNull();
    expect(R.seeTip(s, 'tap')).toBe(true);
    expect(R.seeTip(s, 'tap')).toBe(false);
    expect(R.tipFor(s, { mode: 'lane', level: 1, day: null })).toBeNull();
    // Clearing the level counts as seeing its note.
    R.startLevel(reachedTo(s, 25), 25);
    expect(R.tipFor(s, { mode: 'lane', level: 25, day: null })).toBe('bag');
    playToWin(s);
    expect(s.tips).toEqual(['tap', 'bag']);
  });
});

describe('ads', () => {
  it('make room only on a full tray with space on the rack', () => {
    const s = reachedTo(fresh(), 3);
    expect(R.adOffered(s, 'more_room', DAY, 0)).toBe(false);
    R.startLevel(s, 3);
    expect(R.adOffered(s, 'more_room', DAY, 0)).toBe(false);
    jam(s);
    expect(R.adOffered(s, 'more_room', DAY, 0)).toBe(true);
    expect(R.grantAdReward(s, 'more_room', T0, DAY, 0)).toBe(true);
    expect(s.current?.round.rack).toHaveLength(MORE_ROOM);
    expect(R.adOffered(s, 'more_room', DAY, 0)).toBe(false);
    expect(R.adsLeft(s, 'more_room', DAY)).toBe(R.AD_LIMITS.perPlacement.more_room - 1);
  });

  it('give a tool for the pocket during a round, the tool known by its slot', () => {
    const s = fresh();
    expect(R.adOffered(s, 'tool', DAY, R.slotOfTool('whisk'))).toBe(false);
    R.startLevel(s, 1);
    expect(R.adOffered(s, 'tool', DAY, R.slotOfTool('whisk'))).toBe(true);
    expect(R.adOffered(s, 'tool', DAY, 9)).toBe(false);
    expect(R.grantAdReward(s, 'tool', T0, DAY, R.slotOfTool('whisk'))).toBe(true);
    expect(s.tools.whisk).toBe(C.START_TOOLS.whisk + 1);
    expect(R.toolOfSlot(R.slotOfTool('rollingpin'))).toBe('rollingpin');
  });

  it('double what a level cleared paid, once', () => {
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

  it('give free sugar a few times a day, and no more than fifteen ads in all', () => {
    const s = fresh();
    for (let i = 0; i < R.AD_LIMITS.perPlacement.free_coins; i++) expect(R.grantAdReward(s, 'free_coins', T0, DAY, 0)).toBe(true);
    expect(R.grantAdReward(s, 'free_coins', T0, DAY, 0)).toBe(false);
    expect(s.coins).toBe(R.AD_LIMITS.perPlacement.free_coins * C.FREE_COINS);
    expect(R.adOffered(s, 'free_coins', dayAfter(DAY), 0)).toBe(true);
    R.startLevel(s, 1);
    let watched = R.AD_LIMITS.perPlacement.free_coins;
    while (R.grantAdReward(s, 'tool', T0, DAY, R.slotOfTool('spatula'))) watched += 1;
    expect(watched).toBe(R.AD_LIMITS.perPlacement.free_coins + R.AD_LIMITS.perPlacement.tool);
    expect(R.AD_LIMITS.total).toBe(15);
  });

  it('start breaks only after a few counters cleared', () => {
    const s = fresh();
    expect(R.adBreaksEarned(s)).toBe(false);
    s.stats.won = C.AD_BREAKS_AFTER_WINS;
    expect(R.adBreaksEarned(s)).toBe(true);
  });
});

describe('purchases', () => {
  it('add sugar and tools, and a refund takes them back without emptying a pocket below nothing', () => {
    const s = fresh();
    R.grantPurchase(s, { coins: 1000, spatula: 5, rollingpin: 5, whisk: 5 });
    expect(s.coins).toBe(1000);
    expect(s.tools).toEqual({ spatula: C.START_TOOLS.spatula + 5, rollingpin: C.START_TOOLS.rollingpin + 5, whisk: C.START_TOOLS.whisk + 5 });
    s.tools.spatula = 1;
    R.grantPurchase(s, { coins: -1500, spatula: -5, rollingpin: -5, whisk: -5 });
    expect(s.coins).toBe(-500);
    expect(s.tools).toEqual({ spatula: 0, rollingpin: C.START_TOOLS.rollingpin, whisk: C.START_TOOLS.whisk });
  });

  it('know only the game’s own entitlements', () => {
    const s = fresh();
    R.setEntitlements(s, ['remove_ads', 'something_else', 'baker_kit']);
    expect(s.shop.entitlements).toEqual(['remove_ads', 'baker_kit']);
    expect(R.hasEntitlement(s, 'remove_ads')).toBe(true);
  });
});

describe('looks', () => {
  it('are bought with sugar and chosen, and the first of each is free', () => {
    const s = fresh();
    expect(R.tilesInUse(s)).toBe('cream');
    expect(R.seasonInUse(s)).toBe('spring');
    expect(R.buyLook(s, 'rain')).toBe(false);
    s.coins = C.LOOK_COSTS.rain;
    expect(R.buyLook(s, 'rain')).toBe(true);
    expect(R.seasonInUse(s)).toBe('rain');
    expect(R.buyLook(s, 'rain')).toBe(false);
    expect(R.chooseLook(s, 'spring')).toBe(true);
    expect(R.chooseLook(s, 'snow')).toBe(false);
    expect(R.chooseLook(s, 'rain')).toBe(true);
    expect(R.ownsLook(s, 'cream')).toBe(true);
    expect(s.coins).toBe(0);
  });

  it('come with the Baker’s Kit and the Lane Collection, and go back with a refund', () => {
    const s = fresh();
    expect(R.bakerKitOffered(s)).toBe(true);
    R.setEntitlements(s, ['baker_kit']);
    expect(R.ownsLook(s, C.BAKER_KIT_TILES)).toBe(true);
    expect(R.bakerKitOffered(s)).toBe(false);
    expect(R.chooseLook(s, C.BAKER_KIT_TILES)).toBe(true);
    expect(R.tilesInUse(s)).toBe(C.BAKER_KIT_TILES);
    R.setEntitlements(s, ['lane_collection']);
    expect(R.collectionOffered(s)).toBe(false);
    expect(R.chooseLook(s, 'snow')).toBe(true);
    R.setEntitlements(s, []);
    expect(R.seasonInUse(s)).toBe('spring');
    expect(R.tilesInUse(s)).toBe('cream');
    expect(R.collectionOffered(s)).toBe(true);
  });
});

describe('the hint', () => {
  it('points at a tile that can be taken, and clears the first levels by itself', () => {
    const s = fresh();
    expect(R.hintTile(s)).toBeNull();
    for (let n = 1; n <= 3; n++) {
      R.startLevel(s, n);
      for (let i = 0; i < 100 && s.current; i++) {
        const tile = R.hintTile(s);
        if (tile === null) throw new Error('no hint');
        R.take(s, tile);
      }
      expect(s.current).toBeNull();
      expect(s.result?.won).toBe(true);
    }
  });
});
