import { Rng } from '@game1/engine';
import { DECK_SIZE, RANKS, rankOf, type Card } from './cards.js';
import { LAYOUTS, type LayoutId } from './layouts.js';
import type { Dealt, Move } from './table.js';

/** What a deal is made of. */
export interface DealSpec {
  layout: LayoutId;
  /**
   * Runs of plays on the way the deal is made to be cleared: the first starts from the card
   * the pile starts with, every other one from a drawn card.
   */
  runs: number;
  /** Stock cards beyond the ones that way needs. */
  spare: number;
}

/** Cards kept back for More cards: twice five. */
export const RESERVE = 10;

/** A made deal, with the way it was made to be cleared. */
export interface Made {
  dealt: Dealt;
  way: Move[];
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const a = items[i] as T;
    items[i] = items[j] as T;
    items[j] = a;
  }
  return items;
}

/** How many plays each run makes: at least one, the rest spread at random. */
function runLengths(cards: number, runs: number, rng: Rng): number[] {
  const lengths = Array.from({ length: runs }, () => 1);
  for (let i = runs; i < cards; i++) {
    const run = rng.int(runs);
    lengths[run] = (lengths[run] ?? 0) + 1;
  }
  return lengths;
}

/**
 * Deals by playing a way to clear it: run after run, each card played is given a rank one
 * above or below the card before it, on a spot that is face up at that moment. So every deal
 * can be cleared, with `spare` stock cards left over for a player who finds that way.
 */
function attempt(spec: DealSpec, rng: Rng): Made | null {
  const layout = LAYOUTS[spec.layout];
  const count = layout.spots.length;
  // The four cards of each rank, in a random order of suits.
  const byRank: Card[][] = Array.from({ length: RANKS }, (_, rank) => shuffle([0, 1, 2, 3].map((suit) => suit * RANKS + rank), rng));
  const left = (rank: number) => byRank[((rank % RANKS) + RANKS) % RANKS]?.length ?? 0;
  const take = (rank: number): Card => {
    const card = byRank[((rank % RANKS) + RANKS) % RANKS]?.pop();
    if (card === undefined) throw new Error('No card of that rank is left.');
    return card;
  };
  /** Any card, preferring one a run can follow. */
  const takeAny = (): Card => {
    const ranks = Array.from({ length: RANKS }, (_, r) => r).filter((r) => left(r) > 0);
    const followable = ranks.filter((r) => left(r + 1) + left(r - 1) > 0);
    return take(rng.pick(followable.length > 0 ? followable : ranks));
  };

  const cards: Card[] = layout.spots.map(() => -1);
  const waiting = layout.coveredBy.map((on) => on.length);
  const free = layout.spots.flatMap((_, spot) => (waiting[spot] === 0 ? [spot] : []));
  const stock: Card[] = [];
  const way: Move[] = [];
  const lengths = runLengths(count, spec.runs, rng);
  let placed = 0;
  let carry = 0;
  let top = takeAny();
  stock.push(top);
  for (let run = 0; run < spec.runs; run++) {
    if (run > 0) {
      top = takeAny();
      stock.push(top);
      way.push({ kind: 'draw' });
    }
    let want = (lengths[run] ?? 0) + carry;
    let dir = rng.chance(0.5) ? 1 : -1;
    while (want > 0 && placed < count) {
      if (rng.chance(0.3)) dir = -dir;
      if (left(rankOf(top) + dir) === 0) dir = -dir;
      if (left(rankOf(top) + dir) === 0 || free.length === 0) break;
      const spot = free.splice(rng.int(free.length), 1)[0] ?? 0;
      top = take(rankOf(top) + dir);
      cards[spot] = top;
      way.push({ kind: 'play', spot });
      placed += 1;
      want -= 1;
      for (const under of layout.covers[spot] ?? []) {
        waiting[under] = (waiting[under] ?? 0) - 1;
        if (waiting[under] === 0) free.push(under);
      }
    }
    carry = want;
  }
  if (placed < count) return null;
  for (let i = 0; i < spec.spare; i++) stock.push(takeAny());
  const reserve = shuffle(byRank.flat(), rng).slice(0, RESERVE);
  return { dealt: { layout: spec.layout, cards, stock, reserve }, way };
}

/** The deal of a seed: always the same one, and always one that can be cleared. */
export function makeDeal(spec: DealSpec, seed: number): Made {
  const layout = LAYOUTS[spec.layout];
  if (spec.runs < 1 || spec.runs > layout.spots.length || spec.spare < 0) throw new Error(`A deal of ${spec.layout} cannot have ${String(spec.runs)} runs and ${String(spec.spare)} spare cards.`);
  if (layout.spots.length + spec.runs + spec.spare > DECK_SIZE) throw new Error(`A deal of ${spec.layout} needs more cards than a deck has.`);
  const rng = new Rng(seed);
  for (let tries = 0; tries < 200; tries++) {
    const made = attempt(spec, rng);
    if (made) return made;
  }
  throw new Error(`No deal of ${spec.layout} could be made from seed ${String(seed)}.`);
}
