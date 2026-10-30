import { describe, expect, it } from 'vitest';
import { COLOURS, groups, hasMove, remaining } from '../src/sim/board.js';
import { startDive, turtleGoal, type Level } from '../src/sim/dive.js';
import {
  DAILY_EXTRA_MOVES,
  LEVELS_PER_ZONE,
  REEF_LEVELS,
  ZONES,
  dailyLevel,
  levelAt,
  levelsOf,
  parseLayout,
  seedOf,
  zoneOf,
} from '../src/sim/levels.js';
import { DAY, dayAfter } from './helpers.js';

const reef = Array.from({ length: REEF_LEVELS }, (_, i) => i + 1);

describe('the reef', () => {
  it('has eight zones of twelve levels', () => {
    expect(ZONES).toHaveLength(8);
    expect(REEF_LEVELS).toBe(96);
    expect(levelsOf('shallows')).toEqual(Array.from({ length: LEVELS_PER_ZONE }, (_, i) => i + 1));
    expect(levelsOf('lagoon').at(-1)).toBe(96);
    expect(zoneOf(1)).toBe('shallows');
    expect(zoneOf(13)).toBe('meadow');
    expect(zoneOf(96)).toBe('lagoon');
    expect(zoneOf(97)).toBeNull();
  });

  it('gives every level moves, goals it can reach and colours its goals use', () => {
    for (const n of reef) {
      const level = levelAt(n);
      expect(level.moves, `level ${String(n)}`).toBeGreaterThanOrEqual(8);
      expect(level.goals.length).toBeGreaterThan(0);
      expect(level.colours).toBeGreaterThanOrEqual(4);
      expect(level.colours).toBeLessThanOrEqual(COLOURS.length);
      const left = remaining(startDive(level, 1).board);
      for (const goal of level.goals) {
        if (goal.kind === 'collect') expect(goal.colour, `level ${String(n)}`).toBeLessThan(level.colours);
        if (goal.kind === 'sand') expect(left.sand, `level ${String(n)}`).toBeGreaterThan(0);
        if (goal.kind === 'rock') expect(left.rock, `level ${String(n)}`).toBeGreaterThan(0);
        if (goal.kind === 'kelp') expect(left.kelp, `level ${String(n)}`).toBeGreaterThan(0);
        if (goal.kind === 'turtle') expect(goal.count).toBeGreaterThan(0);
      }
    }
  });

  it('brings each zone’s new thing in its own zone first', () => {
    const kinds = (zone: (typeof ZONES)[number]) => new Set(levelsOf(zone).flatMap((n) => levelAt(n).goals.map((goal) => goal.kind)));
    expect([...kinds('shallows')]).toEqual(['collect']);
    expect(kinds('meadow').has('sand')).toBe(true);
    expect(kinds('meadow').has('kelp')).toBe(false);
    expect(kinds('kelp').has('kelp')).toBe(true);
    expect(kinds('kelp').has('rock')).toBe(false);
    expect(kinds('garden').has('rock')).toBe(true);
    expect(kinds('garden').has('turtle')).toBe(false);
    expect(kinds('beach').has('turtle')).toBe(true);
    // All six colours fall only from the caves on.
    for (const n of reef) expect(levelAt(n).colours === 6).toBe(n > 72);
  });

  it('starts every level with a full board, no match on it and a move to make', () => {
    for (const n of reef) {
      const level = levelAt(n);
      for (const seed of [1, 2, 3]) {
        const d = startDive(level, seed);
        const b = d.board;
        const empty = b.pieces.filter((piece, cell) => b.open[cell] && (b.rock[cell] ?? 0) === 0 && piece === null);
        expect(empty, `level ${String(n)}`).toEqual([]);
        expect(groups(b), `level ${String(n)}`).toEqual([]);
        expect(hasMove(b), `level ${String(n)}`).toBe(true);
        expect(d.turtles.spawned).toBe(Math.min(level.turtlesAtOnce, turtleGoal(level)));
      }
    }
  });

  it('draws boards from text, and refuses a board it cannot read', () => {
    const layout = parseLayout(['.-s', 'SrR', 'kK.']);
    expect(layout.open).toEqual([true, false, true, true, true, true, true, true, true]);
    expect(layout.sand).toEqual([0, 0, 1, 2, 0, 0, 0, 1, 0]);
    expect(layout.rock).toEqual([0, 0, 0, 0, 1, 2, 0, 0, 0]);
    expect(layout.kelp).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 0]);
    expect(() => parseLayout(['...', '..'])).toThrow();
    expect(() => parseLayout(['.x.'])).toThrow();
  });
});

describe('the open sea', () => {
  it('goes on for ever past the reef, on the boards of the reef past its first two zones, in other colours', () => {
    for (const n of [97, 98, 168, 169, 500, 10_000]) {
      const level = levelAt(n);
      expect(level.moves).toBeGreaterThanOrEqual(8);
      for (const goal of level.goals) if (goal.kind === 'collect') expect(goal.colour).toBeLessThan(level.colours);
    }
    expect(levelAt(97).layout).toEqual(levelAt(25).layout);
    // Level 27 asks for pieces of one colour besides its kelp; the sea asks for another.
    expect(levelAt(99).layout).toEqual(levelAt(27).layout);
    expect(levelAt(99).goals).not.toEqual(levelAt(27).goals);
    // Round after round of the same boards, each round in new colours.
    expect(levelAt(99 + 72).layout).toEqual(levelAt(27).layout);
    expect(levelAt(99 + 72).goals).not.toEqual(levelAt(99).goals);
  });
});

/** The reef level a level was made from: the same board and goals, the collect goals perhaps in other colours. */
function sourceOf(level: Level): number | undefined {
  const shape = (l: Level) => JSON.stringify([l.layout, l.colours, l.turtlesAtOnce, l.goals.map((goal) => (goal.kind === 'collect' ? goal.count : goal))]);
  return reef.find((n) => shape(levelAt(n)) === shape(level));
}

describe('the daily dive', () => {
  it('is the same level for everyone on a day, with two more moves than its board had in the reef', () => {
    expect(dailyLevel(DAY)).toEqual(dailyLevel(DAY));
    const week = Array.from({ length: 7 }, (_, i) => dailyLevel(dayAfter(DAY, i)));
    expect(new Set(week.map((level) => JSON.stringify(level))).size).toBeGreaterThan(4);
    for (const level of week) {
      const source = sourceOf(level);
      expect(source).toBeDefined();
      expect(level.moves).toBe((source ? levelAt(source).moves : 0) + DAILY_EXTRA_MOVES);
    }
  });

  it('never picks a board from the first zone', () => {
    for (let i = 0; i < 60; i++) expect(sourceOf(dailyLevel(dayAfter(DAY, i)))).toBeGreaterThan(LEVELS_PER_ZONE);
  });
});

describe('seeds', () => {
  it('give a new board on each try, and the same board for the same try', () => {
    expect(seedOf('level:5', 0)).toBe(seedOf('level:5', 0));
    expect(seedOf('level:5', 1)).not.toBe(seedOf('level:5', 0));
    expect(seedOf('level:6', 0)).not.toBe(seedOf('level:5', 0));
  });
});
