/**
 * Reading a save back: every value is checked, and anything missing, of the wrong type or out
 * of range becomes the fallback, so a damaged or hand-edited save can never break a game.
 */
export type Data = Record<string, unknown>;

export const isRecord = (v: unknown): v is Data => typeof v === 'object' && v !== null && !Array.isArray(v);

export function num(v: unknown, fallback: number, min = 0, max = Number.MAX_VALUE): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : fallback;
}

export function int(v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.floor(num(v, fallback, min, max));
}

export function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** A day key as `localDayKey` makes them (YYYY-MM-DD), or null. */
export function dayKeyOf(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** An object with one entry per key, for state that has a value for every id in a list. */
export function recordOf<K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((k) => [k, value(k)])) as Record<K, V>;
}
