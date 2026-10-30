import { describe, expect, it } from 'vitest';
import { levelAt } from '../src/sim/levels.js';
import {
  MORE_ROOM,
  RACK,
  TRAY,
  canMakeRoom,
  copyRound,
  dealOf,
  hidden,
  isStuck,
  isWon,
  makeRoom,
  rollingPin,
  shut,
  spatula,
  startRound,
  starsFor,
  take,
  takeable,
  tilesLeft,
  uncovered,
  whisk,
} from '../src/sim/round.js';
import { levelWith, pastriesLeft, roundWith, row } from './helpers.js';

describe('taking a pastry', () => {
  it('puts it on the tray next to the others of its kind, and boxes up three of a kind', () => {
    const level = levelWith(row(9));
    const r = roundWith([0, 1, 0, 2, 1, 0, 2, 1, 2]);
    expect(take(r, level, 0)).toEqual({ tile: 0, from: 'counter', slot: 0, set: null, sprinkled: 0, opened: [], won: false, stuck: false });
    expect(take(r, level, 1)?.slot).toBe(1);
    expect(take(r, level, 2)?.slot).toBe(1);
    expect(take(r, level, 3)?.slot).toBe(3);
    expect(r.tray).toEqual([0, 2, 1, 3]);
    const set = take(r, level, 5);
    expect(set).toMatchObject({ slot: 2, set: [0, 2, 5], won: false });
    expect(r.tray).toEqual([1, 3]);
    expect(r.at.filter((p) => p === 'gone')).toHaveLength(3);
    expect(r.sets).toBe(1);
    // The tray is measured once the set is boxed up: it held four at the most.
    expect(r.peak).toBe(4);
    expect(r.taken).toEqual([
      { tile: 1, from: 'counter' },
      { tile: 3, from: 'counter' },
    ]);
    for (const tile of [4, 6, 7]) take(r, level, tile);
    expect(tilesLeft(r)).toBe(3);
    expect(take(r, level, 8)).toMatchObject({ set: [3, 6, 8], won: true, stuck: false });
    expect(isWon(r)).toBe(true);
    expect(r.peak).toBe(4);
    expect(starsFor(r)).toBe(3);
  });

  it('cannot take a tile that something covers, until that is taken', () => {
    const level = levelWith([
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 1, y: 0, z: 10 },
    ]);
    const r = roundWith([0, 0, 0]);
    expect(uncovered(r, level)).toEqual([false, false, true]);
    expect(takeable(r, level)).toEqual([false, false, true]);
    expect(take(r, level, 0)).toBeNull();
    expect(take(r, level, 2)).not.toBeNull();
    expect(takeable(r, level)).toEqual([true, true, false]);
    // A tile on the tray, or boxed up, cannot be taken again.
    expect(take(r, level, 2)).toBeNull();
    take(r, level, 0);
    expect(take(r, level, 1)?.won).toBe(true);
    expect(take(r, level, 1)).toBeNull();
  });

  it('stops at a full tray, until room is made by sending pastries up to the rack, those without a pair first', () => {
    const level = levelWith(row(21), { kinds: 7 });
    const r = roundWith(Array.from({ length: 21 }, (_, i) => i % 7));
    for (const tile of [2, 3, 4, 5, 6, 0]) expect(take(r, level, tile)?.stuck).toBe(false);
    expect(canMakeRoom(r)).toBe(false);
    expect(take(r, level, 7)?.stuck).toBe(true);
    expect(r.tray).toEqual([2, 3, 4, 5, 6, 0, 7]);
    expect(isStuck(r)).toBe(true);
    expect(r.peak).toBe(TRAY);
    expect(take(r, level, 1)).toBeNull();
    expect(canMakeRoom(r)).toBe(true);
    expect(makeRoom(r)).toEqual([6, 5, 4]);
    expect(r.tray).toEqual([2, 3, 0, 7]);
    expect(r.rack).toEqual([6, 5, 4]);
    expect(r.continues).toBe(1);
    expect(r.taken.map((t) => t.tile)).toEqual([2, 3, 0, 7]);
    // A pastry on the rack can go back on the tray at any time.
    expect(take(r, level, 5)).toMatchObject({ from: 'rack', slot: 4 });
    expect(r.rack).toEqual([6, 4]);
    expect(take(r, level, 14)?.set).toEqual([0, 7, 14]);
    expect(makeRoom(r)).toBeNull();
    expect(starsFor(r)).toBe(1);
  });

  it('makes room only while the rack has space for three more', () => {
    const level = levelWith(row(21), { kinds: 7 });
    const r = roundWith(Array.from({ length: 21 }, (_, i) => i % 7));
    for (let tile = 0; tile < 7; tile++) take(r, level, tile);
    expect(makeRoom(r)).toHaveLength(MORE_ROOM);
    for (const tile of [7, 8, 9]) take(r, level, tile);
    expect(makeRoom(r)).toHaveLength(MORE_ROOM);
    expect(r.rack).toHaveLength(6);
    for (const tile of [10, 11, 12]) take(r, level, tile);
    expect(isStuck(r)).toBe(true);
    expect(r.rack.length + MORE_ROOM).toBeGreaterThan(RACK);
    expect(canMakeRoom(r)).toBe(false);
    expect(makeRoom(r)).toBeNull();
  });

  it('hides a pastry in a paper bag while anything covers it', () => {
    const level = levelWith(
      [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 10 },
        { x: 4, y: 0, z: 0 },
      ],
      { bags: [true, false, true] },
    );
    const r = roundWith([0, 0, 0]);
    expect(hidden(r, level, 0, uncovered(r, level))).toBe(true);
    // A bag nothing covers shows its pastry, and so does any tile not in a bag.
    expect(hidden(r, level, 2, uncovered(r, level))).toBe(false);
    expect(hidden(r, level, 1, uncovered(r, level))).toBe(false);
    take(r, level, 1);
    expect(hidden(r, level, 0, uncovered(r, level))).toBe(false);
  });

  it('keeps a ribbon box shut until enough sets are boxed up', () => {
    const level = levelWith(row(9), { locks: [0, 0, 0, 1, 1, 1, 2, 2, 2] });
    const r = roundWith([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    expect(takeable(r, level)).toEqual([true, true, true, false, false, false, false, false, false]);
    expect(shut(r, level, 3)).toBe(true);
    expect(take(r, level, 3)).toBeNull();
    take(r, level, 0);
    take(r, level, 1);
    expect(take(r, level, 2)).toMatchObject({ set: [0, 1, 2], opened: [3, 4, 5] });
    expect(shut(r, level, 3)).toBe(false);
    expect(take(r, level, 6)).toBeNull();
    take(r, level, 3);
    take(r, level, 4);
    expect(take(r, level, 5)?.opened).toEqual([6, 7, 8]);
  });

  it('opens the ribbon boxes early when nothing else on the counter can be taken', () => {
    const level = levelWith(row(3), { locks: [2, 2, 2] });
    const r = roundWith([0, 0, 0]);
    expect(takeable(r, level)).toEqual([true, true, true]);
    take(r, level, 0);
    take(r, level, 1);
    expect(take(r, level, 2)?.won).toBe(true);
  });

  it('counts the sprinkled pastries boxed up', () => {
    const level = levelWith(row(3), { sprinkles: [true, false, true] });
    const r = roundWith([0, 0, 0]);
    take(r, level, 0);
    take(r, level, 1);
    expect(take(r, level, 2)?.sprinkled).toBe(2);
    expect(r.sprinkled).toBe(2);
  });

  it('gives three stars for a tray that never held more than four, two for five and one for more', () => {
    const r = roundWith([]);
    const stars = [0, 4, 5, 6, 7].map((peak) => starsFor({ ...r, peak }));
    expect(stars).toEqual([3, 3, 2, 1, 1]);
  });

  it('copies a round without sharing anything with it', () => {
    const level = levelWith(row(6));
    const r = roundWith([0, 0, 0, 1, 1, 1]);
    take(r, level, 0);
    const copy = copyRound(r);
    expect(copy).toEqual(r);
    take(copy, level, 3);
    expect(r.tray).toEqual([0]);
    expect(r.at[3]).toBe('counter');
    expect(r.taken).toHaveLength(1);
  });
});

