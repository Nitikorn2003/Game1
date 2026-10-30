import { describe, expect, it } from 'vitest';
import { ALL_CELLS, COLOURS, MAX_PATCH, budsIn, groupAt, heldCells, rowOf } from '../src/sim/hive.js';
import {
  DAILY_EXTRA_SHOTS,
  LEVELS_PER_ZONE,
  MEADOW_LEVELS,
  ZONES,
  dailyLevel,
  levelAt,
  levelsOf,
  seedOf,
  zoneOf,
  type ZoneId,
} from '../src/sim/levels.js';
import { beesIn, startRound, type Level } from '../src/sim/round.js';
import { DAY, dayAfter } from './helpers.js';

const meadow = Array.from({ length: MEADOW_LEVELS }, (_, i) => i + 1);
const has = (level: Level, test: (seed: NonNullable<Level['layout'][number]>) => boolean) => level.layout.some((seed) => seed !== null && test(seed));

describe('the meadow', () => {
  it('has eight zones of twelve levels', () => {
    expect(ZONES).toHaveLength(8);
    expect(MEADOW_LEVELS).toBe(96);
    expect(levelsOf('clover')).toEqual(Array.from({ length: LEVELS_PER_ZONE }, (_, i) => i + 1));
    expect(levelsOf('queen').at(-1)).toBe(96);
    expect(zoneOf(1)).toBe('clover');
    expect(zoneOf(13)).toBe('sunflower');
    expect(zoneOf(96)).toBe('queen');
    expect(zoneOf(97)).toBeNull();
  });

  it('gives every level pollen, colours and goals it can reach', () => {
    for (const n of meadow) {
      const level = levelAt(n);
      const at = `level ${String(n)}`;
      expect(level.shots, at).toBeGreaterThanOrEqual(6);
      expect(level.colours, at).toBeGreaterThanOrEqual(3);
      expect(level.colours, at).toBeLessThanOrEqual(COLOURS.length);
      expect(level.goals.length, at).toBeGreaterThan(0);
      for (const goal of level.goals) {
        if (goal.kind === 'bees') expect(goal.count, at).toBe(beesIn(level.layout));
        if (goal.kind === 'bees') expect(goal.count, at).toBeGreaterThan(0);
        if (goal.kind === 'collect') expect(goal.colour, at).toBeLessThan(level.colours);
        // Wax only falls, and nothing holds the top row up but the branch: wax there would never go.
        if (goal.kind === 'top') expect([...Array(11).keys()].some((cell) => level.layout[cell]?.kind === 'wax'), at).toBe(false);
      }
      if (!level.goals.some((goal) => goal.kind === 'bees')) expect(beesIn(level.layout), at).toBe(0);
    }
  });

  it('leaves room above Pip on every board, and hangs every bud from the branch', () => {
    for (const n of meadow) {
      const r = startRound(levelAt(n), 1);
      const cells = ALL_CELLS.filter((cell) => r.board.cells[cell]);
      expect(Math.max(...cells.map(rowOf)), `level ${String(n)}`).toBeLessThanOrEqual(7);
      expect(budsIn(r.board, 0), `level ${String(n)}`).toBeGreaterThan(0);
      const held = heldCells(r.board);
      expect(cells.filter((cell) => !held.has(cell)), `level ${String(n)}`).toEqual([]);
    }
  });

  it('starts every board with its colours in small patches, so every pop takes a shot', () => {
    for (const n of meadow) {
      const level = levelAt(n);
      for (const seed of [1, 2, 3]) {
        const b = startRound(level, seed).board;
        const biggest = Math.max(0, ...ALL_CELLS.map((cell) => groupAt(b, cell).length));
        expect(biggest, `level ${String(n)}, seed ${String(seed)}`).toBeLessThanOrEqual(MAX_PATCH);
        // Every colour of the level is on the board, so the pollen comes in each of them.
        const colours = new Set(b.cells.flatMap((bud) => (bud?.kind === 'bud' ? [bud.colour] : [])));
        expect(colours.size, `level ${String(n)}, seed ${String(seed)}`).toBe(level.colours);
      }
    }
  });

  it('brings each zone’s new thing in its own zone first', () => {
    const first = (test: (level: Level) => boolean) => meadow.find((n) => test(levelAt(n)));
    expect(first((level) => level.goals.some((goal) => goal.kind !== 'bees'))).toBe(13);
    expect(first((level) => has(level, (seed) => seed.kind === 'wax'))).toBe(25);
    expect(first((level) => has(level, (seed) => seed.honey))).toBe(37);
    expect(first((level) => has(level, (seed) => seed.kind === 'puff'))).toBe(49);
    expect(first((level) => has(level, (seed) => seed.butterfly))).toBe(61);
    expect(first((level) => level.colours === 6)).toBe(73);
    // Each zone keeps its own thing on most of its boards.
    const share = (zone: ZoneId, test: (level: Level) => boolean) => levelsOf(zone).filter((n) => test(levelAt(n))).length;
    expect(share('hollow', (level) => has(level, (seed) => seed.kind === 'wax'))).toBe(12);
    expect(share('orchard', (level) => has(level, (seed) => seed.honey))).toBe(12);
    expect(share('dandelion', (level) => has(level, (seed) => seed.kind === 'puff'))).toBe(12);
    expect(share('butterfly', (level) => has(level, (seed) => seed.butterfly))).toBe(12);
    expect(share('moonlit', (level) => level.colours === 6)).toBe(12);
  });
});

