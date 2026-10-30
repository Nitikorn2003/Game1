import { exportSave, importSave } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import { cellAt } from '../src/sim/hive.js';
import { levelAt } from '../src/sim/levels.js';
import { MORE_SHOTS, NECTAR_FULL } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import { createState, restoreState, saveFormat, type GameState } from '../src/sim/state.js';
import { DAY, T0, playToWin, reachedTo } from './helpers.js';

/** A game some way in: levels reached, a round in progress with pollen shot and a tool used, a daily meadow, a bought look. */
function played(): GameState {
  const s = createState(T0);
  R.startLevel(s, 1);
  playToWin(s);
  R.openDaily(s, DAY);
  playToWin(s);
  R.startLevel(s, 2);
  if (!R.shoot(s, 90)) throw new Error('no shot');
  if (!R.shoot(s, 60, 'rainbow')) throw new Error('no rainbow');
  R.seeTip(s, 'swap');
  s.coins += 1000;
  R.buyLook(s, 'sunset');
  R.setEntitlements(s, ['remove_ads']);
  R.grantAdReward(s, 'free_coins', T0, DAY, 0);
  s.settings.sound = false;
  return s;
}

const roundTrip = (s: GameState): GameState => restoreState(JSON.parse(JSON.stringify(s)) as Record<string, unknown>);

type BudData = Record<string, unknown> | null | string;
interface Data extends Record<string, unknown> {
  current: {
    mode: unknown;
    level: unknown;
    day: unknown;
    round: Record<string, unknown> & { board: { cells: BudData[]; nextId: unknown } };
  };
}

const dataOf = (s: GameState) => JSON.parse(JSON.stringify(s)) as Data;

