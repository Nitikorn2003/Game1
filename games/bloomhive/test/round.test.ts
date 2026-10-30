import { describe, expect, it } from 'vitest';
import { ROWS, aimAt, cellAt, reachedPip, within, type Board } from '../src/sim/hive.js';
import { levelAt } from '../src/sim/levels.js';
import {
  CLEARED_ROWS,
  MORE_SHOTS,
  NECTAR_FULL,
  addShots,
  copyRound,
  goalsLeft,
  isStuck,
  isWon,
  loaded,
  shoot,
  startRound,
  starsFor,
  swapQueue,
  type Goal,
  type Level,
  type Round,
} from '../src/sim/round.js';
import { boardOf, textOf } from './helpers.js';

function levelWith(rows: readonly string[], goals: readonly Goal[], shots = 10, colours = 3): Level {
  const b = boardOf(rows);
  return {
    layout: b.cells.map((bud) => (bud ? { kind: bud.kind, bee: bud.bee, honey: bud.honey, butterfly: bud.butterfly } : null)),
    colours,
    shots,
    goals,
  };
}

function roundOf(rows: readonly string[], queue: [number, number], shots = 10): Round {
  return { board: boardOf(rows), rng: 7, shotsLeft: shots, shotsMade: 0, queue, nectar: 0, bomb: false, freed: 0, collected: [0, 0, 0, 0, 0, 0], continues: 0 };
}

const TOP: Goal = { kind: 'top' };
/** A goal no test board reaches, which keeps a round going. */
const FAR: Goal = { kind: 'collect', colour: 2, count: 99 };
const kinds = (steps: readonly { kind: string }[]) => steps.map((s) => s.kind);

describe('a shot of pollen', () => {
  it('sticks, pops three of its colour and takes one pollen; the next comes up', () => {
    const rows = ['. . . . a a . . . . .'];
    const r = roundOf(rows, [0, 1]);
    const shot = shoot(r, levelWith(rows, [TOP]), 92);
    expect(shot).toMatchObject({ kind: 'pollen', colour: 0, cell: cellAt(1, 4), won: true, stuck: false, filled: false });
    expect(kinds(shot?.steps ?? [])).toEqual(['stick', 'pop']);
    expect(shot?.steps[1]?.popped).toHaveLength(3);
    expect(r.shotsLeft).toBe(9);
    expect(r.shotsMade).toBe(1);
    expect(r.queue[0]).toBe(1);
    expect(r.collected[0]).toBe(3);
    expect(textOf(r.board)).toEqual([]);
  });

  it('stays put beside one of its colour', () => {
    const rows = ['. . . . . a . . . . .'];
    const r = roundOf(rows, [0, 1]);
    const shot = shoot(r, levelWith(rows, [TOP]), 92);
    expect(kinds(shot?.steps ?? [])).toEqual(['stick']);
    expect(shot?.won).toBe(false);
    expect(textOf(r.board)).toEqual(['. . . . . a . . . . .', '. . . . a . . . . .']);
  });

  it('frees a bee when the buds holding its bud pop and it falls', () => {
    const rows = ['. . . . . a a . . . .', '. . . . . b+ . . . .'];
    const level = levelWith(rows, [{ kind: 'bees', count: 1 }]);
    const r = roundOf(rows, [0, 1]);
    expect(goalsLeft(r, level)).toEqual([1]);
    const shot = shoot(r, level, aimAt(cellAt(1, 4)));
    expect(kinds(shot?.steps ?? [])).toEqual(['stick', 'pop', 'fall']);
    expect(shot?.steps[2]?.fallen.map((g) => g.cell)).toEqual([cellAt(1, 5)]);
    expect(shot?.freed).toBe(1);
    expect(r.freed).toBe(1);
    expect(shot?.won).toBe(true);
    expect(isWon(r, level)).toBe(true);
  });

  it('swaps the pollen in hand for the next, which takes none', () => {
    const r = roundOf([], [0, 2]);
    expect(swapQueue(r)).toBe(true);
    expect(r.queue).toEqual([2, 0]);
    expect(swapQueue(roundOf([], [1, 1]))).toBe(false);
  });

  it('only comes in colours some bud still has', () => {
    const rows = ['b b . . . . . . . . a', 'b . . . . . . . . .'];
    const r = roundOf(rows, [0, 0]);
    // The pollen pops the last of the a's.
    r.board.cells[cellAt(1, 9)] = { id: 99, kind: 'bud', colour: 0, bee: false, honey: false, butterfly: false };
    shoot(r, levelWith(rows, [FAR]), aimAt(cellAt(0, 9)));
    expect(textOf(r.board)).toEqual(['b b . . . . . . . . .', 'b . . . . . . . . .']);
    expect(r.queue).toEqual([1, 1]);
  });

  it('moves the butterflies on after every shot that does not end the round', () => {
    const rows = ['a^ . . . . . . . . . b'];
    const r = roundOf(rows, [2, 2]);
    const shot = shoot(r, levelWith(rows, [FAR]), 92);
    expect(kinds(shot?.steps ?? [])).toEqual(['stick', 'butterflies']);
    expect(shot?.steps[1]?.changed).toEqual([cellAt(0, 0)]);
    expect(r.board.cells[cellAt(0, 0)]?.colour).toBe(1);
  });

  it('plays out the same from the same round', () => {
    const level = levelAt(12);
    const a = startRound(level, 42);
    const b = startRound(level, 42);
    expect(b).toEqual(a);
    const c = copyRound(a);
    for (const angle of [80, 100, 65, 120, 90]) {
      shoot(a, level, angle);
      shoot(c, level, angle);
    }
    expect(c).toEqual(a);
    expect(startRound(level, 43).board).not.toEqual(startRound(level, 42).board);
  });
});

