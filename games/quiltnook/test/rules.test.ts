import { describe, expect, it } from 'vitest';
import * as B from '../src/sim/board.js';
import * as C from '../src/sim/content.js';
import * as Q from '../src/sim/quilt.js';
import * as R from '../src/sim/rules.js';
import { createState, type GameState } from '../src/sim/state.js';
import { DAY, T0, board, greedyBot, quiltWith, sewQuilt } from './helpers.js';

const fresh = (seed = 1): GameState => createState(T0, seed);

/** A quilt sewn by the play-bot, for results with real numbers. */
function sewn(s: GameState, mode: Q.Mode, day = DAY): Q.Quilt {
  const q = R.openQuilt(s, mode, day);
  sewQuilt(q, greedyBot, 40);
  return q;
}

describe('opening a quilt', () => {
  it('continues the quilt in progress, or starts a new one from the save random state', () => {
    const s = fresh();
    const first = R.openQuilt(s, 'endless', DAY);
    expect(R.openQuilt(s, 'endless', DAY)).toBe(first);
    const other = fresh(2);
    expect(R.openQuilt(other, 'endless', DAY).tray).not.toEqual(first.tray);
  });

  it('starts the same daily quilt for everyone on a day, and another one the next day', () => {
    const a = R.openQuilt(fresh(1), 'daily', DAY);
    const b = R.openQuilt(fresh(2), 'daily', DAY);
    expect(a.tray).toEqual(b.tray);
    expect(a.day).toBe(DAY);
    expect(R.openQuilt(fresh(1), 'daily', '2026-10-30').tray).not.toEqual(a.tray);
    expect(C.DAILY_TARGETS).toContain(R.dailyTarget(DAY));
  });

  it("finishes yesterday's daily quilt when today's is opened, without the daily reward", () => {
    const s = fresh();
    const old = sewn(s, 'daily', '2026-10-28');
    const today = R.openQuilt(s, 'daily', DAY);
    expect(today).not.toBe(old);
    expect(s.stats.quilts).toBe(1);
    expect(s.spools).toBe(Math.floor(old.score / C.POINTS_PER_SPOOL) + old.spools);
    expect(s.result).toBeNull();
    expect(s.daily.lastDone).toBeNull();
  });
});

describe('sewing in a saved game', () => {
  it('hands the spools a patch earned to the player at once', () => {
    const s = fresh();
    s.quilts.endless = quiltWith(
      `222222..
       ........
       ........
       ........
       ........
       ........
       ........
       .......1`,
      [['duo_h', 2], ['dot', 0], null],
    );
    expect(R.place(s, 'endless', 0, 6, 0, DAY)?.stitch.perfect).toBe(1);
    expect(s.spools).toBe(1);
    expect(s.hintDone).toBe(true);
    expect(R.place(s, 'endless', 0, 6, 0, DAY)).toBeNull();
  });

  it('pays the daily reward once, when the target is reached, and counts the streak', () => {
    const s = fresh();
    const q = R.openQuilt(s, 'daily', DAY);
    q.board = board('0123012. ' + '........ '.repeat(6) + '.......1');
    q.tray = [{ shape: 'dot', fabric: 0 }, { shape: 'dot', fabric: 1 }, null];
    q.score = R.dailyTarget(DAY) - 5;
    const placed = R.place(s, 'daily', 0, 7, 0, DAY);
    expect(placed?.dailyDone).toBe(true);
    expect(s.spools).toBe(C.DAILY_SPOOLS);
    expect(s.daily).toEqual({ lastDone: DAY, streak: 1, bestStreak: 1 });
    expect(R.place(s, 'daily', 1, 0, 1, DAY)?.dailyDone).toBe(false);
    expect(s.spools).toBe(C.DAILY_SPOOLS);
    expect(R.dailyDoneToday(s, DAY)).toBe(true);
  });

  it('keeps the daily streak from one day to the next, and loses it after a missed day', () => {
    const s = fresh();
    const reach = (day: string) => {
      s.quilts.daily = null;
      const q = R.openQuilt(s, 'daily', day);
      q.score = R.dailyTarget(day);
      q.tray = [{ shape: 'dot', fabric: 0 }, null, null];
      R.place(s, 'daily', 0, 0, 0, day);
    };
    reach('2026-10-29');
    reach('2026-10-30');
    expect(s.daily.streak).toBe(2);
    expect(R.dailyStreak(s, '2026-10-31')).toBe(2);
    expect(R.dailyStreak(s, '2026-11-01')).toBe(0);
    reach('2026-11-01');
    expect(s.daily).toEqual({ lastDone: '2026-11-01', streak: 1, bestStreak: 2 });
  });

  it('sees when the quilt has run out of room', () => {
    const s = fresh();
    s.quilts.endless = quiltWith(
      `.1230123
       0.230123
       01.30123
       012.0123
       0123.123
       01230.23
       012301.3
       0123012.`,
      [['block', 0], null, ['square', 1]],
    );
    expect(R.stuck(s, 'endless')).toBe(true);
    expect(R.stuck(s, 'daily')).toBe(false);
  });
});