describe('the spatula', () => {
  it('puts the newest pastry on the tray back where it came from', () => {
    const level = levelWith(row(6));
    const r = roundWith([0, 0, 0, 1, 1, 1]);
    expect(spatula(r)).toBeNull();
    take(r, level, 0);
    take(r, level, 3);
    expect(spatula(r)).toEqual({ tile: 3, to: 'counter', slot: 1 });
    expect(r.at[3]).toBe('counter');
    expect(r.tray).toEqual([0]);
    expect(spatula(r)).toEqual({ tile: 0, to: 'counter', slot: 0 });
    expect(spatula(r)).toBeNull();
    // A set boxed up stays boxed up.
    for (const tile of [0, 1, 2]) take(r, level, tile);
    expect(spatula(r)).toBeNull();
  });

  it('puts a pastry from the rack back on the rack', () => {
    const level = levelWith(row(6));
    const r = roundWith([0, 0, 0, 1, 1, 1]);
    r.at[4] = 'rack';
    r.rack = [4];
    take(r, level, 4);
    expect(r.rack).toEqual([]);
    expect(spatula(r)).toEqual({ tile: 4, to: 'rack', slot: 0 });
    expect(r.rack).toEqual([4]);
    expect(r.at[4]).toBe('rack');
  });
});

describe('the whisk', () => {
  // Two tiles on top, each over two of the four below: a b a b, then b over the first pair and a over the second.
  const level = levelWith([
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 6, y: 0, z: 0 },
    { x: 1, y: 0, z: 10 },
    { x: 5, y: 0, z: 10 },
  ]);
  const kinds = [0, 1, 0, 1, 1, 0];

  it('whips up a set of the first pastry on the tray, from what can be taken before what is covered', () => {
    const r = roundWith(kinds);
    take(r, level, 5);
    expect(whisk(r, level)).toEqual({ kind: 0, set: [5, 2, 0], from: ['tray', 'counter', 'counter'], sprinkled: 0, opened: [], won: false });
    expect(r.tray).toEqual([]);
    expect(r.taken).toEqual([]);
    expect(r.sets).toBe(1);
    expect(r.at).toEqual(['gone', 'counter', 'gone', 'counter', 'counter', 'gone']);
  });

  it('takes what the tray lacks from the rack first', () => {
    const r = roundWith(kinds);
    r.at[2] = 'rack';
    r.rack = [2];
    take(r, level, 5);
    expect(whisk(r, level)).toMatchObject({ set: [5, 2, 0], from: ['tray', 'rack', 'counter'] });
    expect(r.rack).toEqual([]);
  });

  it('whips up the pastry with the most left when the tray is empty, and clears the counter', () => {
    const flat = levelWith(row(9));
    const r = roundWith([0, 0, 0, 1, 1, 1, 1, 1, 1]);
    expect(whisk(r, flat)).toMatchObject({ kind: 1, set: [3, 4, 5], won: false });
    take(r, flat, 0);
    take(r, flat, 6);
    expect(whisk(r, flat)).toMatchObject({ kind: 0, set: [0, 1, 2], won: false });
    expect(whisk(r, flat)).toMatchObject({ kind: 1, set: [6, 7, 8], won: true });
    expect(whisk(r, flat)).toBeNull();
  });

  it('frees places on a full tray', () => {
    const flat = levelWith(row(21), { kinds: 7 });
    const r = roundWith(Array.from({ length: 21 }, (_, i) => i % 7));
    for (let tile = 0; tile < 7; tile++) take(r, flat, tile);
    expect(isStuck(r)).toBe(true);
    expect(whisk(r, flat)?.set).toEqual([0, 7, 14]);
    expect(r.tray).toHaveLength(6);
    expect(isStuck(r)).toBe(false);
  });
});

