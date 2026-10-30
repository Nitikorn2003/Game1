import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../src/random.js';

describe('Rng', () => {
  it('repeats the same sequence from the same seed and state', () => {
    const a = new Rng(42);
    const first = [a.next(), a.next(), a.next()];
    const b = new Rng(42);
    expect([b.next(), b.next(), b.next()]).toEqual(first);
    const resumed = new Rng(a.state);
    expect(resumed.next()).toBe(a.next());
  });

  it('stays in range and is roughly uniform', () => {
    const rng = new Rng(7);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const bucket = Math.floor(x * 10);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) expect(Math.abs(count - 10_000)).toBeLessThan(500);
  });

  it('picks weighted entries in proportion and skips zero weights', () => {
    const rng = new Rng(1);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 60_000; i++) counts[rng.weighted([['a', 1], ['b', 2], ['c', 0]] as const)] += 1;
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(1.9);
    expect(counts.b / counts.a).toBeLessThan(2.1);
  });

  it('refuses impossible picks', () => {
    const rng = new Rng(1);
    expect(() => rng.pick([])).toThrow();
    expect(() => rng.weighted([['a', 0]])).toThrow();
    expect(() => rng.weighted([['a', -1]])).toThrow();
  });

  it('hashes strings stably', () => {
    expect(hashString('2026-10-29')).toBe(hashString('2026-10-29'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
