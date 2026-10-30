import type { Mode } from '../src/sim/content.js';
import * as J from '../src/sim/jars.js';
import * as R from '../src/sim/rules.js';
import { createState, type GameState, type ShelfResult } from '../src/sim/state.js';

export const T0 = Date.UTC(2026, 9, 29, 3, 0, 0);
export const DAY = '2026-10-29';

/** A new game whose shelf in `mode` holds these jars, as if they had been dealt. */
export function stateWith(jars: J.Jar[], capacity = 4, mode: Mode = 'level'): GameState {
  const s = createState(T0);
  const shelf = R.openShelf(s, mode, DAY);
  if (!shelf) throw new Error('no shelf');
  shelf.capacity = capacity;
  shelf.start = jars.map((jar) => [...jar]);
  shelf.jars = jars.map((jar) => [...jar]);
  return s;
}

/** Solves the shelf in `mode` with the solver's pours, made one by one through the rules. */
export function solveShelf(s: GameState, mode: Mode = 'level'): ShelfResult | null {
  const shelf = s.shelves[mode];
  if (!shelf) return null;
  const solution = J.solve(R.puzzleOf(shelf), 200_000) ?? J.solve(R.puzzleOf(shelf), 200_000, true);
  if (!solution) throw new Error('no solution');
  let result: ShelfResult | null = null;
  for (const [from, to] of solution.moves) {
    const poured = R.pour(s, mode, from, to);
    if (!poured) throw new Error(`pour ${String(from)} → ${String(to)} refused`);
    result = poured.result;
  }
  return result;
}

/** Plays the given pours and fails loudly on one that is refused. */
export function pours(s: GameState, mode: Mode, moves: readonly (readonly [number, number])[]): R.Poured | null {
  let last: R.Poured | null = null;
  for (const [from, to] of moves) {
    last = R.pour(s, mode, from, to);
    if (!last) throw new Error(`pour ${String(from)} → ${String(to)} refused`);
  }
  return last;
}