describe('finishing a quilt', () => {
  it('pays a spool a hundred points, keeps the best score and counts the quilt', () => {
    const s = fresh();
    const q = sewn(s, 'endless');
    const result = R.finishQuilt(s, 'endless');
    expect(result).toEqual({ mode: 'endless', score: q.score, newBest: true, spools: Math.floor(q.score / 100), doubled: false });
    expect(s.best).toBe(q.score);
    expect(s.quilts.endless).toBeNull();
    expect(s.spools).toBe(result ? result.spools + q.spools : NaN);
    expect(s.stats).toMatchObject({ quilts: 1, patches: q.patches, seams: q.seams, perfect: q.perfect, doubles: q.doubles, bestStreak: q.bestStreak });
    const second = sewn(s, 'endless');
    second.score = 1;
    expect(R.finishQuilt(s, 'endless')?.newBest).toBe(false);
    expect(s.best).toBe(q.score);
  });

  it('lets a quilt with nothing sewn go, without a result', () => {
    const s = fresh();
    R.openQuilt(s, 'endless', DAY);
    expect(R.finishQuilt(s, 'endless')).toBeNull();
    expect(s.quilts.endless).toBeNull();
    expect(s.stats.quilts).toBe(0);
    expect(s.result).toBeNull();
  });

  it('counts a daily quilt for the stats and commissions, not for the best endless score', () => {
    const s = fresh();
    const q = sewn(s, 'daily');
    expect(R.finishQuilt(s, 'daily')).toMatchObject({ mode: 'daily', newBest: false });
    expect(s.best).toBe(0);
    expect(s.commissions[0]?.progress).toBe(q.seams);
  });
});

describe('the tools', () => {
  const stuckQuilt = () =>
    quiltWith(
      `.1230123
       0.230123
       01.30123
       012.0123
       0123.123
       01230.23
       012301.3
       0123012.`,
      [['block', 0], ['block', 1], ['block', 2]],
    );

  it('charges for Unpick what it costs plus the spools the patch had earned', () => {
    const s = fresh();
    s.quilts.endless = quiltWith(
      `222222..
       ........
       ........
       ........
       ........
       ........
       ........
       .......1`,
      [['duo_h', 2], ['dot', 1], null],
    );
    expect(R.unpickCost(s, 'endless')).toBeNull();
    R.place(s, 'endless', 0, 6, 0, DAY);
    expect(R.unpickCost(s, 'endless')).toBe(C.TOOL_COSTS.unpick + 1);
    expect(R.canUse(s, 'endless', 'unpick')).toBe(false);
    s.spools = 30;
    expect(R.unpick(s, 'endless')).toBe(true);
    expect(s.spools).toBe(30 - C.TOOL_COSTS.unpick - 1);
    expect(R.unpick(s, 'endless')).toBe(false);
  });

  it('sells new patches and snips for spools, only when they can be paid for', () => {
    const s = fresh();
    s.quilts.endless = stuckQuilt();
    expect(R.newPatches(s, 'endless')).toBe(false);
    s.spools = C.TOOL_COSTS.newPatches + C.TOOL_COSTS.snip;
    expect(R.newPatches(s, 'endless')).toBe(true);
    expect(R.snip(s, 'endless', 0, 0)).toBe(false);
    expect(R.snip(s, 'endless', 1, 0)).toBe(true);
    expect(s.spools).toBe(0);
    expect(R.canUse(s, 'daily', 'snip')).toBe(false);
  });

  it('has nothing to snip on an empty quilt', () => {
    const s = fresh();
    s.spools = 100;
    R.openQuilt(s, 'endless', DAY);
    expect(R.canUse(s, 'endless', 'snip')).toBe(false);
    expect(R.canUse(s, 'endless', 'newPatches')).toBe(true);
  });
});

