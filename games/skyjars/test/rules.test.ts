import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import * as J from '../src/sim/jars.js';
import { makeDaily, makeLevel } from '../src/sim/levels.js';
import * as R from '../src/sim/rules.js';
import { TOTAL_STARS } from '../src/sim/sky.js';
import { createState } from '../src/sim/state.js';
import { DAY, T0, pours, solveShelf, stateWith } from './helpers.js';

/** The first level's three pours. */
const TUTORIAL_POURS = [
  [0, 2],
  [1, 0],
  [2, 1],
] as const;

/** Two jars that block each other, with no empty jar: no pour is left. */
const STUCK: J.Jar[] = [
  [0, 1],
  [1, 0],
];

describe('shelves', () => {
  it('opens the next level, and the same shelf until it is solved', () => {
    const s = createState(T0);
    const shelf = R.openShelf(s, 'level', DAY);
    expect(shelf?.level).toBe(1);
    expect(shelf?.jars).toEqual(makeLevel(1).puzzle.jars);
    expect(R.openShelf(s, 'level', DAY)).toBe(shelf);
    expect(shelf?.undosLeft).toBe(C.UNDOS_PER_SHELF);
  });

  it('pours, remembers the pour and refuses one that is not allowed', () => {
    const s = createState(T0);
    R.openShelf(s, 'level', DAY);
    expect(R.pour(s, 'level', 2, 0)).toBeNull();
    expect(R.pour(s, 'level', 0, 1)).toBeNull();
    expect(s.taught).toBe(false);
    expect(R.pour(s, 'level', 0, 2)).toEqual({ n: 1, filled: false, result: null });
    expect(s.shelves.level?.history).toEqual([{ from: 0, to: 2, n: 1 }]);
    expect(s.taught).toBe(true);
    expect(s.stats.pours).toBe(1);
    expect(R.pour(s, 'level', 1, 0)?.filled).toBe(true);
  });

  it('pays a solved level, lights its star and moves on to the next level', () => {
    const s = createState(T0);
    R.openShelf(s, 'level', DAY);
    const result = pours(s, 'level', TUTORIAL_POURS)?.result;
    expect(result).toEqual({
      mode: 'level',
      level: 1,
      pours: 3,
      clean: true,
      stardust: C.levelStardust(1) + C.CLEAN_BONUS,
      doubled: false,
      star: 0,
      constellation: null,
      bonus: 0,
      streak: 0,
    });
    expect(s.stardust).toBe(C.levelStardust(1) + C.CLEAN_BONUS);
    expect(s.level).toBe(2);
    expect(s.shelves.level).toBeNull();
    expect(s.result).toBe(result);
    expect(s.stats).toMatchObject({ levels: 1, clean: 1, pours: 3 });
    expect(R.openShelf(s, 'level', DAY)?.level).toBe(2);
    expect(s.result).toBeNull();
  });

  it('pays a bonus for the last star of a constellation, and keeps paying levels past the last star', () => {
    const s = createState(T0);
    s.level = 3;
    R.openShelf(s, 'level', DAY);
    const kettle = solveShelf(s);
    expect(kettle?.star).toBe(2);
    expect(kettle?.constellation).toBe('kettle');
    expect(kettle?.bonus).toBe(C.CONSTELLATION_STARDUST);
    expect(s.stardust).toBe((kettle?.stardust ?? 0) + C.CONSTELLATION_STARDUST);
    s.level = TOTAL_STARS + 1;
    R.openShelf(s, 'level', DAY);
    const past = solveShelf(s);
    expect(past?.star).toBeNull();
    expect(past?.constellation).toBeNull();
    expect(past?.stardust).toBe(C.levelStardust(TOTAL_STARS + 1) + (past?.clean ? C.CLEAN_BONUS : 0));
  });

  it('pays more for later levels, up to twice as much', () => {
    expect(C.levelStardust(1)).toBe(10);
    expect(C.levelStardust(11)).toBe(11);
    expect(C.levelStardust(1000)).toBe(20);
  });
});

