import { describe, expect, it } from 'vitest';
import { COUNTER_H, COUNTER_W, PASTRIES, coverOf, layerOf, stackOf, type Slot } from '../src/sim/counter.js';
import * as C from '../src/sim/content.js';
import {
  DAILY_FEWER_KINDS,
  LANE_LEVELS,
  LEVELS_PER_ZONE,
  MAX_KINDS,
  SHAPES,
  ZONES,
  dailyLevel,
  fit,
  levelAt,
  levelsOf,
  seedOf,
  zoneOf,
  type ShapeId,
  type ZoneId,
} from '../src/sim/levels.js';
import { dealOf, isWon, startRound, take, type Level } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import { DAY, dayAfter } from './helpers.js';

const lane = Array.from({ length: LANE_LEVELS }, (_, i) => i + 1);
const stacked = (level: Level) => level.slots.some((s) => stackOf(s.z) > 0);
const bagged = (level: Level) => level.bags.some(Boolean);
const boxed = (level: Level) => level.locks.some((lock) => lock > 0);
const sprinkled = (level: Level) => level.sprinkles.some(Boolean);
const key = (s: Slot) => `${String(s.x)},${String(s.y)},${String(s.z)}`;

/** Plays a deal along the way it was made, and says how full the tray got; -1 if a tile could not be taken. */
function planPeak(level: Level, seed: number): number {
  const r = startRound(level, seed);
  for (const tile of dealOf(level, seed).order) if (!take(r, level, tile)) return -1;
  return isWon(r) ? r.peak : -1;
}

