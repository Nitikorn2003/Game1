import type { Shape } from './shapes.js';

/** The quilt is 8 squares wide and 8 high. */
export const SIZE = 8;
export const EMPTY = -1;

/** The squares row by row from the top left: EMPTY, or the fabric (0 to 3) sewn there. */
export type Board = number[];

export function emptyBoard(): Board {
  return Array.from({ length: SIZE * SIZE }, () => EMPTY);
}

export function indexOf(x: number, y: number): number {
  return y * SIZE + x;
}

/** Whether a shape can be sewn with its top left corner on square (x, y). */
export function fits(board: Board, shape: Shape, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x + shape.width > SIZE || y + shape.height > SIZE) return false;
  return shape.cells.every(([cx, cy]) => board[indexOf(x + cx, y + cy)] === EMPTY);
}

/** Every top left corner the shape fits at. */
export function placements(board: Board, shape: Shape): [number, number][] {
  const found: [number, number][] = [];
  for (let y = 0; y + shape.height <= SIZE; y++) {
    for (let x = 0; x + shape.width <= SIZE; x++) if (fits(board, shape, x, y)) found.push([x, y]);
  }
  return found;
}

export function fitsAnywhere(board: Board, shape: Shape): boolean {
  for (let y = 0; y + shape.height <= SIZE; y++) {
    for (let x = 0; x + shape.width <= SIZE; x++) if (fits(board, shape, x, y)) return true;
  }
  return false;
}

/**
 * The top left corner for a patch aimed at square (x, y), such as a tapped one: the patch's
 * square nearest its middle goes there. Near the edges the nearest square that keeps the patch
 * on the quilt goes there instead, so the patch covers (x, y) whenever it can.
 */
export function aimAt(shape: Shape, x: number, y: number): [number, number] {
  const mx = (shape.width - 1) / 2;
  const my = (shape.height - 1) / 2;
  const off = ([cx, cy]: readonly [number, number]) => Math.hypot(cx - mx, cy - my);
  const corners = [...shape.cells].sort((a, b) => off(a) - off(b)).map(([cx, cy]): [number, number] => [x - cx, y - cy]);
  const onQuilt = ([left, top]: [number, number]) => left >= 0 && top >= 0 && left + shape.width <= SIZE && top + shape.height <= SIZE;
  const found = corners.find(onQuilt);
  if (found) return found;
  // No square of the patch can go on (x, y), so it goes as near as the quilt allows.
  const [left, top] = corners[0] ?? [x, y];
  return [Math.max(0, Math.min(SIZE - shape.width, left)), Math.max(0, Math.min(SIZE - shape.height, top))];
}

/** Sews the shape in one fabric and returns its squares. Check `fits` first. */
export function sew(board: Board, shape: Shape, x: number, y: number, fabric: number): number[] {
  const squares = shape.cells.map(([cx, cy]) => indexOf(x + cx, y + cy));
  for (const i of squares) board[i] = fabric;
  return squares;
}

/** A full row or column: a seam. Perfect when every square is the same fabric. */
export interface Seam {
  kind: 'row' | 'column';
  index: number;
  /** The fabric of a perfect seam, otherwise null. */
  fabric: number | null;
}

export function seamSquares(seam: Seam): number[] {
  return Array.from({ length: SIZE }, (_, i) => (seam.kind === 'row' ? indexOf(i, seam.index) : indexOf(seam.index, i)));
}

function seamOf(board: Board, kind: Seam['kind'], index: number): Seam | null {
  const fabrics = seamSquares({ kind, index, fabric: null }).map((i) => board[i] ?? EMPTY);
  if (fabrics.includes(EMPTY)) return null;
  const first = fabrics[0] ?? EMPTY;
  return { kind, index, fabric: fabrics.every((f) => f === first) ? first : null };
}

/** Every full row, then every full column. */
export function fullSeams(board: Board): Seam[] {
  const seams: Seam[] = [];
  for (const kind of ['row', 'column'] as const) {
    for (let index = 0; index < SIZE; index++) {
      const seam = seamOf(board, kind, index);
      if (seam) seams.push(seam);
    }
  }
  return seams;
}

/** A square taken out of the quilt, and the fabric that was there. */
export interface Unpicked {
  at: number;
  fabric: number;
}

/**
 * Takes the seams' sewn squares out of the quilt; a square in both a full row and a full
 * column goes once.
 */
export function unpickSeams(board: Board, seams: readonly Seam[]): Unpicked[] {
  const squares = [...new Set(seams.flatMap(seamSquares))].filter((i) => board[i] !== EMPTY);
  const unpicked = squares.map((at) => ({ at, fabric: board[at] ?? EMPTY }));
  for (const i of squares) board[i] = EMPTY;
  return unpicked;
}

export function filledCount(board: Board): number {
  return board.filter((square) => square !== EMPTY).length;
}

/** How full each row and each column is, fullest first; rows before columns, then top or left first. */
export function fullestLines(board: Board): Seam[] {
  const lines: { seam: Seam; filled: number }[] = [];
  for (const kind of ['row', 'column'] as const) {
    for (let index = 0; index < SIZE; index++) {
      const seam: Seam = { kind, index, fabric: null };
      lines.push({ seam, filled: seamSquares(seam).filter((i) => board[i] !== EMPTY).length });
    }
  }
  // Array.prototype.sort is stable, so ties keep the order above.
  return lines.sort((a, b) => b.filled - a.filled).map((line) => line.seam);
}