describe('the nectar jar', () => {
  it('fills with buds popped and fallen, and gives a bomb that takes no pollen', () => {
    const rows = ['. . . . a a . b c b c', '. . . . . . b c b c'];
    const level = levelWith(rows, [FAR]);
    const r = roundOf(rows, [0, 1]);
    r.nectar = NECTAR_FULL - 3;
    // Sticks under the two a's: it makes three, and the jar is full.
    const shot = shoot(r, level, 92);
    expect(shot?.steps[1]?.popped).toHaveLength(3);
    expect(shot?.filled).toBe(true);
    expect(r.bomb).toBe(true);
    expect(r.nectar).toBe(0);
    expect(loaded(r)).toBe('jar');
    const left = r.shotsLeft;
    const queue = [...r.queue];
    const blast = shoot(r, level, 90);
    expect(blast).toMatchObject({ kind: 'jar', colour: -1, cell: cellAt(0, 5) });
    expect(r.bomb).toBe(false);
    expect(r.shotsLeft).toBe(left);
    expect(r.queue).toEqual(queue);
    // It pops everything within two cells of where it struck.
    expect(blast?.steps[0]?.popped.map((g) => g.cell).sort((p, q) => p - q)).toEqual([cellAt(0, 7), cellAt(1, 6)]);
    for (const cell of within(cellAt(0, 5), 2)) expect(r.board.cells[cell] ?? null).toBeNull();
    expect(textOf(r.board)).toEqual(['. . . . . . . . c b c', '. . . . . . . c b c']);
  });

  it('can be shot with no pollen left', () => {
    const r = roundOf(['a b . . . . . . . . .'], [0, 1], 0);
    const level = levelWith(['a b . . . . . . . . .'], [FAR]);
    expect(isStuck(r, level)).toBe(true);
    r.bomb = true;
    expect(isStuck(r, level)).toBe(false);
    expect(shoot(r, level, 90)?.kind).toBe('jar');
    expect(isStuck(r, level)).toBe(true);
  });
});

