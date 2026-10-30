import { describe, expect, it } from 'vitest';
import { WILD } from '../src/sim/cards.js';
import * as C from '../src/sim/content.js';
import { makeDaily, makeLevel } from '../src/sim/levels.js';
import * as R from '../src/sim/rules.js';
import { createState } from '../src/sim/state.js';
import { topCard } from '../src/sim/table.js';
import { clearDeal, DAY, dealtOf, drawOut, stateWith, T0 } from './helpers.js';

const RUN = dealtOf('peaks2', [9, 9, 10, 10, 11, 11, 6, 7, 8, 6, 7, 8, 1, 2, 3, 4, 5, 3, 2, 1], [0, 12, 0], [4, 4, 5, 5, 9, 12, 12, 1, 2, 3]);
const STUCK = dealtOf('peaks2', [9, 9, 10, 10, 11, 11, 6, 7, 8, 5, 6, 7, 3, 4, 5, 6, 7, 8, 3, 4], [0], [1, 2, 3, 4, 5, 2]);
const NEXT_DAY = '2026-10-30';

function dealOf(s: ReturnType<typeof createState>, mode: C.Mode = 'level') {
  const deal = s.deals[mode];
  if (!deal) throw new Error('no deal');
  return deal;
}

describe('levels', () => {
  it('opens the level deal and keeps it until it ends', () => {
    const s = createState(T0);
    const deal = R.openDeal(s, 'level', DAY);
    expect(deal?.level).toBe(1);
    expect(deal?.dealt).toEqual(makeLevel(1, 0).dealt);
    expect(deal?.undosLeft).toBe(C.FREE_UNDOS);
    expect(R.openDeal(s, 'level', DAY)).toBe(deal);
  });

  it('pays a cleared level its pot, its pay and its spare cards, and goes on to the next level', () => {
    const s = createState(T0);
    R.openDeal(s, 'level', DAY);
    const result = clearDeal(s);
    expect(result).toMatchObject({ won: true, level: 1, pay: C.levelCoins(1), clean: true, canal: null, doubled: false });
    expect(result.cleared).toBe(result.cards);
    expect(result.pot).toBeGreaterThanOrEqual(result.cards);
    expect(result.spareCoins).toBe(result.spare * C.SPARE_COINS);
    expect(result.coins).toBe(result.pot + result.pay + result.spareCoins);
    expect(s.coins).toBe(result.coins);
    expect(s.level).toBe(2);
    expect(s.deals.level).toBeNull();
    expect(s.result).toEqual(result);
    expect(s.stats).toMatchObject({ wins: 1, losses: 0, clean: 1, cards: result.cards, bestStreak: result.bestStreak });
  });

  it('reaches the end of a canal on its tenth stop, for a bonus', () => {
    const s = createState(T0);
    let coins = 0;
    for (let level = 1; level <= C.STOPS_PER_CANAL; level++) {
      R.openDeal(s, 'level', DAY);
      const result = clearDeal(s);
      coins += result.coins + result.bonus;
      expect(result.canal).toBe(level === C.STOPS_PER_CANAL ? 'landing' : null);
    }
    expect(s.result?.bonus).toBe(C.CANAL_COINS);
    expect(s.coins).toBe(coins);
    expect(s.level).toBe(C.STOPS_PER_CANAL + 1);
  });

  it('ends only a stuck deal, for nothing, and then deals the level anew', () => {
    const s = createState(T0);
    const first = R.openDeal(s, 'level', DAY);
    expect(R.giveUp(s, 'level', DAY)).toBeNull();
    dealOf(s).dealt = STUCK;
    expect(R.stuck(s, 'level')).toBe(true);
    const lost = R.giveUp(s, 'level', DAY);
    expect(lost).toMatchObject({ won: false, coins: 0, cleared: 0, cards: 20 });
    expect(s.coins).toBe(0);
    expect(s.level).toBe(1);
    expect(s.stats.losses).toBe(1);
    const again = R.openDeal(s, 'level', DAY);
    expect(again?.attempt).toBe(1);
    expect(again?.dealt).toEqual(makeLevel(1, 1).dealt);
    expect(again?.dealt).not.toEqual(first?.dealt);
    expect(s.result).toBeNull();
    clearDeal(s);
    expect(s.tries.level).toEqual({ key: '', lost: 0 });
    expect(R.openDeal(s, 'level', DAY)?.attempt).toBe(0);
  });
});

