/**
 * The counter: where the pastries sit, in layers. A tile's place is in half tiles from the
 * top left, so a tile can sit half over the ones under it, and its height is ten a layer plus
 * its place in a stack. A tile covers every lower tile it overlaps, and only a tile that
 * nothing covers can be taken.
 */
import { Rng } from '@game1/engine';

/** The pastries, eight of different colours first, so that a counter of few kinds reads at a glance. */
export const PASTRIES = [
  'donut',
  'macaron',
  'croissant',
  'muffin',
  'strawberry',
  'cupcake',
  'tart',
  'eclair',
  'loaf',
  'cake',
  'pie',
  'cookie',
  'waffle',
  'pretzel',
  'roll',
  'gingerbread',
] as const;
export type Pastry = (typeof PASTRIES)[number];
/** How many pastries of different colours lead the list. */
export const BRIGHT = 8;

/** Where a tile sits: `x` and `y` in half tiles from the top left, `z` its height. */
export interface Slot {
  x: number;
  y: number;
  z: number;
}

/** The counter is at most this many half tiles across and down. */
export const COUNTER_W = 14;
export const COUNTER_H = 18;

/** Heights a layer apart; the tiles of a stack sit one apart within a layer. */
export const LAYER = 10;
export const layerOf = (z: number): number => Math.floor(z / LAYER);
export const stackOf = (z: number): number => z % LAYER;

/** A tile covers another when it is higher and they overlap. */
export function covers(a: Slot, b: Slot): boolean {
  return a.z > b.z && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
}

const coverCache = new WeakMap<readonly Slot[], readonly (readonly number[])[]>();

/** For each slot of a layout, the slots that cover it. Layouts never change, so this is worked out once. */
export function coverOf(slots: readonly Slot[]): readonly (readonly number[])[] {
  const known = coverCache.get(slots);
  if (known) return known;
  const cover = slots.map((b) => slots.flatMap((a, i) => (covers(a, b) ? [i] : [])));
  coverCache.set(slots, cover);
  return cover;
}

/** How far a layout reaches, in half tiles: its right and bottom edges. */
export function extentOf(slots: readonly Slot[]): { w: number; h: number; layers: number } {
  let w = 0;
  let h = 0;
  let layers = 0;
  for (const s of slots) {
    w = Math.max(w, s.x + 2);
    h = Math.max(h, s.y + 2);
    layers = Math.max(layers, layerOf(s.z) + 1);
  }
  return { w, h, layers };
}

/**
 * The pastries of a round with `kinds` kinds: as many as can be of the eight bright ones, the
 * rest from the others, in a random order.
 */
export function pastriesFor(kinds: number, rng: Rng): number[] {
  const all = PASTRIES.map((_, i) => i);
  const bright = shuffled(all.slice(0, BRIGHT), rng);
  const rest = shuffled(all.slice(BRIGHT), rng);
  const picked = kinds <= BRIGHT ? bright.slice(0, kinds) : [...bright, ...rest.slice(0, kinds - BRIGHT)];
  return shuffled(picked, rng);
}

/** The items in a random order. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}