describe('tools', () => {
  it('a rainbow takes the colour that pops, and takes no pollen', () => {
    const rows = ['. . . . b b . . . . a'];
    const r = roundOf(rows, [0, 0]);
    const shot = shoot(r, levelWith(rows, [FAR]), 92, 'rainbow');
    expect(shot).toMatchObject({ kind: 'rainbow', colour: 1 });
    expect(shot?.steps[1]?.popped).toHaveLength(3);
    expect(r.shotsLeft).toBe(10);
    expect(r.queue).toEqual([0, 0]);
  });

  it('a sunbeam pops every bud on its way up to the branch', () => {
    const rows = ['a b c a b c a b c a b', 'c a b c a b c a b c', 'a b c a b c a b c a b'];
    const r = roundOf(rows, [0, 0]);
    const shot = shoot(r, levelWith(rows, [FAR]), 90, 'sunbeam');
    expect(shot?.kind).toBe('sunbeam');
    expect(shot?.cell).toBeNull();
    const popped = shot?.steps[0]?.popped.map((g) => g.cell).sort((p, q) => p - q);
    expect(popped).toEqual([cellAt(0, 5), cellAt(1, 4), cellAt(1, 5), cellAt(2, 5)]);
    expect(r.shotsLeft).toBe(10);
  });

  it('a bomb pops wax as well', () => {
    const rows = ['W W W . . . . . . . .', 'W W . . . . . . . .'];
    const r = roundOf(rows, [0, 0]);
    shoot(r, levelWith(rows, [FAR]), aimAt(cellAt(2, 1)), 'bomb');
    expect(textOf(r.board)).toEqual([]);
  });
});

describe('the end of a round', () => {
  it('is stuck with no pollen left, and five more go on', () => {
    const rows = ['a b . . . . . . . . .'];
    const level = levelWith(rows, [FAR]);
    const r = roundOf(rows, [0, 1], 0);
    expect(isStuck(r, level)).toBe(true);
    expect(shoot(r, level, 90)).toBeNull();
    expect(shoot(r, level, 90, 'bomb')).toBeNull();
    expect(addShots(r, level)).toBe(true);
    expect(r.shotsLeft).toBe(MORE_SHOTS);
    expect(r.continues).toBe(1);
    expect(isStuck(r, level)).toBe(false);
    expect(addShots(r, level)).toBe(false);
  });

  it('is stuck once a bud reaches Pip; five more pollen blow away the lowest rows', () => {
    // A thin stem down the middle, a or b by turns so it never matches.
    const rows = Array.from({ length: ROWS - 1 }, (_, row) => (row % 2 === 0 ? `. . . . . ${row % 4 === 0 ? 'a' : 'b'} . . . . .` : `. . . . ${row % 4 === 1 ? 'b' : 'a'} . . . . .`));
    const level = levelWith(rows, [FAR]);
    const r = roundOf(rows, [2, 2]);
    const shot = shoot(r, level, 90);
    expect(reachedPip(r.board)).toBe(true);
    expect(shot?.stuck).toBe(true);
    expect(isStuck(r, level)).toBe(true);
    expect(shoot(r, level, 90)).toBeNull();
    expect(addShots(r, level)).toBe(true);
    expect(r.shotsLeft).toBe(9 + MORE_SHOTS);
    expect(textOf(r.board)).toHaveLength(ROWS - CLEARED_ROWS);
    expect(isStuck(r, level)).toBe(false);
  });

  it('gives three stars with a quarter of the pollen to spare, two with a tenth, one after more pollen', () => {
    const level = levelWith([], [FAR], 20);
    const r = roundOf([], [0, 0], 5);
    expect(starsFor(r, level)).toBe(3);
    r.shotsLeft = 4;
    expect(starsFor(r, level)).toBe(2);
    r.shotsLeft = 2;
    expect(starsFor(r, level)).toBe(2);
    r.shotsLeft = 1;
    expect(starsFor(r, level)).toBe(1);
    r.shotsLeft = 10;
    r.continues = 1;
    expect(starsFor(r, level)).toBe(1);
  });
});

describe('a new round', () => {
  it('starts with the level’s pollen, in colours the board has', () => {
    for (const n of [1, 13, 40, 73, 96]) {
      const level = levelAt(n);
      const r = startRound(level, n);
      expect(r.shotsLeft).toBe(level.shots);
      const colours = new Set(r.board.cells.flatMap((bud) => (bud?.kind === 'bud' ? [bud.colour] : [])));
      expect(colours.has(r.queue[0])).toBe(true);
      expect(colours.has(r.queue[1])).toBe(true);
      expect(isWon(r, level)).toBe(false);
      expect(isStuck(r, level)).toBe(false);
    }
  });

  it('can be copied and played without changing the original', () => {
    const level = levelAt(5);
    const r = startRound(level, 5);
    const before: Board = { cells: [...r.board.cells], nextId: r.board.nextId };
    const copy = copyRound(r);
    shoot(copy, level, 90);
    expect(r.board).toEqual(before);
    expect(r.shotsLeft).toBe(level.shots);
  });
});