describe('help', () => {
  it('takes back plays and draws with the free undos, then more for coins, but never paid help', () => {
    const s = stateWith(RUN);
    expect(R.canUndo(s, 'level')).toBe(false);
    R.play(s, 'level', 12, DAY);
    R.draw(s, 'level');
    expect(R.undo(s, 'level')).toBe(true);
    expect(R.undo(s, 'level')).toBe(true);
    expect(dealOf(s).moves).toEqual([]);
    expect(dealOf(s).undosLeft).toBe(0);
    R.play(s, 'level', 12, DAY);
    expect(R.undo(s, 'level')).toBe(false);
    expect(R.toolOffered(s, 'level', 'moreUndos')).toBe(true);
    expect(R.buyTool(s, 'level', 'moreUndos')).toBe(false);
    s.coins = 100;
    expect(R.buyTool(s, 'level', 'moreUndos')).toBe(true);
    expect(dealOf(s).undosLeft).toBe(C.MORE_UNDOS);
    expect(R.buyTool(s, 'level', 'wild')).toBe(true);
    expect(R.canUndo(s, 'level')).toBe(false);
    expect(R.undo(s, 'level')).toBe(false);
    expect(s.coins).toBe(100 - C.TOOL_COSTS.moreUndos - C.TOOL_COSTS.wild);
    expect(s.stats).toMatchObject({ undos: 2, wilds: 1 });
  });

  it('puts a lotus wild on the pile, which takes any face-up card', () => {
    const s = stateWith(STUCK);
    expect(R.stuck(s, 'level')).toBe(true);
    expect(R.buyTool(s, 'level', 'wild')).toBe(false);
    s.coins = C.TOOL_COSTS.wild;
    expect(R.buyTool(s, 'level', 'wild')).toBe(true);
    expect(s.coins).toBe(0);
    expect(topCard(R.tableOf(dealOf(s)))).toBe(WILD);
    expect(R.stuck(s, 'level')).toBe(false);
    expect(R.toolOffered(s, 'level', 'wild')).toBe(false);
    expect(R.play(s, 'level', 15, DAY)?.streak).toBe(1);
    expect(R.toolOffered(s, 'level', 'wild')).toBe(true);
  });

  it('adds five cards to an empty stock, twice a deal at most', () => {
    const s = stateWith(RUN);
    s.coins = 1000;
    expect(R.toolOffered(s, 'level', 'extraCards')).toBe(false);
    drawOut(s);
    for (let round = 0; round < C.MAX_EXTRAS; round++) {
      expect(R.toolOffered(s, 'level', 'extraCards')).toBe(true);
      expect(R.buyTool(s, 'level', 'extraCards')).toBe(true);
      expect(R.tableOf(dealOf(s)).stock).toHaveLength(5);
      drawOut(s);
    }
    expect(R.toolOffered(s, 'level', 'extraCards')).toBe(false);
    expect(dealOf(s).extras).toBe(C.MAX_EXTRAS);
    expect(s.coins).toBe(1000 - C.MAX_EXTRAS * C.TOOL_COSTS.extraCards);
  });

  it('counts a deal cleared with help as not clean', () => {
    const s = createState(T0);
    R.openDeal(s, 'level', DAY);
    s.coins = C.TOOL_COSTS.wild;
    R.buyTool(s, 'level', 'wild');
    expect(clearDeal(s).clean).toBe(false);
    expect(s.stats.clean).toBe(0);
  });
});

describe('the daily deal', () => {
  it('deals one a day, the same for everyone, and counts the streak', () => {
    const s = createState(T0);
    expect(R.openDeal(s, 'daily', DAY)?.dealt).toEqual(makeDaily(DAY, 0).dealt);
    const result = clearDeal(s, 'daily');
    expect(result).toMatchObject({ won: true, mode: 'daily', pay: C.DAILY_COINS, streak: 1 });
    expect(R.dailyDoneToday(s, DAY)).toBe(true);
    expect(R.openDeal(s, 'daily', DAY)).toBeNull();
    expect(s.level).toBe(1);
    R.openDeal(s, 'daily', NEXT_DAY);
    expect(clearDeal(s, 'daily', NEXT_DAY).streak).toBe(2);
    expect(R.dailyStreak(s, '2026-10-31')).toBe(2);
    expect(R.dailyStreak(s, '2026-11-01')).toBe(0);
    expect(s.daily).toEqual({ lastDone: NEXT_DAY, streak: 2, bestStreak: 2 });
  });

  it('lets an unfinished deal of yesterday go for today\'s', () => {
    const s = createState(T0);
    R.openDeal(s, 'daily', DAY);
    const today = R.openDeal(s, 'daily', NEXT_DAY);
    expect(today?.day).toBe(NEXT_DAY);
    expect(today?.dealt).toEqual(makeDaily(NEXT_DAY, 0).dealt);
  });
});

