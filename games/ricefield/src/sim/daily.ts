import { hashString, Rng } from '@game1/engine';
import { cluesOf, givensFor } from './nonogram.js';
import type { Ink } from './palette.js';
import type { Picture } from './pictures.js';

/**
 * The daily field: a new pattern every day, the same for everyone. It is folded like a paper
 * cut, the same in all four quarters, and planted in rings of colour around its middle.
 */
export const DAILY_SIZE = 10;

/** The colours of the rings, from the middle out; each day takes one set. */
const RINGS: readonly (readonly [Ink, Ink, Ink])[] = [
  ['y', 'o', 'r'],
  ['w', 'i', 'p'],
  ['w', 'c', 'b'],
  ['y', 'l', 'g'],
  ['y', 't', 'n'],
  ['i', 'p', 'k'],
  ['y', 'r', 'p'],
  ['c', 'b', 'p'],
];

/** Patterns tried for a day before taking the best: the one that shows the fewest cells from the start. */
const TRIES = 12;
/** Rows and columns with more than one run that a good pattern has. */
const MIN_GAPPED = 8;

/** A pattern folded into four: a random quarter, mirrored both ways, with its specks smoothed into shapes. */
function pattern(rng: Rng): boolean[] {
  const n = DAILY_SIZE;
  const half = n / 2;
  const quarter = Array.from({ length: half * half }, () => rng.chance(0.56));
  const raw = Array.from({ length: n * n }, (_, i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    return quarter[Math.min(r, n - 1 - r) * half + Math.min(c, n - 1 - c)] === true;
  });
  // A cell is planted where most of the cells around it are: lone specks go, small gaps close.
  return raw.map((_, i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    let near = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && raw[rr * n + cc]) near += 1;
      }
    }
    return near >= 5;
  });
}

/** The rows of a pattern in its day's colours: rings around the middle, round or square. */
function colour(filled: readonly boolean[], rings: readonly [Ink, Ink, Ink], square: boolean): string[] {
  const n = DAILY_SIZE;
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      if (!filled[r * n + c]) return '.';
      const dr = Math.abs(r - mid);
      const dc = Math.abs(c - mid);
      // From 0 in the middle to 1 at the edge.
      const out = square ? (Math.max(dr, dc) - 0.5) / (mid - 0.5) : (dr + dc - 1) / (2 * mid - 1);
      return rings[Math.min(2, Math.floor(out * 3))] ?? 'g';
    }).join(''),
  );
}

const made = new Map<string, Picture>();

/** The daily field of `day` (YYYY-MM-DD). */
export function dailyPicture(day: string): Picture {
  const known = made.get(day);
  if (known) return known;
  const rng = new Rng(hashString(`ricefield:daily:${day}`));
  const rings = rng.pick(RINGS);
  const square = rng.chance(0.5);
  let best: { filled: boolean[]; score: number } | null = null;
  for (let k = 0; k < TRIES && best?.score !== 0; k++) {
    const filled = pattern(rng);
    const shape = { width: DAILY_SIZE, height: DAILY_SIZE, filled };
    const share = filled.filter(Boolean).length / filled.length;
    const clues = cluesOf(shape);
    // Rows and columns with gaps in them, which make the pattern more than one round shape to work out.
    const gapped = [...clues.rows, ...clues.cols].filter((clue) => clue.length > 1).length;
    // A pattern too bare to be a picture, or so full that it is one block, is taken only if nothing else is.
    const score = (share < 0.36 || share > 0.72 ? 100 : 0) + 10 * givensFor(shape).length + (gapped < MIN_GAPPED ? 1 : 0);
    if (best === null || score < best.score) best = { filled, score };
  }
  const picture: Picture = { id: `daily:${day}`, rows: colour(best?.filled ?? [], rings, square) };
  made.set(day, picture);
  return picture;
}