describe('undo and restart', () => {
  it('takes pours back while free undos last, and then offers more', () => {
    const s = createState(T0);
    const shelf = R.openShelf(s, 'level', DAY);
    if (!shelf) throw new Error('no shelf');
    shelf.undosLeft = 1;
    pours(s, 'level', [[0, 2]]);
    expect(R.toolOffered(s, 'level', 'moreUndos')).toBe(false);
    expect(R.undo(s, 'level')).toBe(true);
    expect(shelf.jars).toEqual(makeLevel(1).puzzle.jars);
    expect(R.undo(s, 'level')).toBe(false);
    pours(s, 'level', [[0, 2]]);
    expect(R.undo(s, 'level')).toBe(false);
    expect(R.toolOffered(s, 'level', 'moreUndos')).toBe(true);
    s.stardust = C.TOOL_COSTS.moreUndos;
    expect(R.buyTool(s, 'level', 'moreUndos')).toBe(true);
    expect(shelf.undosLeft).toBe(C.MORE_UNDOS);
    expect(s.stardust).toBe(0);
    expect(R.undo(s, 'level')).toBe(true);
    expect(s.stats.undos).toBe(2);
    // An undo means the solve is no longer clean.
    expect(pours(s, 'level', TUTORIAL_POURS)?.result?.clean).toBe(false);
  });

  it('restarts the shelf as it was dealt, with the free undos back', () => {
    const s = createState(T0);
    const shelf = R.openShelf(s, 'level', DAY);
    if (!shelf) throw new Error('no shelf');
    expect(R.restart(s, 'level')).toBe(false);
    pours(s, 'level', [
      [0, 2],
      [1, 0],
    ]);
    shelf.undosLeft = 0;
    expect(R.restart(s, 'level')).toBe(true);
    expect(shelf.jars).toEqual(makeLevel(1).puzzle.jars);
    expect(shelf.history).toEqual([]);
    expect(shelf.undosLeft).toBe(C.UNDOS_PER_SHELF);
    // A restart alone keeps a solve clean.
    expect(pours(s, 'level', TUTORIAL_POURS)?.result?.clean).toBe(true);
  });
});

describe('tools', () => {
  it('adds one extra jar for stardust, which a restart keeps', () => {
    const s = stateWith(STUCK, 2);
    expect(R.stuck(s, 'level')).toBe(true);
    expect(R.buyTool(s, 'level', 'extraJar')).toBe(false);
    s.stardust = 100;
    expect(R.buyTool(s, 'level', 'extraJar')).toBe(true);
    expect(s.stardust).toBe(100 - C.TOOL_COSTS.extraJar);
    expect(R.stuck(s, 'level')).toBe(false);
    expect(R.toolOffered(s, 'level', 'extraJar')).toBe(false);
    expect(R.buyTool(s, 'level', 'extraJar')).toBe(false);
    pours(s, 'level', [[0, 2]]);
    R.restart(s, 'level');
    expect(s.shelves.level?.jars).toEqual([[0, 1], [1, 0], []]);
    expect(solveShelf(s)?.clean).toBe(false);
    expect(s.stats.extraJars).toBe(1);
  });

  it('shows a hint on a way to solve the shelf, until the next pour', () => {
    const s = createState(T0);
    s.level = 40;
    const shelf = R.openShelf(s, 'level', DAY);
    if (!shelf) throw new Error('no shelf');
    s.stardust = C.TOOL_COSTS.hint;
    expect(R.toolOffered(s, 'level', 'hint')).toBe(true);
    expect(R.buyTool(s, 'level', 'hint')).toBe(true);
    expect(s.stardust).toBe(0);
    const hint = shelf.hint;
    if (!hint) throw new Error('no hint');
    expect(J.canPour(R.puzzleOf(shelf), hint[0], hint[1])).toBe(true);
    // One hint at a time: the one showing is not sold again.
    expect(R.toolOffered(s, 'level', 'hint')).toBe(false);
    R.pour(s, 'level', hint[0], hint[1]);
    expect(shelf.hint).toBeNull();
    expect(J.solve(R.puzzleOf(shelf), R.HINT_BUDGET) ?? J.solve(R.puzzleOf(shelf), R.HINT_BUDGET, true)).not.toBeNull();
    expect(s.stats.hints).toBe(1);
  });

  it('finds a hint from the start of every one of the first 200 levels', () => {
    for (let level = 1; level <= 200; level++) {
      const s = createState(T0);
      s.level = level;
      const shelf = R.openShelf(s, 'level', DAY);
      if (!shelf) throw new Error('no shelf');
      expect(R.findHint(shelf), `level ${String(level)}`).not.toBeNull();
    }
  });

  it('charges nothing for a hint when there is no way forward', () => {
    // Three pours are allowed here, and none of them leads anywhere.
    const s = stateWith(
      [
        [1, 0],
        [0, 2, 2],
        [1, 2],
        [1, 0],
      ],
      3,
    );
    s.stardust = 100;
    const shelf = s.shelves.level;
    if (!shelf) throw new Error('no shelf');
    expect(R.stuck(s, 'level')).toBe(false);
    expect(R.findHint(shelf)).toBeNull();
    expect(R.toolOffered(s, 'level', 'hint')).toBe(false);
    expect(R.buyTool(s, 'level', 'hint')).toBe(false);
    expect(s.stardust).toBe(100);
  });
});

