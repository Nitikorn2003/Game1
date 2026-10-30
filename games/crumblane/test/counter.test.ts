import { Rng } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import { BRIGHT, PASTRIES, coverOf, covers, extentOf, layerOf, pastriesFor, shuffled, stackOf, type Slot } from '../src/sim/counter.js';

describe('the counter', () => {
  it('lets a tile cover every lower tile it overlaps, even by half a tile', () => {
    const low: Slot = { x: 2, y: 2, z: 0 };
    expect(covers({ x: 2, y: 2, z: 10 }, low)).toBe(true);
    expect(covers({ x: 3, y: 1, z: 10 }, low)).toBe(true);
    expect(covers({ x: 1, y: 3, z: 1 }, low)).toBe(true);
    // Side by side, or no higher, it covers nothing.
    expect(covers({ x: 4, y: 2, z: 10 }, low)).toBe(false);
    expect(covers({ x: 2, y: 0, z: 10 }, low)).toBe(false);
    expect(covers({ x: 2, y: 2, z: 0 }, low)).toBe(false);
    expect(covers(low, { x: 2, y: 2, z: 10 })).toBe(false);
  });

  it('works out once which tiles cover each tile of a layout', () => {
    const slots: Slot[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 1, y: 0, z: 10 },
      { x: 1, y: 0, z: 11 },
    ];
    const cover = coverOf(slots);
    expect(cover).toEqual([[2, 3], [2, 3], [3], []]);
    expect(coverOf(slots)).toBe(cover);
    expect(extentOf(slots)).toEqual({ w: 4, h: 2, layers: 2 });
  });

  it('tells the layer of a height from its place in a stack', () => {
    expect(layerOf(0)).toBe(0);
    expect(layerOf(23)).toBe(2);
    expect(stackOf(23)).toBe(3);
    expect(stackOf(10)).toBe(0);
  });
});

describe('the pastries', () => {
  it('are sixteen, each once', () => {
    expect(PASTRIES).toHaveLength(16);
    expect(new Set(PASTRIES).size).toBe(16);
  });

  it('come from the bright ones first, each once, in a new order each deal', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const kinds of [3, 5, 8, 11, 14]) {
        const picked = pastriesFor(kinds, new Rng(seed));
        expect(picked).toHaveLength(kinds);
        expect(new Set(picked).size).toBe(kinds);
        expect(picked.filter((p) => p < BRIGHT)).toHaveLength(Math.min(kinds, BRIGHT));
      }
    }
    expect(pastriesFor(5, new Rng(1))).toEqual(pastriesFor(5, new Rng(1)));
    expect(pastriesFor(5, new Rng(1))).not.toEqual(pastriesFor(5, new Rng(2)));
  });

  it('are shuffled without losing any', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(items, new Rng(9));
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(out).not.toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
