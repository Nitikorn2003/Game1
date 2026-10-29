/**
 * Small seeded random number generator (mulberry32). Its whole state is one 32-bit integer,
 * so games can store it in the save file: reloading a save replays the same drops instead of
 * letting players re-roll an egg by restarting the app.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  get state(): number {
    return this.s;
  }

  /** A float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('cannot pick from an empty list');
    return items[this.int(items.length)] as T;
  }

  /** Picks a value with probability proportional to its weight. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, weight] of entries) {
      if (!(weight >= 0)) throw new Error('weights must be non-negative');
      total += weight;
    }
    if (total <= 0) throw new Error('weights must not all be zero');
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll < 0) return value;
    }
    // Floating point leftovers land on the last entry with a weight.
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry && entry[1] > 0) return entry[0];
    }
    throw new Error('unreachable');
  }
}

/** A 32-bit hash of a string (FNV-1a), for seeds derived from ids or dates. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
