import { BOMB, COL, NONE, PEARL, ROW, TURTLE, movesOf, type Board, type Piece, type Special } from '../src/sim/board.js';
import * as R from '../src/sim/rules.js';
import type { DiveResult, GameState } from '../src/sim/state.js';

export const T0 = Date.UTC(2026, 9, 29, 3, 0, 0);
export const DAY = '2026-10-29';

/** The day after `day`, or `n` days after it. */
export function dayAfter(day: string, n = 1): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A board drawn as text for a test, cells separated by spaces:
 *   a b c d e f   a piece of each colour, coral to urchin
 *   a- a|  a*     a coral wave along its row, down its column, a coral bomb
 *   P  T          a pearl, a baby turtle
 *   .  #  x       an empty cell, a rock, a gap
 *   ~a            coral held by kelp
 */
export function boardOf(rows: readonly string[]): Board {
  const cells = rows.map((row) => row.trim().split(/\s+/));
  const height = cells.length;
  const width = cells[0]?.length ?? 0;
  const b: Board = {
    width,
    height,
    open: [],
    pieces: [],
    sand: new Array<number>(width * height).fill(0),
    rock: new Array<number>(width * height).fill(0),
    kelp: new Array<number>(width * height).fill(0),
    nextId: 1,
  };
  const open: boolean[] = [];
  cells.forEach((row, y) => {
    if (row.length !== width) throw new Error(`row ${String(y)} has ${String(row.length)} cells, not ${String(width)}`);
    row.forEach((token, x) => {
      const cell = y * width + x;
      open.push(token !== 'x');
      let t = token;
      if (t.startsWith('~')) {
        b.kelp[cell] = 1;
        t = t.slice(1);
      }
      if (t === 'x' || t === '.') {
        b.pieces.push(null);
        return;
      }
      if (t === '#') {
        b.rock[cell] = 1;
        b.pieces.push(null);
        return;
      }
      b.pieces.push(pieceOf(b, t));
    });
  });
  return { ...b, open };
}

function pieceOf(b: Board, token: string): Piece {
  const kind = token === 'P' ? PEARL : token === 'T' ? TURTLE : 'abcdef'.indexOf(token[0] ?? '');
  if (kind < 0) throw new Error(`unknown piece ${token}`);
  const mark = token[1];
  const special: Special = mark === '-' ? ROW : mark === '|' ? COL : mark === '*' ? BOMB : NONE;
  const piece = { id: b.nextId, kind, special };
  b.nextId += 1;
  return piece;
}

/** The board as text again, in the same notation, without kelp. */
export function textOf(b: Board): string[] {
  const rows: string[] = [];
  for (let y = 0; y < b.height; y++) {
    const row: string[] = [];
    for (let x = 0; x < b.width; x++) {
      const cell = y * b.width + x;
      if (!b.open[cell]) row.push('x');
      else if ((b.rock[cell] ?? 0) > 0) row.push('#');
      else row.push(tokenOf(b.pieces[cell] ?? null));
    }
    rows.push(row.join(' '));
  }
  return rows;
}

function tokenOf(piece: Piece | null): string {
  if (!piece) return '.';
  if (piece.kind === PEARL) return 'P';
  if (piece.kind === TURTLE) return 'T';
  const letter = 'abcdef'[piece.kind] ?? '?';
  return letter + (piece.special === ROW ? '-' : piece.special === COL ? '|' : piece.special === BOMB ? '*' : '');
}

/** A source of new pieces for `settle` that hands out the given colours in turn. */
export function spawner(kinds: readonly number[]): (b: Board) => Piece {
  let i = 0;
  return (b) => {
    const kind = kinds[i % kinds.length] ?? 0;
    i += 1;
    const piece: Piece = { id: b.nextId, kind, special: NONE };
    b.nextId += 1;
    return piece;
  };
}

export const never = (): number => 0;

/** Plays the dive in progress to its goals the way the bot does, given all the moves it needs: three stars. */
export function playToWin(s: GameState, moves = 150): DiveResult {
  const c = s.current;
  if (!c) throw new Error('no dive in progress');
  c.dive.movesLeft = moves;
  for (let i = 0; i < moves; i++) {
    const move = R.hintMove(s);
    if (!move) throw new Error('no move to make');
    const moved = R.swap(s, move.from, move.to);
    if (!moved) throw new Error('the swap did nothing');
    if (moved.result) return moved.result;
  }
  throw new Error('the bot did not reach the goals');
}

/** Makes swaps that do not reach the goals until the dive in progress is out of moves. */
export function runOut(s: GameState): void {
  const c = s.current;
  if (!c) throw new Error('no dive in progress');
  c.dive.movesLeft = 1;
  const move = movesOf(c.dive.board)[0];
  if (!move || !R.swap(s, move.from, move.to)) throw new Error('no swap to make');
  if (!R.isStuck(s)) throw new Error('the dive is not out of moves');
}

/** A save in which every level before `n` was reached, with `stars` stars each. */
export function reachedTo(s: GameState, n: number, stars = 3): GameState {
  s.stars = new Array<number>(n - 1).fill(stars);
  return s;
}
