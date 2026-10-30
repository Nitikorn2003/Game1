/**
 * Picture logic (nonograms): a picture hidden in a grid, and for every row and column the
 * lengths of its runs of filled cells, in order. These are the rules, and the line by line
 * logic of a careful player, which proves that a field can be worked out without guessing.
 */

/** What the player knows of a cell: nothing yet, planted (part of the picture) or pebbled (empty). */
export const UNKNOWN = 0;
export const FILLED = 1;
export const EMPTY = 2;
export type CellState = typeof UNKNOWN | typeof FILLED | typeof EMPTY;

/** Which cells of a grid are filled, row by row from the top left. */
export interface Shape {
  width: number;
  height: number;
  filled: readonly boolean[];
}

export interface Size {
  width: number;
  height: number;
}

export type Axis = 'row' | 'col';

export interface LineRef {
  axis: Axis;
  index: number;
}

/** The runs of every row, top to bottom, and of every column, left to right. */
export interface Clues {
  rows: number[][];
  cols: number[][];
}

/** The cells of a line, as indexes into the grid, left to right or top to bottom. */
export function lineCells(size: Size, line: LineRef): number[] {
  if (line.axis === 'row') return Array.from({ length: size.width }, (_, c) => line.index * size.width + c);
  return Array.from({ length: size.height }, (_, r) => r * size.width + line.index);
}

/** Every row, then every column. */
export function linesOf(size: Size): LineRef[] {
  return [
    ...Array.from({ length: size.height }, (_, index): LineRef => ({ axis: 'row', index })),
    ...Array.from({ length: size.width }, (_, index): LineRef => ({ axis: 'col', index })),
  ];
}

