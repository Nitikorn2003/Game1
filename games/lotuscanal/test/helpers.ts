import { botChoice } from '../src/sim/bot.js';
import { RANKS, type Card } from '../src/sim/cards.js';
import type { Mode } from '../src/sim/content.js';
import type { LayoutId } from '../src/sim/layouts.js';
import * as R from '../src/sim/rules.js';
import { createState, type DealResult, type GameState } from '../src/sim/state.js';
import type { Dealt } from '../src/sim/table.js';

export const T0 = Date.UTC(2026, 9, 29, 3, 0, 0);
export const DAY = '2026-10-29';

/** Cards of these ranks (0 the ace), each rank's suits in turn, so that no card comes twice. */
export function cardsOf(ranks: readonly number[], used: Map<number, number> = new Map()): Card[] {
  return ranks.map((rank) => {
    const suit = used.get(rank) ?? 0;
    if (suit > 3) throw new Error(`A deck has four cards of rank ${String(rank)}.`);
    used.set(rank, suit + 1);
    return suit * RANKS + rank;
  });
}

/** A deal of `layout` with cards of these ranks on its spots, in its stock and in its reserve. */
export function dealtOf(layout: LayoutId, spots: readonly number[], stock: readonly number[], reserve: readonly number[] = []): Dealt {
  const used = new Map<number, number>();
  return { layout, cards: cardsOf(spots, used), stock: cardsOf(stock, used), reserve: cardsOf(reserve, used) };
}

/** A new game whose deal in `mode` is `dealt`, as if it had been dealt so. */
export function stateWith(dealt: Dealt, mode: Mode = 'level'): GameState {
  const s = createState(T0);
  const deal = R.openDeal(s, mode, DAY);
  if (!deal) throw new Error('no deal');
  deal.dealt = dealt;
  return s;
}

/** Clears the deal in `mode` the way the careful player would, move by move through the rules. */
export function clearDeal(s: GameState, mode: Mode = 'level', today = DAY): DealResult {
  for (let moves = 0; moves < 200; moves++) {
    const deal = s.deals[mode];
    if (!deal) throw new Error('no deal');
    const spot = botChoice(R.tableOf(deal));
    if (spot === null) {
      if (R.draw(s, mode) === null) throw new Error('stuck');
      continue;
    }
    const played = R.play(s, mode, spot, today);
    if (!played) throw new Error(`play on spot ${String(spot)} refused`);
    if (played.result) return played.result;
  }
  throw new Error('the deal went on too long');
}

/** Draws the stock empty and plays nothing, until the deal is stuck. */
export function drawOut(s: GameState, mode: Mode = 'level'): void {
  while (R.draw(s, mode) !== null) {
    // Every card drawn goes onto the pile.
  }
}