describe('commissions', () => {
  it('pays a finished commission once and puts one of another kind in its place', () => {
    const s = fresh();
    expect(R.claimCommission(s, 0)).toBe(0);
    const first = s.commissions[0];
    if (!first) throw new Error('no commission');
    first.progress = R.commissionTarget(first);
    expect(R.commissionDone(first)).toBe(true);
    expect(R.claimCommission(s, 0)).toBe(C.COMMISSION_REWARDS[0]);
    expect(s.spools).toBe(C.COMMISSION_REWARDS[0]);
    expect(s.commissionsDone).toBe(1);
    const kinds = s.commissions.map((c) => c.kind);
    expect(new Set(kinds).size).toBe(C.COMMISSION_SLOTS);
    expect(s.commissions[0]?.progress).toBe(0);
    expect(R.claimCommission(s, 0)).toBe(0);
    expect(R.claimCommission(s, 7)).toBe(0);
  });

  it('gets a tier harder every six claimed commissions, up to the third tier', () => {
    const s = fresh();
    for (let i = 0; i < 20; i++) {
      const c = s.commissions[i % 3];
      if (!c) throw new Error('no commission');
      c.progress = R.commissionTarget(c);
      R.claimCommission(s, i % 3);
    }
    expect(s.commissionsDone).toBe(20);
    expect(s.commissions.every((c) => c.tier === 2)).toBe(true);
    expect(s.commissions.map((c) => R.commissionReward(c))).toEqual([40, 40, 40]);
  });

  it('adds up counting commissions over quilts and keeps the best for score and streak', () => {
    const s = fresh();
    s.commissions = [
      { kind: 'patches', tier: 0, progress: 0 },
      { kind: 'score', tier: 0, progress: 0 },
      { kind: 'streak', tier: 0, progress: 0 },
    ];
    const a = sewn(s, 'endless');
    const scoreA = a.score;
    const patchesA = a.patches;
    const streakA = a.bestStreak;
    R.finishQuilt(s, 'endless');
    const b = R.openQuilt(s, 'endless', DAY);
    b.tray = [{ shape: 'dot', fabric: 0 }, null, null];
    R.place(s, 'endless', 0, 0, 0, DAY);
    R.finishQuilt(s, 'endless');
    expect(s.commissions.map((c) => c.progress)).toEqual([patchesA + 1, scoreA, streakA]);
  });

  it('counts a finished daily quilt', () => {
    const s = fresh();
    s.commissions = [
      { kind: 'daily', tier: 0, progress: 0 },
      { kind: 'seams', tier: 0, progress: 0 },
      { kind: 'perfect', tier: 0, progress: 0 },
    ];
    const q = R.openQuilt(s, 'daily', DAY);
    q.score = R.dailyTarget(DAY);
    q.tray = [{ shape: 'dot', fabric: 0 }, null, null];
    R.place(s, 'daily', 0, 0, 0, DAY);
    expect(s.commissions[0]?.progress).toBe(1);
  });
});

describe('fabric sets', () => {
  it('sells a set for spools once, and uses it at once', () => {
    const s = fresh();
    expect(R.ownsFabric(s, 'cottage')).toBe(true);
    expect(R.buyFabric(s, 'indigo')).toBe(false);
    s.spools = C.FABRIC_COSTS.indigo;
    expect(R.buyFabric(s, 'indigo')).toBe(true);
    expect(s.spools).toBe(0);
    expect(R.fabricInUse(s)).toBe('indigo');
    s.spools = 1000;
    expect(R.buyFabric(s, 'indigo')).toBe(false);
    expect(R.chooseFabric(s, 'cottage')).toBe(true);
    expect(R.chooseFabric(s, 'woodland')).toBe(false);
    expect(R.fabricInUse(s)).toBe('cottage');
  });

  it('gives Meadow with the Sewing Kit and every set with the Fabric Chest, as long as they are owned', () => {
    const s = fresh();
    expect(R.sewingKitOffered(s)).toBe(true);
    R.setEntitlements(s, ['sewing_kit', 'unknown_thing']);
    expect(s.shop.entitlements).toEqual(['sewing_kit']);
    expect(R.ownsFabric(s, 'meadow')).toBe(true);
    expect(R.ownsFabric(s, 'candy')).toBe(false);
    expect(R.sewingKitOffered(s)).toBe(false);
    R.setEntitlements(s, ['fabric_chest']);
    expect(C.FABRIC_SETS.every((id) => R.ownsFabric(s, id))).toBe(true);
    R.chooseFabric(s, 'woodland');
    // A refund takes the chest back, and with it the set in use.
    R.setEntitlements(s, []);
    expect(R.fabricInUse(s)).toBe('cottage');
  });
});

