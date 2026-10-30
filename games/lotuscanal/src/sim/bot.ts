import { fits, rankOf, type Card } from './cards.js';
import { apply, isFree, playable, revealedBy, startTable, won, type Dealt, type Move, type Table } from './table.js';

/**
 * A careful player for balancing, who sees only what a player sees: the face-up cards, the
 * top of the pile and how many cards the stock has left. Of the cards it can play, it takes
 * the one that starts the longest run it can see, and after that one that turns more cards
 * face up. It never uses Undo, a wild or More cards.
 */

/** The most cards in a row that can be played from `top` using only `cards`. */
function longestRun(top: Card, cards: readonly Card[], memo: Map<string, number>): number {
  const key = `${String(rankOf(top))}:${cards.map(rankOf).sort((a, b) => a - b).join(',')}`;
  const known = memo.get(key);
  if (known !== undefined) return known;
  let best = 0;
  cards.forEach((card, i) => {
    if (!fits(card, top)) return;
    best = Math.max(best, 1 + longestRun(card, [...cards.slice(0, i), ...cards.slice(i + 1)], memo));
  });
  memo.set(key, best);
  return best;
}

/** The play the bot makes, or null when it would draw. */
export function botChoice(t: Table): number | null {
  const options = playable(t);
  if (options.length === 0) return null;
  const visible = t.dealt.cards.flatMap((card, spot) => (isFree(t, spot) ? [{ card, spot }] : []));
  const memo = new Map<string, number>();
  let best: { spot: number; score: number } | null = null;
  for (const spot of options) {
    const card = t.dealt.cards[spot] ?? 0;
    const rest = visible.filter((v) => v.spot !== spot).map((v) => v.card);
    const score = (1 + longestRun(card, rest, memo)) * 100 + revealedBy(t, spot).length * 10 + (t.layout.spots[spot]?.row ?? 0);
    if (!best || score > best.score) best = { spot, score };
  }
  return best?.spot ?? null;
}

export interface BotGame {
  won: boolean;
  /** Layout cards cleared. */
  played: number;
  /** Stock cards left at the end. */
  stockLeft: number;
  moves: Move[];
}

export function botPlay(dealt: Dealt): BotGame {
  const t = startTable(dealt);
  const moves: Move[] = [];
  while (!won(t)) {
    const spot = botChoice(t);
    const move: Move = spot === null ? { kind: 'draw' } : { kind: 'play', spot };
    if (!apply(t, move)) break;
    moves.push(move);
  }
  return { won: won(t), played: t.played, stockLeft: t.stock.length, moves };
}
