import { Rng } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import {
  cluesOf,
  EMPTY,
  FILLED,
  givensFor,
  hintFor,
  lineCells,
  lineSolve,
  runsOf,
  settleLine,
  truthOf,
  UNKNOWN,
  unknownCount,
  type CellState,
  type Shape,
} from '../src/sim/nonogram.js';

const F = FILLED;
const E = EMPTY;
const U = UNKNOWN;

/** A shape drawn as text: '#' filled, '.' empty. */
function shapeOf(rows: readonly string[]): Shape {
  return { width: rows[0]?.length ?? 0, height: rows.length, filled: rows.join('').split('').map((c) => c === '#') };
}

/** What every filling of the line that matches the clue and the known cells agrees on, found by trying them all. */
function bruteSettle(clue: readonly number[], line: readonly CellState[]): CellState[] | null {
  const n = line.length;
  let agreed: CellState[] | null = null;
  for (let bits = 0; bits < 1 << n; bits++) {
    const filled = Array.from({ length: n }, (_, i) => ((bits >> i) & 1) === 1);
    if (filled.some((f, i) => (line[i] === F && !f) || (line[i] === E && f))) continue;
    const runs = runsOf(filled);
    if (runs.length !== clue.length || runs.some((r, i) => r !== clue[i])) continue;
    const states = filled.map((f): CellState => (f ? F : E));
    agreed = agreed ? agreed.map((s, i) => (s === states[i] ? s : U)) : states;
  }
  return agreed && agreed.map((s, i) => (line[i] !== U ? (line[i] ?? U) : s));
}

describe('runs and clues', () => {
  it('reads the runs of a line', () => {
    expect(runsOf([])).toEqual([]);
    expect(runsOf([false, false])).toEqual([]);
    expect(runsOf([true, true, false, true, false, false, true, true, true])).toEqual([2, 1, 3]);
  });

  it('gives every row and column its clue', () => {
    const clues = cluesOf(shapeOf(['##.', '.#.', '###']));
    expect(clues.rows).toEqual([[2], [1], [3]]);
    expect(clues.cols).toEqual([[1, 1], [3], [1]]);
  });

  it('numbers the cells of rows and columns', () => {
    expect(lineCells({ width: 3, height: 2 }, { axis: 'row', index: 1 })).toEqual([3, 4, 5]);
    expect(lineCells({ width: 3, height: 2 }, { axis: 'col', index: 2 })).toEqual([2, 5]);
  });
});

describe('the logic of one line', () => {
  it('finds the cells every placement of a run covers', () => {
    expect(settleLine([3], [U, U, U, U, U])).toEqual([U, U, F, U, U]);
    expect(settleLine([5], [U, U, U, U, U])).toEqual([F, F, F, F, F]);
    expect(settleLine([1, 1], [U, U, U])).toEqual([F, E, F]);
    expect(settleLine([], [U, U, U])).toEqual([E, E, E]);
  });

  it('uses the cells already known', () => {
    expect(settleLine([1], [U, U, F, U, U])).toEqual([E, E, F, E, E]);
    expect(settleLine([2], [U, F, U, U, U])).toEqual([U, F, U, E, E]);
    expect(settleLine([3], [U, U, E, U, U, U])).toEqual([E, E, E, F, F, F]);
  });

  it('says when nothing fits', () => {
    expect(settleLine([3], [U, U])).toBeNull();
    expect(settleLine([], [U, F, U])).toBeNull();
    expect(settleLine([1, 1], [F, F, U])).toBeNull();
  });

  it('agrees with trying every filling, on thousands of random lines', () => {
    const rng = new Rng(7);
    for (let round = 0; round < 4000; round++) {
      const n = 1 + rng.int(10);
      // A clue from a random filling, then some of that filling's cells shown, and now and then a wrong one.
      const truth = Array.from({ length: n }, () => rng.chance(0.55));
      const clue = rng.chance(0.1) ? runsOf(Array.from({ length: n }, () => rng.chance(0.5))) : runsOf(truth);
      const line = truth.map((f): CellState => (rng.chance(0.3) ? (f !== rng.chance(0.05) ? F : E) : U));
      expect(settleLine(clue, line), `${JSON.stringify(clue)} ${JSON.stringify(line)}`).toEqual(bruteSettle(clue, line));
    }
  });
});

describe('solving a field line by line', () => {
  const heart = shapeOf(['.#.#.', '#####', '#####', '.###.', '..#..']);

  it('solves a field that needs no guessing', () => {
    const size = { width: 5, height: 5 };
    const { board, contradiction } = lineSolve(cluesOf(heart), size, new Array<CellState>(25).fill(U));
    expect(contradiction).toBe(false);
    expect(board).toEqual(heart.filled.map((f) => (f ? F : E)));
    expect(givensFor(heart)).toEqual([]);
  });

  it('stops where a field has two answers, and shows a cell there to settle it', () => {
    const diagonal = shapeOf(['#.', '.#']);
    const size = { width: 2, height: 2 };
    expect(unknownCount(lineSolve(cluesOf(diagonal), size, [U, U, U, U]).board)).toBe(4);
    const givens = givensFor(diagonal);
    expect(givens).toHaveLength(1);
    const start: CellState[] = [U, U, U, U];
    for (const cell of givens) start[cell] = truthOf(diagonal, cell);
    expect(lineSolve(cluesOf(diagonal), size, start).board).toEqual([F, E, E, F]);
  });

  it('finds a contradiction', () => {
    expect(lineSolve(cluesOf(heart), { width: 5, height: 5 }, [E, ...new Array<CellState>(24).fill(U)]).contradiction).toBe(false);
    expect(lineSolve(cluesOf(heart), { width: 5, height: 5 }, [U, U, U, U, U, E, ...new Array<CellState>(19).fill(U)]).contradiction).toBe(true);
  });

  it('makes any random picture solvable with its givens, and hints then finish it', () => {
    const rng = new Rng(11);
    for (let round = 0; round < 40; round++) {
      const width = 4 + rng.int(9);
      const height = 4 + rng.int(9);
      const shape: Shape = { width, height, filled: Array.from({ length: width * height }, () => rng.chance(0.55)) };
      const size = { width, height };
      const clues = cluesOf(shape);
      const board = new Array<CellState>(width * height).fill(U);
      for (const cell of givensFor(shape)) board[cell] = truthOf(shape, cell);
      expect(unknownCount(lineSolve(clues, size, board).board)).toBe(0);
      // Hint after hint from the givens alone, each one right, until the picture is done.
      for (let hints = 0; unknownCount(board) > 0; hints++) {
        expect(hints).toBeLessThan(width * height);
        const hint = hintFor(clues, size, board);
        expect(hint).not.toBeNull();
        for (const { cell, state } of hint?.cells ?? []) {
          expect(state).toBe(truthOf(shape, cell));
          board[cell] = state;
        }
      }
    }
  });

  it('gives no hint for a finished field', () => {
    expect(hintFor(cluesOf(heart), { width: 5, height: 5 }, heart.filled.map((f) => (f ? F : E)))).toBeNull();
  });
});
