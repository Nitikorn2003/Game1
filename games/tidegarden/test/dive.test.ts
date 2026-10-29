import { describe, expect, it } from 'vitest';
import { TURTLE, groups, movesOf, type Board } from '../src/sim/board.js';
import {
  MORE_MOVES,
  addMoves,
  canSwap,
  claw,
  freeSwap,
  goalsLeft,
  isStuck,
  isWon,
  starsFor,
  startDive,
  swap,
  tide,
  type Dive,
  type Goal,
  type Level,
} from '../src/sim/dive.js';
import { botMove } from '../src/sim/bot.js';
import { levelAt, parseLayout } from '../src/sim/levels.js';
import { boardOf, textOf } from './helpers.js';

function levelFor(b: Board, goals: Goal[], moves = 10): Level {
  const rows = Array.from({ length: b.height }, (_, y) =>
    Array.from({ length: b.width }, (_, x) => (b.open[y * b.width + x] ? '.' : '-')).join(''),
  );
  return { layout: parseLayout(rows), colours: 4, moves, goals, turtlesAtOnce: 1 };
}

function diveOn(b: Board, level: Level): Dive {
  return { board: b, rng: 1, movesLeft: level.moves, movesMade: 0, collected: [0, 0, 0, 0, 0, 0], turtles: { spawned: 0, saved: 0 }, continues: 0 };
}