describe('looks', () => {
  it('buys a look with coins and uses it, and falls back to the free one when a refund takes it away', () => {
    const s = createState(T0);
    expect(R.buyLook(s, 'sunset')).toBe(false);
    s.coins = C.LOOK_COSTS.sunset;
    expect(R.buyLook(s, 'sunset')).toBe(true);
    expect(R.sceneInUse(s)).toBe('sunset');
    expect(R.chooseLook(s, 'kanok')).toBe(false);
    expect(R.chooseLook(s, 'morning')).toBe(true);
    expect(R.chooseLook(s, 'sunset')).toBe(true);
    s.looks.bought = [];
    expect(R.sceneInUse(s)).toBe('morning');
  });

  it('gives the Market Kit its card backs and the Canal Collection every look', () => {
    const s = createState(T0);
    R.setEntitlements(s, ['market_kit', 'something_else']);
    expect(s.shop.entitlements).toEqual(['market_kit']);
    expect(R.ownsLook(s, C.MARKET_KIT_BACK)).toBe(true);
    expect(R.marketKitOffered(s)).toBe(false);
    expect(R.collectionOffered(s)).toBe(true);
    R.setEntitlements(s, ['canal_collection']);
    expect(R.LOOKS.every((id) => R.ownsLook(s, id))).toBe(true);
    expect(R.collectionOffered(s)).toBe(false);
  });
});

describe('ads and purchases', () => {
  it('offers help for an ad only when it would help, on the deal it was watched for', () => {
    const s = createState(T0);
    R.openDeal(s, 'level', DAY);
    expect(R.adOffered(s, 'extra_cards', DAY, 'level')).toBe(false);
    expect(R.adOffered(s, 'more_undos', DAY, 'level')).toBe(false);
    expect(R.adOffered(s, 'wild', DAY, 'level')).toBe(true);
    expect(R.adOffered(s, 'wild', DAY, 'daily')).toBe(false);
    expect(R.grantAdReward(s, 'wild', T0, DAY, 'level')).toBe(true);
    expect(dealOf(s).wilds).toBe(1);
    expect(R.adOffered(s, 'wild', DAY, 'level')).toBe(false);
    drawOut(s);
    expect(R.grantAdReward(s, 'extra_cards', T0, DAY, 'level')).toBe(true);
    expect(R.adsLeft(s, 'extra_cards', DAY)).toBe(R.AD_LIMITS.perPlacement.extra_cards - 1);
  });

  it('doubles what a cleared deal paid, once, and never a lost one', () => {
    const s = createState(T0);
    R.openDeal(s, 'level', DAY);
    const result = clearDeal(s);
    expect(R.grantAdReward(s, 'double_coins', T0, DAY, 'level')).toBe(true);
    expect(s.coins).toBe(2 * result.coins);
    expect(R.adOffered(s, 'double_coins', DAY, 'level')).toBe(false);
    R.openDeal(s, 'level', DAY);
    dealOf(s).dealt = STUCK;
    R.giveUp(s, 'level', DAY);
    expect(R.adOffered(s, 'double_coins', DAY, 'level')).toBe(false);
  });

  it('gives free coins a few times a day', () => {
    const s = createState(T0);
    for (let i = 0; i < R.AD_LIMITS.perPlacement.free_coins; i++) expect(R.grantAdReward(s, 'free_coins', T0, DAY, 'level')).toBe(true);
    expect(R.grantAdReward(s, 'free_coins', T0, DAY, 'level')).toBe(false);
    expect(s.coins).toBe(R.AD_LIMITS.perPlacement.free_coins * C.FREE_COINS);
    expect(R.adOffered(s, 'free_coins', NEXT_DAY, 'level')).toBe(true);
  });

  it('adds purchased coins, and takes them back after a refund', () => {
    const s = createState(T0);
    R.grantPurchase(s, { coins: 500 });
    R.grantPurchase(s, { coins: -700 });
    expect(s.coins).toBe(-200);
  });

  it('allows ad breaks once a player has cleared a few deals', () => {
    const s = createState(T0);
    s.stats.wins = C.AD_BREAKS_AFTER_WINS - 1;
    expect(R.adBreaksEarned(s)).toBe(false);
    s.stats.wins += 1;
    expect(R.adBreaksEarned(s)).toBe(true);
  });
});
