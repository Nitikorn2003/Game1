import { exportSave, importSave } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import { TURTLE, movesOf } from '../src/sim/board.js';
import * as C from '../src/sim/content.js';
import { levelAt } from '../src/sim/levels.js';
import * as R from '../src/sim/rules.js';
import { createState, restoreState, saveFormat, type GameState } from '../src/sim/state.js';
import { DAY, T0, playToWin, reachedTo } from './helpers.js';

/** A game some way in: levels reached, a dive in progress with moves made and a tool used, a daily dive, a bought look. */
function played(): GameState {
  const s = createState(T0);
  R.startLevel(s, 1);
  playToWin(s);
  R.openDaily(s, DAY);
  playToWin(s);
  const c = R.startLevel(s, 2);
  const move = c ? movesOf(c.dive.board)[0] : undefined;
  if (!move) throw new Error('no move');
  R.swap(s, move.from, move.to);
  R.playTool(s, { tool: 'claw', cell: 20 });
  R.seeTip(s, 'swap');
  s.coins += 1000;
  R.buyLook(s, 'moonlit');
  R.setEntitlements(s, ['remove_ads']);
  R.grantAdReward(s, 'free_coins', T0, DAY, 0);
  s.settings.sound = false;
  return s;
}

const roundTrip = (s: GameState): GameState => restoreState(JSON.parse(JSON.stringify(s)) as Record<string, unknown>);

interface BoardData {
  pieces: ({ id: number; kind: number; special: number } | null | string)[];
  sand: unknown[];
  rock: unknown[];
  kelp: unknown[];
  nextId: unknown;
}
interface Data extends Record<string, unknown> {
  current: { mode: unknown; level: unknown; day: unknown; dive: { board: BoardData; movesLeft: unknown; turtles: unknown; collected: unknown } };
}

const dataOf = (s: GameState) => JSON.parse(JSON.stringify(s)) as Data;

describe('the save', () => {
  it('reads back exactly what it saved', () => {
    const s = played();
    expect(s.stars).toEqual([3]);
    expect(s.current).toMatchObject({ mode: 'reef', level: 2 });
    expect(s.current?.dive.movesMade).toBe(1);
    expect(roundTrip(s)).toEqual(s);
    // And the results of a dive.
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

  it('plays a restored dive on exactly as the saved one would have', () => {
    const s = played();
    const t = roundTrip(s);
    for (let i = 0; i < 5; i++) {
      const a = R.hintMove(s);
      const b = R.hintMove(t);
      expect(b).toEqual(a);
      if (!a) break;
      R.swap(s, a.from, a.to);
      R.swap(t, a.from, a.to);
      expect(t.current?.dive).toEqual(s.current?.dive);
    }
  });

  it('never restores more sand, rock or kelp than the level started with, nor pieces where none can be', () => {
    // Level 41 has two-hit rocks; level 25 kelp; level 13 sand.
    const s = reachedTo(createState(T0), 41);
    R.startLevel(s, 41);
    const data = dataOf(s);
    const layout = levelAt(41).layout;
    const rockCell = layout.rock.findIndex((hits) => hits > 0);
    const board = data.current.dive.board;
    board.rock[rockCell] = 9;
    board.sand[0] = 5;
    board.kelp[1] = 1;
    // A piece on a rock, one of an unknown kind, one with junk, two with the same id.
    board.pieces[rockCell] = { id: 999, kind: 0, special: 0 };
    board.pieces[2] = { id: 3, kind: 42, special: 0 };
    board.pieces[3] = 'coral';
    const twin = board.pieces[4];
    board.pieces[5] = typeof twin === 'object' && twin ? { ...twin, kind: 1 } : null;
    const back = restoreState(data).current;
    if (!back) throw new Error('the dive was dropped');
    const b = back.dive.board;
    expect(b.rock[rockCell]).toBe(2);
    expect(b.pieces[rockCell]).toBeNull();
    expect(b.sand[0]).toBe(0);
    expect(b.kelp[1]).toBe(0);
    expect(b.pieces[2]).toBeNull();
    expect(b.pieces[3]).toBeNull();
    expect(b.pieces[5]?.id).not.toBe(b.pieces[4]?.id);
    const ids = b.pieces.flatMap((piece) => (piece ? [piece.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(b.nextId).toBeGreaterThan(Math.max(...ids));
  });

  it('lets go of a dive it cannot read, one at a level not open, and one already reached', () => {
    const s = played();
    const broken = dataOf(s);
    broken.current.dive.board.pieces = [];
    expect(restoreState(broken).current).toBeNull();
    const closed = dataOf(s);
    closed.current.level = 50;
    expect(restoreState(closed).current).toBeNull();
    const daily = dataOf(s);
    daily.current.mode = 'daily';
    daily.current.day = 'not a day';
    expect(restoreState(daily).current).toBeNull();
    // Everything level 2 asks for, collected already.
    const won = dataOf(s);
    won.current.dive.collected = [99, 99, 99, 99, 99, 99];
    expect(restoreState(won).current).toBeNull();
    // The rest of the save is kept.
    expect(restoreState(won).stars).toEqual([3]);
  });

  it('keeps no more moves than the level and the five more bought would give', () => {
    const data = dataOf(played());
    data.current.dive.movesLeft = 500;
    expect(restoreState(data).current?.dive.movesLeft).toBe(levelAt(2).moves);
  });

  it('counts a turtle on the board as one that came in', () => {
    const s = reachedTo(createState(T0), 49);
    R.startLevel(s, 49);
    const data = dataOf(s);
    data.current.dive.turtles = { spawned: 0, saved: 0 };
    const back = restoreState(data).current;
    expect(back?.dive.board.pieces.filter((piece) => piece?.kind === TURTLE)).toHaveLength(1);
    expect(back?.dive.turtles).toEqual({ spawned: 1, saved: 0 });
  });

  it('keeps stars between one and three, and a bag between empty and full', () => {
    const data = dataOf(played());
    data.stars = [3, 0, 9, 'x'];
    data.tools = { claw: -4, tide: 1e9, crab: 'many' };
    const back = restoreState(data);
    expect(back.stars).toEqual([3, 1, 3, 1]);
    expect(back.tools).toEqual({ claw: 0, tide: C.MAX_TOOLS, crab: C.START_TOOLS.crab });
  });

  it('starts over cleanly from a save that is all junk', () => {
    const junk = { coins: 'lots', stars: 'all', current: 7, daily: [], result: 'won', tools: null, looks: 3, tips: [1, 'swap', 'nope'], stats: 'x' };
    const s = restoreState(junk);
    expect(s.coins).toBe(0);
    expect(s.stars).toEqual([]);
    expect(s.current).toBeNull();
    expect(s.result).toBeNull();
    expect(s.tools).toEqual(C.START_TOOLS);
    expect(s.looks).toEqual({ water: 'sunlit', buddy: 'clownfish', bought: [] });
    expect(s.tips).toEqual(['swap']);
  });

  it('can owe sand dollars after a refund', () => {
    const data = dataOf(played());
    data.coins = -300;
    expect(restoreState(data).coins).toBe(-300);
  });
});
