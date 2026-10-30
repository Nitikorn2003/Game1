import { describe, expect, it } from 'vitest';
import { bulkCost, costAt, maxAffordable } from '../src/economy.js';

describe('economy', () => {
  it('prices purchases geometrically', () => {
    expect(costAt(10, 1.5, 0)).toBe(10);
    expect(costAt(10, 1.5, 2)).toBeCloseTo(22.5);
    expect(bulkCost(10, 1.5, 0, 3)).toBeCloseTo(10 + 15 + 22.5);
    expect(bulkCost(10, 1.5, 2, 0)).toBe(0);
    expect(bulkCost(4, 1, 5, 3)).toBe(12);
  });

  it('finds the largest affordable count exactly', () => {
    for (const [base, growth, owned] of [
      [10, 1.07, 0],
      [10, 1.07, 37],
      [5, 1.15, 12],
      [3, 1, 4],
    ] as const) {
      for (const budget of [0, 9, 10, 55, 1234, 9.9e9]) {
        const n = maxAffordable(base, growth, owned, budget);
        if (n > 0) expect(bulkCost(base, growth, owned, n)).toBeLessThanOrEqual(budget);
        expect(bulkCost(base, growth, owned, n + 1)).toBeGreaterThan(budget);
      }
    }
  });

  it('respects a limit and ignores bad budgets', () => {
    expect(maxAffordable(1, 1.01, 0, 1e9, 25)).toBe(25);
    expect(maxAffordable(1, 1.01, 0, Infinity)).toBe(0);
    expect(maxAffordable(1, 1.01, 0, Number.NaN)).toBe(0);
  });
});