describe('the wild meadow', () => {
  it('goes on for ever past the meadow, on the boards of the meadow past its first two zones, in other colours', () => {
    for (const n of [97, 98, 168, 169, 500, 10_000]) {
      const level = levelAt(n);
      expect(level.shots).toBeGreaterThanOrEqual(6);
      for (const goal of level.goals) if (goal.kind === 'collect') expect(goal.colour).toBeLessThan(level.colours);
    }
    expect(levelAt(97).layout).toEqual(levelAt(25).layout);
    // Level 33 asks for buds of two colours; the wild meadow asks for others.
    expect(levelAt(105).layout).toEqual(levelAt(33).layout);
    expect(levelAt(105).goals).not.toEqual(levelAt(33).goals);
    // Round after round of the same boards, each round in new colours.
    expect(levelAt(105 + 72).layout).toEqual(levelAt(33).layout);
    expect(levelAt(105 + 72).goals).not.toEqual(levelAt(105).goals);
  });
});

/** The meadow level a level was made from: the same board and goals, the collect goals perhaps in other colours. */
function sourceOf(level: Level): number | undefined {
  const shape = (l: Level) => JSON.stringify([l.layout, l.colours, l.goals.map((goal) => (goal.kind === 'collect' ? goal.count : goal))]);
  return meadow.find((n) => shape(levelAt(n)) === shape(level));
}

describe('the daily meadow', () => {
  it('is the same level for everyone on a day, with three more pollen than its board had in the meadow', () => {
    expect(dailyLevel(DAY)).toEqual(dailyLevel(DAY));
    const week = Array.from({ length: 7 }, (_, i) => dailyLevel(dayAfter(DAY, i)));
    expect(new Set(week.map((level) => JSON.stringify(level))).size).toBeGreaterThan(4);
    for (const level of week) {
      const source = sourceOf(level);
      expect(source).toBeDefined();
      expect(level.shots).toBe((source ? levelAt(source).shots : 0) + DAILY_EXTRA_SHOTS);
    }
  });

  it('never picks a board from the first zone', () => {
    for (let i = 0; i < 60; i++) expect(sourceOf(dailyLevel(dayAfter(DAY, i)))).toBeGreaterThan(LEVELS_PER_ZONE);
  });
});

describe('seeds', () => {
  it('give new colours on each try, and the same colours for the same try', () => {
    expect(seedOf('level:5', 0)).toBe(seedOf('level:5', 0));
    expect(seedOf('level:5', 1)).not.toBe(seedOf('level:5', 0));
    expect(seedOf('level:6', 0)).not.toBe(seedOf('level:5', 0));
    const level = levelAt(5);
    expect(startRound(level, seedOf('level:5', 0))).toEqual(startRound(level, seedOf('level:5', 0)));
    expect(startRound(level, seedOf('level:5', 1)).board).not.toEqual(startRound(level, seedOf('level:5', 0)).board);
  });
});