describe('the daily sky', () => {
  it('pays once a day, counts the streak and has nothing more once it is solved', () => {
    const s = createState(T0);
    const shelf = R.openShelf(s, 'daily', DAY);
    expect(shelf?.jars).toEqual(makeDaily(DAY).puzzle.jars);
    const result = solveShelf(s, 'daily');
    expect(result?.stardust).toBe(C.DAILY_STARDUST + (result?.clean ? C.CLEAN_BONUS : 0));
    expect(result?.streak).toBe(1);
    expect(R.dailyDoneToday(s, DAY)).toBe(true);
    expect(R.openShelf(s, 'daily', DAY)).toBeNull();
    R.openShelf(s, 'daily', '2026-10-30');
    expect(solveShelf(s, 'daily')?.streak).toBe(2);
    expect(R.dailyStreak(s, '2026-10-31')).toBe(2);
    expect(R.dailyStreak(s, '2026-11-01')).toBe(0);
    R.openShelf(s, 'daily', '2026-11-01');
    expect(solveShelf(s, 'daily')?.streak).toBe(1);
    expect(s.daily.bestStreak).toBe(2);
    expect(s.stats.dailies).toBe(3);
  });

  it("gives way to the new day's sky, and counts yesterday's for yesterday when it is solved after midnight", () => {
    const s = createState(T0);
    const yesterday = R.openShelf(s, 'daily', '2026-10-28');
    const today = R.openShelf(s, 'daily', DAY);
    expect(today).not.toBe(yesterday);
    expect(today?.day).toBe(DAY);
    // A sky left open across midnight still counts for its own day.
    const late = createState(T0);
    R.openShelf(late, 'daily', '2026-10-28');
    solveShelf(late, 'daily');
    expect(late.daily.lastDone).toBe('2026-10-28');
    expect(R.openShelf(late, 'daily', DAY)?.day).toBe(DAY);
  });

  it("pays nothing for a sky of a day that was already solved", () => {
    const s = createState(T0);
    s.daily.lastDone = DAY;
    R.openShelf(s, 'daily', '2026-10-28');
    const shelf = s.shelves.daily;
    expect(shelf).not.toBeNull();
    const before = s.stardust;
    const result = solveShelf(s, 'daily');
    expect(result?.stardust).toBe(0);
    expect(s.stardust).toBe(before);
    expect(s.daily.lastDone).toBe(DAY);
  });
});

