import { Rng } from '@game1/engine';
import * as B from '../src/sim/board.js';
import * as Q from '../src/sim/quilt.js';
import { SHAPES, SHAPE_IDS, type ShapeId } from '../src/sim/shapes.js';

export const T0 = Date.UTC(2026, 9, 29, 3, 0, 0);
export const DAY = '2026-10-29';

/** A board drawn as 8 rows of 8: `.` empty, `0` to `3` a fabric. */
export function board(rows: string): B.Board {
  const lines = rows.trim().split(/\s+/);
  if (lines.length !== B.SIZE || lines.some((line) => line.length !== B.SIZE)) throw new Error('a board is 8 rows of 8');
  return lines.flatMap((line) => Array.from({ length: B.SIZE }, (_, x) => (line[x] === '.' ? B.EMPTY : Number(line[x]))));
}

/** A quilt with this board and tray, for testing one move. */
export function quiltWith(rows: string, tray: (readonly [ShapeId, number] | null)[], mode: Q.Mode = 'endless'): Q.Quilt {
  const q = Q.newQuilt(mode, mode === 'daily' ? DAY : null, 1);
  q.board = board(rows);
  q.tray = tray.map((patch) => (patch ? { shape: patch[0], fabric: patch[1] } : null));
  return q;
}

export const EMPTY_ROWS = '........ '.repeat(8);

export interface Move {
  slot: number;
  x: number;
  y: number;
}

export function movesOf(q: Q.Quilt): Move[] {
  const out: Move[] = [];
  q.tray.forEach((patch, slot) => {
    if (patch) for (const [x, y] of B.placements(q.board, SHAPES[patch.shape])) out.push({ slot, x, y });
  });
  return out;
}

/** A careless player: any patch, anywhere it fits. */
export function randomBot(seed: number): (q: Q.Quilt) => Move | null {
  const rng = new Rng(seed);
  return (q) => {
    const moves = movesOf(q);
    return moves.length > 0 ? (moves[rng.int(moves.length)] ?? null) : null;
  };
}

/**
 * A player who thinks one patch ahead: the most points now, then the most room left for the
 * patches to come.
 */
export function greedyBot(q: Q.Quilt): Move | null {
  let best: Move | null = null;
  let bestValue = -Infinity;
  for (const move of movesOf(q)) {
    const copy = structuredClone(q);
    const stitch = Q.place(copy, move.slot, move.x, move.y);
    if (!stitch) continue;
    const room = SHAPE_IDS.filter((id) => B.fitsAnywhere(copy.board, SHAPES[id])).length;
    const value = stitch.points + (B.SIZE * B.SIZE - B.filledCount(copy.board)) * 0.6 + room * 0.5;
    if (value > bestValue) {
      bestValue = value;
      best = move;
    }
  }
  return best;
}

/** Sews a quilt until no patch fits, or `cap` patches. */
export function sewQuilt(q: Q.Quilt, bot: (q: Q.Quilt) => Move | null, cap = 2000): Q.Quilt {
  while (q.patches < cap) {
    const move = bot(q);
    if (!move || !Q.place(q, move.slot, move.x, move.y)) break;
  }
  return q;
}

export function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}