describe('the rolling pin', () => {
  it('rolls the pastries on the counter into new places, keeping every one, so that the tray’s sets can be finished first', () => {
    const level = levelAt(12);
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = startRound(level, seed);
      for (const tile of dealOf(level, seed).order.slice(0, 5)) take(r, level, tile);
      const left = pastriesLeft(r);
      const tray = r.tray.map((t) => [t, r.kinds[t]]);
      const kinds = [...r.kinds];
      const deal = rollingPin(r, level);
      if (!deal) throw new Error('the rolling pin did nothing');
      expect(pastriesLeft(r)).toEqual(left);
      expect(r.tray.map((t) => [t, r.kinds[t]])).toEqual(tray);
      expect(r.kinds).not.toEqual(kinds);
      expect(r.rolls).toBe(1);
      // The new way through clears the counter without the tray ever holding more than four.
      for (const tile of deal.order) expect(take(r, level, tile), `seed ${String(seed)}`).not.toBeNull();
      expect(isWon(r)).toBe(true);
      expect(r.peak).toBeLessThanOrEqual(4);
    }
  });

  it('rolls a new way each time', () => {
    const level = levelAt(12);
    const a = startRound(level, 1);
    const b = copyRound(a);
    rollingPin(a, level);
    rollingPin(b, level);
    expect(b.kinds).toEqual(a.kinds);
    rollingPin(b, level);
    expect(b.kinds).not.toEqual(a.kinds);
  });

  it('does nothing on a full tray', () => {
    const level = levelWith(row(21), { kinds: 7 });
    const r = roundWith(Array.from({ length: 21 }, (_, i) => i % 7));
    for (let tile = 0; tile < 7; tile++) take(r, level, tile);
    expect(rollingPin(r, level)).toBeNull();
    expect(r.rolls).toBe(0);
  });
});

describe('a deal', () => {
  it('hands out each pastry in whole sets, the level’s kinds and no more', () => {
    for (const n of [1, 12, 30, 60, 96]) {
      const level = levelAt(n);
      const r = startRound(level, 3);
      const counts = Object.values(pastriesLeft(r));
      expect(counts.every((count) => count % 3 === 0), `level ${String(n)}`).toBe(true);
      expect(counts).toHaveLength(Math.min(level.kinds, level.slots.length / 3));
      expect(r.at.every((p) => p === 'counter')).toBe(true);
    }
  });

  it('is the same for the same seed, and new for another', () => {
    const level = levelAt(20);
    expect(startRound(level, 7)).toEqual(startRound(level, 7));
    expect(startRound(level, 8).kinds).not.toEqual(startRound(level, 7).kinds);
    expect(dealOf(level, 7)).toEqual(dealOf(level, 7));
  });

  it('cannot be made for a counter that is not whole sets', () => {
    expect(() => dealOf(levelWith(row(10)), 1)).toThrow(/10 tiles/);
  });
});