describe('the save', () => {
  it('reads back exactly what it saved', () => {
    const s = played();
    expect(s.stars).toEqual([3]);
    expect(s.current).toMatchObject({ mode: 'meadow', level: 2 });
    // The rainbow took no pollen.
    expect(s.current?.round.shotsMade).toBe(1);
    expect(s.tools.rainbow).toBe(C.START_TOOLS.rainbow - 1);
    expect(roundTrip(s)).toEqual(s);
    // And the results of a round.
    const t = createState(T0);
    R.startLevel(t, 1);
    playToWin(t);
    expect(t.result).not.toBeNull();
    expect(roundTrip(t)).toEqual(t);
  });

  it('goes through the save text a player can copy, and back', () => {
    const s = played();
    const back = importSave(saveFormat, exportSave(saveFormat, s, T0));
    expect(back.state).toEqual(s);
    expect(back.version).toBe(saveFormat.version);
  });

  it('plays a restored round on exactly as the saved one would have', () => {
    const s = played();
    const t = roundTrip(s);
    for (let i = 0; i < 5; i++) {
      const a = R.hintAim(s);
      expect(R.hintAim(t)).toEqual(a);
      if (!a) break;
      if (a.swap) {
        R.swapPollen(s);
        R.swapPollen(t);
      }
      expect(R.shoot(t, a.angle)).toEqual(R.shoot(s, a.angle));
      expect(t.current?.round).toEqual(s.current?.round);
    }
  });

  it('keeps out buds that cannot be: in no cell, of no kind, of a colour the level has not, or with an id already taken', () => {
    const s = played();
    const data = dataOf(s);
    const cells = data.current.round.board.cells;
    const taken = cells.findIndex((bud) => typeof bud === 'object' && bud?.kind === 'bud' && bud.bee === false);
    const free = cells.findIndex((bud, cell) => bud === null && cell < 33);
    // The last cell of an odd row is never used.
    cells[cellAt(1, 10)] = { id: 500, kind: 'bud', colour: 0, bee: false, honey: false, butterfly: false };
    cells[free] = { id: 501, kind: 'leaf', colour: 0 };
    cells[free + 1] = { id: 502, kind: 'bud', colour: 9 };
    const twin = cells[taken];
    cells[free + 2] = typeof twin === 'object' && twin ? { ...twin } : null;
    const back = restoreState(data).current;
    if (!back) throw new Error('the round was dropped');
    const b = back.round.board;
    expect(b.cells[cellAt(1, 10)]).toBeNull();
    expect(b.cells[free]).toBeNull();
    expect(b.cells[free + 1]).toBeNull();
    expect(b.cells[free + 2]?.id).not.toBe(b.cells[taken]?.id);
    const ids = b.cells.flatMap((bud) => (bud ? [bud.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(b.nextId).toBeGreaterThan(Math.max(...ids));
  });

  it('lets go of a board with more wax, puffs, bees, honey or butterflies than its level started with', () => {
    // Level 25 has wax and bees; level 2 has bees only.
    const s = reachedTo(createState(T0), 25);
    R.startLevel(s, 25);
    const extra = (mark: Record<string, unknown>) => {
      const data = dataOf(s);
      const cells = data.current.round.board.cells;
      const free = cells.findIndex((bud, cell) => bud === null && cell > cellAt(8, 0) && cell < cellAt(9, 0));
      cells[free] = { id: 900, kind: 'bud', colour: 0, bee: false, honey: false, butterfly: false, ...mark };
      return restoreState(data).current;
    };
    expect(extra({})).not.toBeNull();
    expect(extra({ kind: 'wax' })).toBeNull();
    expect(extra({ kind: 'puff' })).toBeNull();
    expect(extra({ bee: true })).toBeNull();
    expect(extra({ honey: true })).toBeNull();
    expect(extra({ butterfly: true })).toBeNull();
    // Wax holds no bee.
    const data = dataOf(s);
    const cells = data.current.round.board.cells;
    const wax = cells.findIndex((bud) => typeof bud === 'object' && bud?.kind === 'wax');
    cells[wax] = { ...(cells[wax] as Record<string, unknown>), bee: true };
    expect(restoreState(data).current?.round.board.cells[wax]).toMatchObject({ kind: 'wax', bee: false });
  });

  it('lets go of a round it cannot read, one at a level not open, and one already reached', () => {
    const s = played();
    const broken = dataOf(s);
    broken.current.round.board.cells = [];
    expect(restoreState(broken).current).toBeNull();
    const closed = dataOf(s);
    closed.current.level = 50;
    expect(restoreState(closed).current).toBeNull();
    const daily = dataOf(s);
    daily.current.mode = 'daily';
    daily.current.day = 'not a day';
    expect(restoreState(daily).current).toBeNull();
    // Every bee of level 2 freed already.
    const won = dataOf(s);
    won.current.round.freed = 99;
    expect(restoreState(won).current).toBeNull();
    // The rest of the save is kept.
    expect(restoreState(won).stars).toEqual([3]);
  });

  it('keeps no more pollen than the level and the five more taken would give, and a jar and a queue that can be', () => {
    const data = dataOf(played());
    data.current.round.shotsLeft = 500;
    data.current.round.nectar = 1e6;
    data.current.round.queue = [42, -3];
    expect(restoreState(data).current?.round).toMatchObject({ shotsLeft: levelAt(2).shots, nectar: NECTAR_FULL - 1, queue: [levelAt(2).colours - 1, 0] });
    data.current.round.continues = 2;
    expect(restoreState(data).current?.round.shotsLeft).toBe(levelAt(2).shots + 2 * MORE_SHOTS);
  });

  it('keeps stars between one and three, and a pouch between empty and full', () => {
    const data = dataOf(played());
    data.stars = [3, 0, 9, 'x'];
    data.tools = { rainbow: -4, bomb: 1e9, sunbeam: 'many' };
    const back = restoreState(data);
    expect(back.stars).toEqual([3, 1, 3, 1]);
    expect(back.tools).toEqual({ rainbow: 0, bomb: C.MAX_TOOLS, sunbeam: C.START_TOOLS.sunbeam });
  });

  it('starts over cleanly from a save that is all junk', () => {
    const junk = { coins: 'lots', stars: 'all', current: 7, daily: [], result: 'won', tools: null, looks: 3, tips: [1, 'swap', 'nope'], stats: 'x' };
    const s = restoreState(junk);
    expect(s.coins).toBe(0);
    expect(s.stars).toEqual([]);
    expect(s.current).toBeNull();
    expect(s.result).toBeNull();
    expect(s.tools).toEqual(C.START_TOOLS);
    expect(s.looks).toEqual({ sky: 'morning', hat: 'leaf', bought: [] });
    expect(s.tips).toEqual(['swap']);
  });

  it('can owe honey after a refund', () => {
    const data = dataOf(played());
    data.coins = -300;
    expect(restoreState(data).coins).toBe(-300);
  });
});
