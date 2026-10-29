/**
 * The market deck: 52 cards in four suits of the canal (lotus, mango, fish and leaf), each
 * from ace to king. Only ranks matter to the rules; suits are drawn, never played on.
 */

/** A card of the deck, 0 to 51: its rank is `card % 13` (0 the ace, 12 the king), its suit `card / 13`. */
export type Card = number;

export const DECK_SIZE = 52;
export const RANKS = 13;
/** The lotus wild, which a player can put on the pile: any card goes onto it. */
export const WILD: Card = 52;

export const SUITS = ['lotus', 'mango', 'fish', 'leaf'] as const;
export type Suit = (typeof SUITS)[number];

export const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export function rankOf(card: Card): number {
  return card % RANKS;
}

export function suitOf(card: Card): Suit {
  return SUITS[Math.floor(card / RANKS)] ?? 'lotus';
}

export function isCard(v: unknown): v is Card {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < DECK_SIZE;
}

/** A card of the deck or the lotus wild, as the pile can hold them. */
export function isPileCard(v: unknown): v is Card {
  return isCard(v) || v === WILD;
}

/** Ranks next to each other, the king and the ace too. */
export function adjacent(a: number, b: number): boolean {
  const d = Math.abs(a - b);
  return d === 1 || d === RANKS - 1;
}

/** Whether `card` may go onto `top`: one rank higher or lower, or anything onto the lotus wild. */
export function fits(card: Card, top: Card): boolean {
  return top === WILD || adjacent(rankOf(card), rankOf(top));
}

export function label(card: Card): string {
  return card === WILD ? '*' : (RANK_LABELS[rankOf(card)] ?? '?');
}
