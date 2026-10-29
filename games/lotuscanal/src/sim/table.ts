import { fits, WILD, type Card } from './cards.js';
import { LAYOUTS, type Layout, type LayoutId } from './layouts.js';

/** A deal as it was dealt. Everything that happens to it is a list of moves. */
export interface Dealt {
  layout: LayoutId;
  /** The card at each spot of the layout. */
  cards: Card[];
  /** The stock in the order it is drawn. Its first card starts the pile. */
  stock: Card[];
  /** Cards kept back for More cards, in the order they come. */
  reserve: Card[];
}

export type Move = { kind: 'play'; spot: number } | { kind: 'draw' } | { kind: 'wild' } | { kind: 'extra' };

/** Every fifth card in a row pays this many coins more. */
export const STREAK_EVERY = 5;
export const STREAK_BONUS = 5;
/** More cards adds this many to an empty stock. */
export const EXTRA_CARDS = 5;

/** A deal as it stands after its moves. */
export interface Table {
  dealt: Dealt;
  layout: Layout;
  cleared: boolean[];
  /** Cards still to draw, the next first. */
  stock: Card[];
  /** The pile, its top card last. */
  pile: Card[];
  /** Reserve cards already added to the stock. */
  reserveUsed: number;
  /** Cards played in a row since the last draw. */
  streak: number;
  bestStreak: number;
  /** Coins the deal has earned so far: one a card, and a bonus every fifth card in a row. */
  pot: number;
  /** Layout cards played. */
  played: number;
}

export function startTable(dealt: Dealt): Table {
  const [first = 0, ...rest] = dealt.stock;
  return {
    dealt,
    layout: LAYOUTS[dealt.layout],
    cleared: dealt.cards.map(() => false),
    stock: rest,
    pile: [first],
    reserveUsed: 0,
    streak: 0,
    bestStreak: 0,
    pot: 0,
    played: 0,
  };
}

export function topCard(t: Table): Card {
  return t.pile[t.pile.length - 1] ?? WILD;
}

/** Not played yet, and no card lies on it: it is face up. */
export function isFree(t: Table, spot: number): boolean {
  return t.cleared[spot] === false && (t.layout.coveredBy[spot] ?? []).every((on) => t.cleared[on] === true);
}

export function canPlay(t: Table, spot: number): boolean {
  const card = t.dealt.cards[spot];
  return card !== undefined && isFree(t, spot) && fits(card, topCard(t));
}

export function playable(t: Table): number[] {
  return t.dealt.cards.flatMap((_, spot) => (canPlay(t, spot) ? [spot] : []));
}

export function canExtra(t: Table): boolean {
  return t.stock.length === 0 && t.reserveUsed < t.dealt.reserve.length;
}

export function won(t: Table): boolean {
  return t.played === t.dealt.cards.length;
}

/** Nothing to play and nothing to draw. */
export function stuck(t: Table): boolean {
  return !won(t) && t.stock.length === 0 && playable(t).length === 0;
}

/** The spots that playing `spot` would turn face up. */
export function revealedBy(t: Table, spot: number): number[] {
  return (t.layout.covers[spot] ?? []).filter((under) => t.cleared[under] === false && (t.layout.coveredBy[under] ?? []).every((on) => on === spot || t.cleared[on] === true));
}

/** Makes a move if it is allowed; false, and nothing changes, if it is not. */
export function apply(t: Table, move: Move): boolean {
  switch (move.kind) {
    case 'play': {
      if (!canPlay(t, move.spot)) return false;
      t.cleared[move.spot] = true;
      t.pile.push(t.dealt.cards[move.spot] ?? 0);
      t.played += 1;
      t.streak += 1;
      t.bestStreak = Math.max(t.bestStreak, t.streak);
      t.pot += 1 + (t.streak % STREAK_EVERY === 0 ? STREAK_BONUS : 0);
      return true;
    }
    case 'draw': {
      const next = t.stock.shift();
      if (next === undefined) return false;
      t.pile.push(next);
      t.streak = 0;
      return true;
    }
    case 'wild':
      // A wild on a wild would do nothing more.
      if (won(t) || topCard(t) === WILD) return false;
      t.pile.push(WILD);
      return true;
    case 'extra': {
      if (!canExtra(t)) return false;
      const added = t.dealt.reserve.slice(t.reserveUsed, t.reserveUsed + EXTRA_CARDS);
      t.stock.push(...added);
      t.reserveUsed += added.length;
      return true;
    }
  }
}

/** The deal after its moves, and how many of them could be made; the rest are dropped. */
export function replay(dealt: Dealt, moves: readonly Move[]): { table: Table; made: number } {
  const table = startTable(dealt);
  let made = 0;
  for (const move of moves) {
    if (won(table) || !apply(table, move)) break;
    made += 1;
  }
  return { table, made };
}
