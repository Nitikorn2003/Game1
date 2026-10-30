import { describe, expect, it } from 'vitest';
import * as J from '../src/sim/jars.js';

const puzzle = (jars: J.Jar[], capacity = 4): J.Puzzle => ({ jars, capacity });

describe('pouring', () => {
  it('pours the top run onto its own colour or into an empty jar, as much as fits', () => {
    const p = puzzle([[0, 1, 1], [2, 1], [], [0, 2, 2, 2]]);
    expect(J.pourAmount(p, 0, 1)).toBe(2);
    expect(J.pourAmount(p, 0, 2)).toBe(2);
    // Not onto another colour, not out of an empty jar, not into a full jar, not into itself.
    expect(J.pourAmount(p, 1, 3)).toBe(0);
    expect(J.pourAmount(p, 2, 0)).toBe(0);
    expect(J.pourAmount(p, 1, 0)).toBe(1);
    expect(J.pourAmount(p, 0, 3)).toBe(0);
    expect(J.pourAmount(p, 0, 0)).toBe(0);
    expect(J.pourAmount(p, 0, 9)).toBe(0);
    expect(J.pour(p, 0, 1)).toBe(2);
    expect(p.jars).toEqual([[0], [2, 1, 1, 1], [], [0, 2, 2, 2]]);
  });

  it('pours only what fits and leaves the rest of the run', () => {
    const p = puzzle([[1, 1, 1], [0, 0, 1], []]);
    expect(J.pour(p, 0, 1)).toBe(1);
    expect(p.jars).toEqual([[1, 1], [0, 0, 1, 1], []]);
  });

  it('takes a pour back exactly', () => {
    const p = puzzle([[0, 1, 1], [1], []]);
    const before = J.copy(p);
    const n = J.pour(p, 0, 1);
    J.unpour(p, 0, 1, n);
    expect(p).toEqual(before);
  });

  it('knows a solved shelf and a stuck one', () => {
    expect(J.solved(puzzle([[0, 0, 0, 0], [], [1, 1, 1, 1]]))).toBe(true);
    expect(J.solved(puzzle([[0, 0, 0], [0], [1, 1, 1, 1]]))).toBe(false);
    const stuck = puzzle([[0, 1], [1, 0]], 2);
    expect(J.stuck(stuck)).toBe(true);
    expect(J.stuck(puzzle([[0, 1], [1, 0], []], 2))).toBe(false);
  });

  it('checks that every colour fills exactly one jar', () => {
    expect(J.wellFormed(puzzle([[0, 1, 0, 1], [1, 0, 1, 0], []]))).toBe(true);
    expect(J.wellFormed(puzzle([[0, 1, 0], [1, 0, 1, 0], []]))).toBe(false);
    expect(J.wellFormed(puzzle([[0, 0, 0, 0, 0]]))).toBe(false);
    expect(J.wellFormed(puzzle([[-1, -1, -1, -1], []]))).toBe(false);
    expect(J.colourCount(puzzle([[0, 1, 0, 1], [1, 0, 1, 0], []]))).toBe(2);
  });
});

describe('the solver', () => {
  it('solves the first level in three pours', () => {
    const p = puzzle([[0, 0, 0, 1], [1, 1, 1, 0], []]);
    const solution = J.solve(p);
    expect(solution?.moves).toHaveLength(3);
    for (const [from, to] of solution?.moves ?? []) expect(J.pour(p, from, to)).toBeGreaterThan(0);
    expect(J.solved(p)).toBe(true);
  });

  it('says so when there is no way', () => {
    expect(J.solve(puzzle([[0, 1], [1, 0]], 2))).toBeNull();
    expect(J.solve(puzzle([[0, 1], [1, 0]], 2), 1000, true)).toBeNull();
  });

  it('never tries a pour that changes nothing', () => {
    const p = puzzle([[0, 0], [1, 2, 1], [2, 2, 1], [0], [], []], 3);
    const moves = J.usefulMoves(p);
    // Jars of one colour stay out of empty jars, and only the first empty jar is tried.
    expect(moves).not.toContainEqual([0, 4]);
    expect(moves).not.toContainEqual([1, 5]);
    expect(moves).toContainEqual([1, 4]);
    expect(moves[0]).toEqual([0, 3]);
  });

  it('finds the way a quick search misses when asked to be thorough', () => {
    // The only way starts by splitting the two 0s on the third jar over the first two jars.
    const p = puzzle([[2, 2, 0], [2, 2, 0], [1, 1, 0, 0], [1, 1]]);
    expect(J.wellFormed(p)).toBe(true);
    expect(J.solve(p)).toBeNull();
    const thorough = J.solve(p, 10_000, true);
    expect(thorough).not.toBeNull();
    const copy = J.copy(p);
    for (const [from, to] of thorough?.moves ?? []) J.pour(copy, from, to);
    expect(J.solved(copy)).toBe(true);
  });
});