describe('the lane', () => {
  it('has eight shops of twelve levels', () => {
    expect(ZONES).toHaveLength(8);
    expect(LANE_LEVELS).toBe(96);
    expect(levelsOf('bread')).toEqual(Array.from({ length: LEVELS_PER_ZONE }, (_, i) => i + 1));
    expect(levelsOf('cakes').at(-1)).toBe(96);
    expect(zoneOf(1)).toBe('bread');
    expect(zoneOf(13)).toBe('cafe');
    expect(zoneOf(96)).toBe('cakes');
    expect(zoneOf(97)).toBeNull();
  });

  it('fits every counter on the screen, a tile in each place, in whole sets of three', () => {
    for (const n of lane) {
      const level = levelAt(n);
      const at = `level ${String(n)}`;
      const tiles = level.slots.length;
      expect(tiles % 3, at).toBe(0);
      expect(tiles, at).toBeGreaterThanOrEqual(9);
      for (const s of level.slots) {
        expect(s.x >= 0 && s.y >= 0 && s.x + 2 <= COUNTER_W && s.y + 2 <= COUNTER_H, `${at}: ${key(s)}`).toBe(true);
        expect(stackOf(s.z), at).toBeLessThan(10);
      }
      expect(new Set(level.slots.map(key)).size, at).toBe(tiles);
      expect([level.bags.length, level.locks.length, level.sprinkles.length], at).toEqual([tiles, tiles, tiles]);
      expect(level.kinds, at).toBeGreaterThanOrEqual(3);
      expect(level.kinds, at).toBeLessThanOrEqual(Math.min(MAX_KINDS, tiles / 3));
      // A ribbon box waits for sets that can be boxed up without it.
      for (const lock of level.locks) expect(lock, at).toBeLessThan(tiles / 3);
    }
  });

  it('starts every counter with a few tiles to take', () => {
    for (const n of lane) {
      const free = coverOf(levelAt(n).slots).filter((above) => above.length === 0);
      expect(free.length, `level ${String(n)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('deals every counter so that it can be cleared with three stars', () => {
    for (const n of lane) {
      const level = levelAt(n);
      for (let k = 0; k < 4; k++) {
        const peak = planPeak(level, seedOf(`level:${String(n)}`, k));
        expect(peak > 0 && peak <= 4, `level ${String(n)}, try ${String(k)}: ${String(peak)}`).toBe(true);
      }
    }
  });

  it('brings each shop’s new thing in its own shop first, where its note is', () => {
    const first = (test: (level: Level) => boolean) => lane.find((n) => test(levelAt(n)));
    expect(first((level) => layerOf(Math.max(...level.slots.map((s) => s.z))) > 0)).toBe(C.TIP_LEVELS.covered);
    expect(first(bagged)).toBe(C.TIP_LEVELS.bag);
    expect(first(stacked)).toBe(C.TIP_LEVELS.stack);
    expect(first(boxed)).toBe(C.TIP_LEVELS.box);
    expect(first(sprinkled)).toBe(C.TIP_LEVELS.sprinkles);
    // Each shop keeps its own thing on most of its counters.
    const share = (zone: ZoneId, test: (level: Level) => boolean) => levelsOf(zone).filter((n) => test(levelAt(n))).length;
    expect(share('cookies', bagged)).toBe(12);
    expect(share('cupcakes', stacked)).toBeGreaterThanOrEqual(8);
    expect(share('pies', boxed)).toBe(12);
    expect(share('donuts', sprinkled)).toBe(12);
    // The Chocolate Shop puts two of them together on every counter.
    for (const n of levelsOf('chocolate')) expect([bagged, stacked, boxed, sprinkled].filter((has) => has(levelAt(n))).length, `level ${String(n)}`).toBeGreaterThanOrEqual(2);
    for (const tip of C.TIPS) expect(R.tipOf(C.TIP_LEVELS[tip])).toBe(tip);
  });

  it('asks for more kinds of pastry as the shops go on', () => {
    const kinds = (zone: ZoneId) => levelsOf(zone).reduce((sum, n) => sum + levelAt(n).kinds, 0) / LEVELS_PER_ZONE;
    for (let z = 1; z < ZONES.length; z++) expect(kinds(ZONES[z] ?? 'cakes'), ZONES[z]).toBeGreaterThan(kinds('bread'));
    expect(kinds('cakes')).toBeGreaterThan(kinds('cafe') + 3);
    expect(Math.max(...lane.map((n) => levelAt(n).kinds))).toBe(MAX_KINDS);
    expect(MAX_KINDS).toBeLessThan(PASTRIES.length);
  });
});

describe('fitting a counter', () => {
  it('takes the fewest tiles off the top that leave whole sets, a pair either side of the middle', () => {
    // A row of five over a row of six: eleven tiles, two too many.
    const shape: Slot[] = [...Array.from({ length: 6 }, (_, i) => ({ x: 2 * i, y: 0, z: 0 })), ...Array.from({ length: 5 }, (_, i) => ({ x: 1 + 2 * i, y: 0, z: 10 }))];
    const slots = fit(shape);
    expect(slots).toHaveLength(9);
    const gone = shape.filter((s) => !slots.some((t) => key(t) === key(s)));
    expect(gone).toEqual([
      { x: 3, y: 0, z: 10 },
      { x: 7, y: 0, z: 10 },
    ]);
    // One too many: the middle tile.
    expect(fit(shape.slice(0, 10)).map(key)).not.toContain('5,0,10');
    expect(fit(shape.slice(0, 9))).toHaveLength(9);
  });

  it('keeps the counters that are drawn the same either side the same either side', () => {
    const lopsided: readonly ShapeId[] = ['STAIRS', 'ZIGZAG', 'PINWHEEL'];
    for (const id of (Object.keys(SHAPES) as ShapeId[]).filter((id) => !lopsided.includes(id))) {
      const slots = fit(SHAPES[id]);
      const w = Math.max(...slots.map((s) => s.x + 2));
      for (const s of slots) expect(slots.some((t) => t.x === w - 2 - s.x && t.y === s.y && t.z === s.z), `${id}: ${key(s)}`).toBe(true);
    }
  });
});

describe('the late shift', () => {
  it('goes on for ever past the lane, baking the counters past its first two shops again with a kind more each time round', () => {
    for (const n of [97, 98, 168, 169, 500, 10_000]) {
      const level = levelAt(n);
      expect(level.kinds).toBeLessThanOrEqual(Math.min(MAX_KINDS, level.slots.length / 3));
      expect(planPeak(level, 1)).toBeGreaterThan(0);
    }
    expect(levelAt(97).slots).toBe(levelAt(25).slots);
    // Level 25 has as many kinds as its eighteen tiles can hold already.
    expect(levelAt(97).kinds).toBe(levelAt(25).kinds);
    expect(levelAt(100).slots).toBe(levelAt(28).slots);
    expect(levelAt(100).kinds).toBe(levelAt(28).kinds + 1);
    expect(levelAt(100 + 72).slots).toBe(levelAt(28).slots);
    expect(levelAt(100 + 72).kinds).toBe(levelAt(28).kinds + 2);
    expect(levelAt(10_000).kinds).toBeLessThanOrEqual(MAX_KINDS);
  });
});

describe('the daily special', () => {
  /** The level of the lane a daily special was made from: the same counter. */
  const sourceOf = (level: Level) => lane.find((n) => levelAt(n).slots === level.slots && levelAt(n).locks === level.locks);

  it('is the same level for everyone on a day, with a kind fewer than its counter had on the lane', () => {
    expect(dailyLevel(DAY)).toEqual(dailyLevel(DAY));
    const week = Array.from({ length: 7 }, (_, i) => dailyLevel(dayAfter(DAY, i)));
    expect(new Set(week.map((level) => JSON.stringify(level))).size).toBeGreaterThan(4);
    for (const level of week) {
      const source = sourceOf(level);
      expect(source).toBeDefined();
      expect(level.kinds).toBe(Math.max(3, (source ? levelAt(source).kinds : 0) - DAILY_FEWER_KINDS));
    }
  });

  it('never picks a counter from the first shop, and can always be cleared', () => {
    for (let i = 0; i < 365; i++) {
      const day = dayAfter(DAY, i);
      const level = dailyLevel(day);
      expect(sourceOf(level), day).toBeGreaterThan(LEVELS_PER_ZONE);
      if (i % 5 === 0) expect(planPeak(level, seedOf(`daily:${day}`, 0)), day).toBeGreaterThan(0);
    }
  });
});

describe('seeds', () => {
  it('give a new deal on each try, and the same deal for the same try', () => {
    expect(seedOf('level:5', 0)).toBe(seedOf('level:5', 0));
    expect(seedOf('level:5', 1)).not.toBe(seedOf('level:5', 0));
    expect(seedOf('level:6', 0)).not.toBe(seedOf('level:5', 0));
    const level = levelAt(5);
    expect(startRound(level, seedOf('level:5', 0))).toEqual(startRound(level, seedOf('level:5', 0)));
    expect(startRound(level, seedOf('level:5', 1)).kinds).not.toEqual(startRound(level, seedOf('level:5', 0)).kinds);
  });
});
