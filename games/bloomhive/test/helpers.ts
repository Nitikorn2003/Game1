import { CELLS, ROWS, cellAt, widthOf, type Board, type Bud } from '../src/sim/hive.js';
import * as R from '../src/sim/rules.js';
import type { GameState, RoundResult } from '../src/sim/state.js';

export const T0 = Date.UTC(2026, 9, 29, 3, 0, 0);
export const DAY = '2026-10-29';

/** The day after `day`, or `n` days after it. */
export function dayAfter(day: string, n = 1): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A board drawn as text for a test, from the branch down, cells separated by spaces: eleven in
 * an even row, ten in an odd one, which sits half a bud to the right.
 *   a b c d e f   a bud of each colour, rose to marigold
 *   a+ a~ a^      a rose bud with a bee in it, with honey on it, with a butterfly on it
 *   W  *  .       wax, a dandelion puff, an empty cell
 */
export function boardOf(rows: readonly string[]): Board {
  const b: Board = { cells: new Array<Bud | null>(CELLS).fill(null), nextId: 1 };
  if (rows.length > ROWS) throw new Error(`a board has ${String(ROWS)} rows`);
  rows.forEach((text, row) => {
    const tokens = text.trim().split(/\s+/);
    if (tokens.length !== widthOf(row)) throw new Error(`row ${String(row)} has ${String(tokens.length)} cells, not ${String(widthOf(row))}`);
    tokens.forEach((token, col) => {
      b.cells[cellAt(row, col)] = budOf(b, token);
    });
  });
  return b;
}

function budOf(b: Board, token: string): Bud | null {
  if (token === '.') return null;
  const base = token[0] ?? '';
  const mark = token.slice(1);
  const kind = base === 'W' ? 'wax' : base === '*' ? 'puff' : 'bud';
  const colour = kind === 'bud' ? 'abcdef'.indexOf(base) : -1;
  if (kind === 'bud' && colour < 0) throw new Error(`unknown bud ${token}`);
  const bud: Bud = { id: b.nextId, kind, colour, bee: mark.includes('+'), honey: mark.includes('~'), butterfly: mark.includes('^') };
  b.nextId += 1;
  return bud;
}

/** The board as text again, in the same notation, down to its last row with a bud. */
export function textOf(b: Board): string[] {
  const rows: string[] = [];
  for (let row = 0; row < ROWS; row++) {
    const tokens: string[] = [];
    for (let col = 0; col < widthOf(row); col++) tokens.push(tokenOf(b.cells[cellAt(row, col)] ?? null));
    rows.push(tokens.join(' '));
  }
  while (rows.length > 0 && /^[.\s]*$/.test(rows.at(-1) ?? '')) rows.pop();
  return rows;
}

function tokenOf(bud: Bud | null): string {
  if (!bud) return '.';
  if (bud.kind === 'wax') return 'W';
  if (bud.kind === 'puff') return '*';
  return ('abcdef'[bud.colour] ?? '?') + (bud.bee ? '+' : '') + (bud.honey ? '~' : '') + (bud.butterfly ? '^' : '');
}

/** The aim, in degrees, from Pip to the centre of a cell: a straight shot at it. */
export { aimAt } from '../src/sim/hive.js';

/** Plays the round in progress to its goals the way the bot does, given all the pollen it needs: three stars. */
export function playToWin(s: GameState, shots = 200): RoundResult {
  const c = s.current;
  if (!c) throw new Error('no round in progress');
  c.round.shotsLeft = shots;
  for (let i = 0; i < shots * 2; i++) {
    const aim = R.hintAim(s);
    if (!aim) throw new Error('no shot to take');
    if (aim.swap) R.swapPollen(s);
    const shot = R.shoot(s, aim.angle);
    if (!shot) throw new Error('the shot did nothing');
    if (shot.result) return shot.result;
  }
  throw new Error('the bot did not reach the goals');
}

/** Leaves the round in progress out of pollen, its goals not reached. */
export function runOut(s: GameState): void {
  const c = s.current;
  if (!c) throw new Error('no round in progress');
  c.round.shotsLeft = 0;
  c.round.bomb = false;
  if (!R.isStuck(s)) throw new Error('the round is not out of pollen');
}

/** A save in which every level before `n` was reached, with `stars` stars each. */
export function reachedTo(s: GameState, n: number, stars = 3): GameState {
  s.stars = new Array<number>(n - 1).fill(stars);
  return s;
}
