import { hashString } from '@game1/engine';
import { botPlay } from './bot.js';
import { DECK_SIZE } from './cards.js';
import { makeDeal, RESERVE, type DealSpec, type Made } from './deal.js';
import { LAYOUTS, type LayoutId } from './layouts.js';

/**
 * The levels, one after another along the canals. Every deal is made so that it can be
 * cleared, and then kept only if a careful player who sees just the face-up cards clears it
 * too (sim/bot.ts), so no deal needs luck or help. Later levels leave fewer spare cards in
 * the stock and need longer runs, so a careless play costs more.
 */

/** The first ten levels bring in a new shape each, with plenty of spare cards. */
const OPENING: readonly (readonly [LayoutId, number])[] = [
  ['peaks2', 5],
  ['pyramid', 5],
  ['boat', 5],
  ['bridge', 4],
  ['peaks3', 4],
  ['waves', 4],
  ['stacks', 4],
  ['market', 4],
  ['valley', 4],
  ['lotus', 4],
];

/** After the opening the shapes come round in this order, easy and hard mixed. */
const CYCLE: readonly LayoutId[] = ['peaks3', 'boat', 'lotus', 'bridge', 'summit', 'waves', 'valley', 'market', 'peaks2', 'stacks', 'peaks4', 'pyramid'];

/** The daily deal is one of the medium shapes. */
const DAILY: readonly LayoutId[] = ['peaks3', 'lotus', 'bridge', 'market', 'boat', 'waves', 'valley'];

/** Every seventh level is a breather, with more spare cards. */
export function isBreather(level: number): boolean {
  return level > OPENING.length && level % 7 === 0;
}

/** A deal of a shape with runs of `averageRun` cards, keeping enough of the deck back for two More cards. */
function specOf(layout: LayoutId, averageRun: number, spare: number): DealSpec {
  const cards = LAYOUTS[layout].spots.length;
  const runs = Math.max(1, Math.min(Math.round(cards / averageRun), DECK_SIZE - RESERVE - cards - spare));
  return { layout, runs, spare };
}

export function levelSpec(level: number): DealSpec {
  const opening = OPENING[level - 1];
  if (opening) return specOf(opening[0], 2.2, opening[1]);
  const layout = CYCLE[(level - OPENING.length - 1) % CYCLE.length] ?? 'peaks3';
  if (isBreather(level)) return specOf(layout, 2.2, 4);
  if (level <= 30) return specOf(layout, 2.4, 3);
  if (level <= 80) return specOf(layout, 2.8, 2);
  return specOf(layout, 3, 1);
}

export function dailySpec(day: string): DealSpec {
  return specOf(DAILY[hashString(`daily-shape:${day}`) % DAILY.length] ?? 'peaks3', 2.6, 3);
}

/** Deals until the careful player clears one; the same seed always gives the same deal. */
function fairDeal(spec: DealSpec, seed: string): Made {
  let made = makeDeal(spec, hashString(seed));
  for (let k = 1; k < 64 && !botPlay(made.dealt).won; k++) made = makeDeal(spec, hashString(`${seed}:${String(k)}`));
  return made;
}

/** Level `level`; a level played again after a lost deal is dealt anew, `attempt` counting from 0. */
export function makeLevel(level: number, attempt: number): Made {
  return fairDeal(levelSpec(level), `level:${String(level)}:${String(attempt)}`);
}

/** The daily deal of `day`, the same for everyone. */
export function makeDaily(day: string, attempt: number): Made {
  return fairDeal(dailySpec(day), `daily:${day}:${String(attempt)}`);
}