describe('rewarded ads', () => {
  it('offers a second chance only for a stuck quilt that has not had one', () => {
    const s = fresh();
    R.openQuilt(s, 'endless', DAY);
    expect(R.adOffered(s, 'second_chance', DAY, 'endless')).toBe(false);
    s.quilts.endless = quiltWith(
      `.1230123
       0.230123
       01.30123
       012.0123
       0123.123
       01230.23
       012301.3
       0123012.`,
      [['block', 0], ['block', 1], ['block', 2]],
    );
    expect(R.adOffered(s, 'second_chance', DAY, 'endless')).toBe(true);
    expect(R.adOffered(s, 'second_chance', DAY, 'daily')).toBe(false);
    expect(R.grantAdReward(s, 'second_chance', T0, DAY, 'endless')).toBe(true);
    expect(R.stuck(s, 'endless')).toBe(false);
    expect(R.adOffered(s, 'second_chance', DAY, 'endless')).toBe(false);
    expect(R.grantAdReward(s, 'second_chance', T0, DAY, 'endless')).toBe(false);
  });

  it('doubles the spools of a finished quilt once', () => {
    const s = fresh();
    expect(R.adOffered(s, 'double_spools', DAY, 'endless')).toBe(false);
    sewn(s, 'endless');
    const result = R.finishQuilt(s, 'endless');
    if (!result) throw new Error('no result');
    result.spools = 7;
    const before = s.spools;
    expect(R.grantAdReward(s, 'double_spools', T0, DAY, 'endless')).toBe(true);
    expect(s.spools).toBe(before + 7);
    expect(s.result?.doubled).toBe(true);
    expect(R.adOffered(s, 'double_spools', DAY, 'endless')).toBe(false);
  });

  it('gives free spools up to their daily limit, and resets the next day', () => {
    const s = fresh();
    const limit = R.AD_LIMITS.perPlacement.free_spools;
    for (let i = 0; i < limit; i++) expect(R.grantAdReward(s, 'free_spools', T0 + i, DAY, 'endless')).toBe(true);
    expect(s.spools).toBe(limit * C.FREE_SPOOLS);
    expect(R.adsLeft(s, 'free_spools', DAY)).toBe(0);
    expect(R.grantAdReward(s, 'free_spools', T0, DAY, 'endless')).toBe(false);
    expect(R.adsLeft(s, 'free_spools', '2026-10-30')).toBe(limit);
  });

  it('starts ad breaks only after a few finished quilts', () => {
    const s = fresh();
    expect(R.adBreaksEarned(s)).toBe(false);
    s.stats.quilts = C.AD_BREAKS_AFTER_QUILTS;
    expect(R.adBreaksEarned(s)).toBe(true);
  });
});

describe('purchases', () => {
  it('adds the spools a purchase settled, and takes them back after a refund', () => {
    const s = fresh();
    R.grantPurchase(s, { spools: 350 });
    expect(s.spools).toBe(350);
    R.grantPurchase(s, { spools: -350 });
    R.grantPurchase(s, { gems: 5 });
    expect(s.spools).toBe(0);
  });
});

describe('a quilt sewn to the end', () => {
  it('never deals a tray that a fresh board cannot take', () => {
    const s = fresh(5);
    const q = R.openQuilt(s, 'endless', DAY);
    expect(Q.canMove(q)).toBe(true);
    expect(B.filledCount(q.board)).toBe(0);
  });
});
