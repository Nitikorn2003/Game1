import { Rng, hashString } from '@game1/engine';
import { CONSTELLATIONS, type ConstellationId } from './content.js';

/** Stars in the whole atlas: one for each of the first levels. */
export const TOTAL_STARS = CONSTELLATIONS.reduce((n, c) => n + c.stars, 0);

/** The first star of each constellation, counted from 0 across the atlas. */
export const FIRST_STARS: readonly number[] = CONSTELLATIONS.map((_, i) => CONSTELLATIONS.slice(0, i).reduce((n, c) => n + c.stars, 0));

/** Where a star falls: the constellation (by its place in the atlas) and which of its stars. */
export interface StarPlace {
  index: number;
  star: number;
}

/** The place of a star counted from 0 across the atlas, or null past its last star. */
export function locate(star: number): StarPlace | null {
  if (!Number.isInteger(star) || star < 0) return null;
  let first = 0;
  for (let index = 0; index < CONSTELLATIONS.length; index++) {
    const stars = CONSTELLATIONS[index]?.stars ?? 0;
    if (star < first + stars) return { index, star: star - first };
    first += stars;
  }
  return null;
}

/** Stars lit after this many levels: one each, until the atlas is full. */
export function starsLit(levelsSolved: number): number {
  return Math.max(0, Math.min(TOTAL_STARS, levelsSolved));
}

/** How far the atlas is: the constellation being lit and how many of its stars are, or null once all are. */
export function current(levelsSolved: number): StarPlace | null {
  return locate(starsLit(levelsSolved));
}

/** How a constellation is drawn, in a square from 0 to 1. */
export interface Figure {
  /** Its stars in the order they light. */
  points: (readonly [number, number])[];
  /** One line for each star after the first, to a star lit before it: lines[k - 1] joins star k. */
  lines: (readonly [number, number])[];
}

const figures = new Map<ConstellationId, Figure>();

/**
 * The figure of a constellation, the same for everyone: stars spread from a seed made of its
 * id, joined by the shortest lines that link them all. Each star lights next to one already lit.
 */
export function figureOf(id: ConstellationId): Figure {
  const known = figures.get(id);
  if (known) return known;
  const stars = CONSTELLATIONS.find((c) => c.id === id)?.stars ?? 1;
  const rng = new Rng(hashString(`skyjars:figure:${id}`));
  const spread: [number, number][] = [];
  // Stars keep apart; if no spot is left at a distance, the distance shrinks a little.
  let gap = 0.75 / Math.sqrt(stars);
  while (spread.length < stars) {
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const x = 0.1 + rng.next() * 0.8;
      const y = 0.1 + rng.next() * 0.8;
      if (spread.every(([px, py]) => Math.hypot(px - x, py - y) >= gap)) {
        spread.push([x, y]);
        placed = true;
      }
    }
    if (!placed) gap *= 0.9;
  }
  // Prim's tree from the first star, in the order stars join it.
  const order = [0];
  const parentOf = new Map<number, number>();
  while (order.length < stars) {
    let best: [number, number, number] | null = null;
    for (const a of order) {
      for (let b = 0; b < stars; b++) {
        if (order.includes(b)) continue;
        const [ax, ay] = spread[a] ?? [0, 0];
        const [bx, by] = spread[b] ?? [0, 0];
        const d = Math.hypot(ax - bx, ay - by);
        if (!best || d < best[2]) best = [a, b, d];
      }
    }
    if (!best) break;
    order.push(best[1]);
    parentOf.set(best[1], best[0]);
  }
  const place = new Map(order.map((star, i) => [star, i]));
  const figure: Figure = {
    points: order.map((star) => spread[star] ?? [0.5, 0.5]),
    lines: order.slice(1).map((star) => [place.get(parentOf.get(star) ?? 0) ?? 0, place.get(star) ?? 0] as const),
  };
  figures.set(id, figure);
  return figure;
}