describe('looks', () => {
  it('sells jar styles and skies for stardust and uses the one bought', () => {
    const s = createState(T0);
    expect(R.jarInUse(s)).toBe('glass');
    expect(R.buyLook(s, 'shell')).toBe(false);
    s.stardust = C.LOOK_COSTS.shell;
    expect(R.buyLook(s, 'shell')).toBe(true);
    expect(s.stardust).toBe(0);
    expect(R.jarInUse(s)).toBe('shell');
    expect(R.buyLook(s, 'shell')).toBe(false);
    expect(R.chooseLook(s, 'glass')).toBe(true);
    expect(R.chooseLook(s, 'aurora')).toBe(false);
    expect(R.skyInUse(s)).toBe('twilight');
  });

  it('gives the Lantern jars with the Night Kit and every look with the Sky Collection', () => {
    const s = createState(T0);
    expect(R.nightKitOffered(s)).toBe(true);
    R.setEntitlements(s, ['night_kit']);
    expect(R.ownsLook(s, 'lantern')).toBe(true);
    expect(R.ownsLook(s, 'crystal')).toBe(false);
    expect(R.nightKitOffered(s)).toBe(false);
    R.setEntitlements(s, ['sky_collection', 'unknown_thing']);
    expect(s.shop.entitlements).toEqual(['sky_collection']);
    expect(R.LOOKS.every((id) => R.ownsLook(s, id))).toBe(true);
    expect(R.skyCollectionOffered(s)).toBe(false);
    expect(R.chooseLook(s, 'meteors')).toBe(true);
    // A refund takes the look back, and the free one is drawn instead.
    R.setEntitlements(s, []);
    expect(R.skyInUse(s)).toBe('twilight');
  });
});

describe('ads and purchases', () => {
  it('offers the tools for a rewarded ad only where they help', () => {
    const s = stateWith(STUCK, 2);
    expect(R.adOffered(s, 'extra_jar', DAY, 'level')).toBe(true);
    expect(R.adOffered(s, 'extra_jar', DAY, 'daily')).toBe(false);
    expect(R.adOffered(s, 'hint', DAY, 'level')).toBe(false);
    expect(R.adOffered(s, 'more_undos', DAY, 'level')).toBe(false);
    expect(R.grantAdReward(s, 'extra_jar', T0, DAY, 'level')).toBe(true);
    expect(s.shelves.level?.jars).toHaveLength(3);
    expect(R.adOffered(s, 'extra_jar', DAY, 'level')).toBe(false);
    expect(R.adOffered(s, 'hint', DAY, 'level')).toBe(true);
    expect(R.grantAdReward(s, 'hint', T0, DAY, 'level')).toBe(true);
    expect(s.shelves.level?.hint).not.toBeNull();
    expect(s.stardust).toBe(0);
  });

  it('doubles the stardust of a result once, but not the constellation bonus', () => {
    const s = createState(T0);
    s.level = 3;
    R.openShelf(s, 'level', DAY);
    const result = solveShelf(s);
    const before = s.stardust;
    expect(R.grantAdReward(s, 'double_stardust', T0, DAY, 'level')).toBe(true);
    expect(s.stardust).toBe(before + (result?.stardust ?? 0));
    expect(R.adOffered(s, 'double_stardust', DAY, 'level')).toBe(false);
  });

  it('counts rewarded ads against daily limits', () => {
    const s = createState(T0);
    for (let i = 0; i < R.AD_LIMITS.perPlacement.free_stardust; i++) expect(R.grantAdReward(s, 'free_stardust', T0, DAY, 'level')).toBe(true);
    expect(R.adOffered(s, 'free_stardust', DAY, 'level')).toBe(false);
    expect(s.stardust).toBe(R.AD_LIMITS.perPlacement.free_stardust * C.FREE_STARDUST);
    expect(R.adOffered(s, 'free_stardust', '2026-10-30', 'level')).toBe(true);
  });

  it('adds what a purchase grants, and takes it back after a refund', () => {
    const s = createState(T0);
    R.grantPurchase(s, { stardust: 600 });
    expect(s.stardust).toBe(600);
    R.grantPurchase(s, { stardust: -600, spools: 4 });
    expect(s.stardust).toBe(0);
  });

  it('starts ad breaks only after a few levels', () => {
    const s = createState(T0);
    s.stats.levels = C.AD_BREAKS_AFTER_LEVELS - 1;
    expect(R.adBreaksEarned(s)).toBe(false);
    s.stats.levels += 1;
    expect(R.adBreaksEarned(s)).toBe(true);
  });
});