describe('a dive', () => {
  it('starts with the level’s moves, on the same board from the same seed', () => {
    const level = levelAt(5);
    const a = startDive(level, 42);
    const b = startDive(level, 42);
    expect(a.movesLeft).toBe(level.moves);
    expect(a.board.pieces).toEqual(b.board.pieces);
    expect(startDive(level, 43).board.pieces).not.toEqual(a.board.pieces);
    expect(groups(a.board)).toEqual([]);
    expect(movesOf(a.board).length).toBeGreaterThan(0);
  });

  it('takes a move for a swap that works, and none for one that does not', () => {
    const b = boardOf(['a b a c', 'b a b d', 'c d c a', 'd c d b']);
    const level = levelFor(b, [{ kind: 'collect', colour: 0, count: 30 }]);
    const d = diveOn(b, level);
    expect(swap(d, level, 0, 1)).toBeNull();
    expect(d.movesLeft).toBe(10);
    const played = swap(d, level, 1, 5);
    expect(played?.steps[0]?.kind).toBe('swap');
    expect(played?.steps[1]?.kind).toBe('clear');
    expect(d.movesLeft).toBe(9);
    expect(d.movesMade).toBe(1);
    expect(d.collected[0]).toBeGreaterThanOrEqual(3);
    // The last step shows the board as the dive has it.
    expect(played?.steps.at(-1)?.pieces).toEqual(d.board.pieces);
    expect(d.board.pieces.every((piece) => piece !== null)).toBe(true);
  });

  it('is won once every goal is reached, and takes no more moves', () => {
    const b = boardOf(['a b a c', 'b a b d', 'c d c a', 'd c d b']);
    const level = levelFor(b, [{ kind: 'collect', colour: 0, count: 3 }]);
    const d = diveOn(b, level);
    const played = swap(d, level, 1, 5);
    expect(played?.won).toBe(true);
    expect(isWon(d, level)).toBe(true);
    expect(goalsLeft(d, level)).toEqual([0]);
    const move = movesOf(d.board)[0];
    if (move) expect(swap(d, level, move.from, move.to)).toBeNull();
  });

  it('runs out of moves, and five more can be added then', () => {
    const b = boardOf(['a b a c', 'b a b d', 'c d c a', 'd c d b']);
    const level = levelFor(b, [{ kind: 'collect', colour: 0, count: 99 }], 1);
    const d = diveOn(b, level);
    expect(addMoves(d, level)).toBe(false);
    expect(swap(d, level, 1, 5)?.stuck).toBe(true);
    expect(isStuck(d, level)).toBe(true);
    expect(addMoves(d, level)).toBe(true);
    expect(d.movesLeft).toBe(MORE_MOVES);
    expect(d.continues).toBe(1);
    expect(starsFor({ ...d, collected: [99, 0, 0, 0, 0, 0] }, level)).toBe(1);
  });

  it('gives three stars with a quarter of the moves to spare, two with a tenth', () => {
    const level = levelAt(12);
    const d = startDive(level, 1);
    const at = (movesLeft: number) => starsFor({ ...d, movesLeft }, level);
    expect(at(Math.round(level.moves * 0.25))).toBe(3);
    expect(at(Math.round(level.moves * 0.25) - 1)).toBe(2);
    expect(at(Math.max(1, Math.round(level.moves * 0.1)))).toBe(2);
    expect(at(0)).toBe(1);
  });

  it('brings turtles down: one that reaches the bottom row leaves the board, and counts', () => {
    const b = boardOf(['c a c', 'b T b', 'a b a']);
    const level = levelFor(b, [{ kind: 'turtle', count: 1 }]);
    const d = diveOn(b, level);
    d.turtles.spawned = 1;
    expect(canSwap(d, 4, 7)).toBe(true);
    const played = swap(d, level, 4, 7);
    expect(played?.steps.map((step) => step.kind)).toContain('save');
    expect(d.turtles.saved).toBe(1);
    expect(played?.won).toBe(true);
    expect(d.board.pieces.some((piece) => piece?.kind === TURTLE)).toBe(false);
  });

  it('lets a turtle crawl down a cell for a move, with no match, and leave from the bottom row', () => {
    const b = boardOf(['a b c d', 'b T d a', 'c d a b']);
    const level = levelFor(b, [{ kind: 'turtle', count: 1 }]);
    const d = diveOn(b, level);
    d.turtles.spawned = 1;
    expect(canSwap(d, 5, 9)).toBe(true);
    const played = swap(d, level, 5, 9);
    expect(played?.steps.slice(0, 2).map((step) => step.kind)).toEqual(['swap', 'save']);
    expect(d.movesLeft).toBe(level.moves - 1);
    expect(d.turtles.saved).toBe(1);
    expect(played?.won).toBe(true);
    expect(d.board.pieces.some((piece) => piece?.kind === TURTLE)).toBe(false);
  });

  it('sends in a new turtle once one has left, until the goal’s turtles have all come', () => {
    const level = levelAt(49);
    const d = startDive(level, 3);
    expect(d.board.pieces.filter((piece) => piece?.kind === TURTLE)).toHaveLength(1);
    expect(d.board.pieces.slice(0, d.board.width).some((piece) => piece?.kind === TURTLE)).toBe(true);
    for (let i = 0; i < 200 && d.turtles.saved < 2; i++) {
      const move = botMove(d, level);
      if (!move) break;
      d.movesLeft = 50;
      swap(d, level, move.from, move.to);
      expect(d.board.pieces.filter((piece) => piece?.kind === TURTLE).length).toBeLessThanOrEqual(1);
    }
    expect(d.turtles.saved).toBe(2);
    expect(d.turtles.spawned).toBe(2);
  });

  it('uses the tools without taking a move: the claw, the tide and the crab’s free swap', () => {
    const b = boardOf(['a b c d', 'b c d a', 'c d a b', 'd a b c']);
    const level = levelFor(b, [{ kind: 'collect', colour: 0, count: 50 }]);
    const d = diveOn(b, level);
    expect(claw(d, level, 0)?.steps[0]?.kind).toBe('clear');
    expect(d.collected[0]).toBeGreaterThanOrEqual(1);
    expect(tide(d, level, 3)).not.toBeNull();
    expect(d.collected.reduce((sum, n) => sum + n, 0)).toBeGreaterThanOrEqual(5);
    const before = textOf(d.board);
    // Two neighbours of different colours, which make no match when swapped.
    const at = [0, 1, 2].find((cell) => d.board.pieces[cell]?.kind !== d.board.pieces[cell + 1]?.kind) ?? 0;
    expect(freeSwap(d, level, at, at + 1)).not.toBeNull();
    expect(textOf(d.board)).not.toEqual(before);
    expect(d.movesLeft).toBe(10);
    expect(d.movesMade).toBe(0);
  });

  it('never lets a tool clear a turtle or an empty cell', () => {
    const b = boardOf(['T a', 'b x']);
    const level = levelFor(b, [{ kind: 'turtle', count: 1 }]);
    const d = diveOn(b, level);
    expect(claw(d, level, 0)).toBeNull();
    expect(claw(d, level, 3)).toBeNull();
  });
});
