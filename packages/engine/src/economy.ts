/** Price of the next purchase when each one costs `growth` times the one before. */
export function costAt(base: number, growth: number, owned: number): number {
  return base * growth ** owned;
}

/** Total price of buying `count` more, starting with `owned` already bought. */
export function bulkCost(base: number, growth: number, owned: number, count: number): number {
  if (count <= 0) return 0;
  if (growth === 1) return base * count;
  return (base * growth ** owned * (growth ** count - 1)) / (growth - 1);
}

/** How many more can be bought with `budget` (0 when not even one is affordable). */
export function maxAffordable(base: number, growth: number, owned: number, budget: number, limit = Infinity): number {
  if (!Number.isFinite(budget) || budget < costAt(base, growth, owned) || limit <= 0) return 0;
  let n =
    growth === 1
      ? Math.floor(budget / base)
      : Math.floor(Math.log((budget * (growth - 1)) / (base * growth ** owned) + 1) / Math.log(growth));
  n = Math.min(Math.max(n, 0), limit);
  // The logarithm can be one off either way at the edges; settle it with the exact sum.
  while (n > 0 && bulkCost(base, growth, owned, n) > budget) n -= 1;
  while (n < limit && bulkCost(base, growth, owned, n + 1) <= budget) n += 1;
  return n;
}