/** The lengths of the runs of filled cells along a line, in order; an empty line has none. */
export function runsOf(filled: readonly boolean[]): number[] {
  const runs: number[] = [];
  let run = 0;
  for (const cell of filled) {
    if (cell) run += 1;
    else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
}

export function cluesOf(shape: Shape): Clues {
  const of = (line: LineRef) => runsOf(lineCells(shape, line).map((i) => shape.filled[i] === true));
  return {
    rows: Array.from({ length: shape.height }, (_, index) => of({ axis: 'row', index })),
    cols: Array.from({ length: shape.width }, (_, index) => of({ axis: 'col', index })),
  };
}

export function clueOf(clues: Clues, line: LineRef): number[] {
  return (line.axis === 'row' ? clues.rows[line.index] : clues.cols[line.index]) ?? [];
}

/**
 * What one line's clue and its known cells force. For each cell: FILLED or EMPTY when every
 * way of placing the runs agrees on it, UNKNOWN when they differ. Null when no way fits.
 *
 * Works on the line with an empty cell added at each end, so that every run has an empty cell
 * on both sides. `head[j][i]`: the first i cells can hold the first j runs, with cell i - 1
 * empty. `tail[j][i]`: the cells from i on can hold runs j onwards, with cell i empty.
 */
export function settleLine(clue: readonly number[], line: readonly CellState[]): CellState[] | null {
  const n = line.length;
  const k = clue.length;
  const len = n + 2;
  const at = (i: number): CellState => (i === 0 || i === len - 1 ? EMPTY : (line[i - 1] ?? UNKNOWN));
  // Empty cells before i, to tell in one step whether a run fits over a stretch.
  const emptiesBefore = new Int32Array(len + 1);
  for (let i = 0; i < len; i++) emptiesBefore[i + 1] = (emptiesBefore[i] ?? 0) + (at(i) === EMPTY ? 1 : 0);
  const fits = (from: number, run: number) => from >= 1 && from + run <= len - 1 && emptiesBefore[from + run] === emptiesBefore[from];
  const run = (j: number) => clue[j] ?? 0;
  const w = len + 1;

  const head = new Uint8Array((k + 1) * w);
  head[1] = 1;
  for (let i = 2; i <= len; i++) {
    if (at(i - 1) === FILLED) continue;
    for (let j = 0; j <= k; j++) {
      if (head[j * w + i - 1]) head[j * w + i] = 1;
      else if (j >= 1) {
        const from = i - 1 - run(j - 1);
        if (fits(from, run(j - 1)) && head[(j - 1) * w + from]) head[j * w + i] = 1;
      }
    }
  }
  if (!head[k * w + len]) return null;

  const tail = new Uint8Array((k + 1) * w);
  tail[k * w + len - 1] = 1;
  for (let i = len - 2; i >= 0; i--) {
    if (at(i) === FILLED) continue;
    for (let j = k; j >= 0; j--) {
      if (tail[j * w + i + 1]) tail[j * w + i] = 1;
      else if (j < k && fits(i + 1, run(j)) && tail[(j + 1) * w + i + 1 + run(j)]) tail[j * w + i] = 1;
    }
  }

  // Cells some way of placing the runs fills, marked as stretches on a difference array.
  const fillable = new Int32Array(len + 1);
  for (let j = 0; j < k; j++) {
    for (let from = 1; from + run(j) <= len - 1; from++) {
      if (head[j * w + from] && fits(from, run(j)) && tail[(j + 1) * w + from + run(j)]) {
        fillable[from] = (fillable[from] ?? 0) + 1;
        fillable[from + run(j)] = (fillable[from + run(j)] ?? 0) - 1;
      }
    }
  }

  const out: CellState[] = new Array<CellState>(n);
  let fillCount = 0;
  for (let i = 1; i <= n; i++) {
    fillCount += fillable[i] ?? 0;
    const known = at(i);
    if (known !== UNKNOWN) {
      out[i - 1] = known;
      continue;
    }
    let canEmpty = false;
    for (let j = 0; j <= k && !canEmpty; j++) canEmpty = head[j * w + i + 1] === 1 && tail[j * w + i] === 1;
    const canFill = fillCount > 0;
    if (!canEmpty && !canFill) return null;
    out[i - 1] = canFill && canEmpty ? UNKNOWN : canFill ? FILLED : EMPTY;
  }
  return out;
}

export interface Solved {
  board: CellState[];
  /** The clues and the known cells cannot all be true. */
  contradiction: boolean;
}

/**
 * Works a board out line by line, as far as the logic of single lines goes, from the cells
 * already known. Each line is looked at again whenever a crossing line changes one of its cells.
 */
export function lineSolve(clues: Clues, size: Size, start: readonly CellState[]): Solved {
  const board = start.slice();
  const lines = linesOf(size);
  const queued = lines.map(() => true);
  const queue = lines.map((_, i) => i);
  while (queue.length > 0) {
    const at = queue.shift() ?? 0;
    queued[at] = false;
    const line = lines[at];
    if (!line) continue;
    const cells = lineCells(size, line);
    const settled = settleLine(clueOf(clues, line), cells.map((i) => board[i] ?? UNKNOWN));
    if (!settled) return { board, contradiction: true };
    settled.forEach((state, pos) => {
      const i = cells[pos] ?? 0;
      if (board[i] !== state) {
        board[i] = state;
        // The crossing line: a column for a row's cell, a row for a column's.
        const cross = line.axis === 'row' ? size.height + (i % size.width) : Math.floor(i / size.width);
        if (!queued[cross]) {
          queued[cross] = true;
          queue.push(cross);
        }
      }
    });
  }
  return { board, contradiction: false };
}

export function unknownCount(board: readonly CellState[]): number {
  return board.filter((cell) => cell === UNKNOWN).length;
}

/** The state a cell has in the finished picture. */
export function truthOf(shape: Shape, cell: number): CellState {
  return shape.filled[cell] ? FILLED : EMPTY;
}

/**
 * The cells to show from the start, so that line logic alone finishes the picture: none for
 * most pictures. While the logic is stuck, it takes the cell that lets it work out the most.
 */
export function givensFor(shape: Shape): number[] {
  const clues = cluesOf(shape);
  const size = { width: shape.width, height: shape.height };
  let board = lineSolve(clues, size, new Array<CellState>(shape.width * shape.height).fill(UNKNOWN)).board;
  const givens: number[] = [];
  while (unknownCount(board) > 0) {
    let best = -1;
    let bestLeft = Infinity;
    let bestBoard = board;
    board.forEach((state, cell) => {
      if (state !== UNKNOWN) return;
      const trial = board.slice();
      trial[cell] = truthOf(shape, cell);
      const after = lineSolve(clues, size, trial).board;
      const left = unknownCount(after);
      if (left < bestLeft) {
        best = cell;
        bestLeft = left;
        bestBoard = after;
      }
    });
    givens.push(best);
    board = bestBoard;
  }
  return givens.sort((a, b) => a - b);
}

/** The cells a hint fills in: every cell the clues now force along one line. */
export interface Hint {
  line: LineRef;
  cells: { cell: number; state: CellState }[];
}

/**
 * A hint for the board as it stands: the line where its clue forces the most new cells. A board
 * reached by correct moves on a field that line logic solves always has one, until it is done.
 */
export function hintFor(clues: Clues, size: Size, board: readonly CellState[]): Hint | null {
  let best: Hint | null = null;
  for (const line of linesOf(size)) {
    const cells = lineCells(size, line);
    const settled = settleLine(clueOf(clues, line), cells.map((i) => board[i] ?? UNKNOWN));
    if (!settled) continue;
    const found = cells.flatMap((cell, pos) => {
      const state = settled[pos] ?? UNKNOWN;
      return board[cell] === UNKNOWN && state !== UNKNOWN ? [{ cell, state }] : [];
    });
    if (found.length > (best?.cells.length ?? 0)) best = { line, cells: found };
  }
  return best;
}
