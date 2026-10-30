import { complete, pebbleDoneLines, type Puzzle } from '../src/sim/fields.js';
import { hintFor, truthOf, UNKNOWN, type CellState } from '../src/sim/nonogram.js';
import * as R from '../src/sim/rules.js';
import type { FieldResult, GameState } from '../src/sim/state.js';

export const T0 = Date.UTC(2026, 9, 29, 3, 0, 0);
export const DAY = '2026-10-29';

/** The day after `day`, or `n` days after it. */
export function dayAfter(day: string, n = 1): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The cells a field still has to plant, top left first. */
export function toPlant(s: GameState, key: R.FieldKey): number[] {
  const field = R.fieldOf(s, key);
  if (!field) return [];
  const { shape } = R.puzzleOfField(field);
  return field.board.flatMap((state, cell) => (state === UNKNOWN && shape.filled[cell] ? [cell] : []));
}

/** Grows a field the way a player who never goes wrong would: planting only its picture, through the rules. */
export function growField(s: GameState, key: R.FieldKey): FieldResult {
  for (const cell of toPlant(s, key)) {
    const acted = R.act(s, key, cell, 'plant');
    if (!acted || acted.mistake) throw new Error(`planting cell ${String(cell)} went wrong`);
    if (acted.result) return acted.result;
  }
  throw new Error('the field did not grow');
}

/** Opens an album picture and grows it. */
export function growPicture(s: GameState, id: Parameters<typeof R.openAlbumField>[1]): FieldResult {
  if (!R.openAlbumField(s, id)) throw new Error(`${id} cannot be played`);
  return growField(s, id);
}

/** Works a board out the way the hints do, hint after hint, checking each one against the picture. */
export function solveByHints(puzzle: Puzzle, start: readonly CellState[]): { board: CellState[]; hints: number; wrong: number } {
  const board = start.slice();
  let hints = 0;
  let wrong = 0;
  while (!complete(puzzle, board) && hints < board.length) {
    const hint = hintFor(puzzle.clues, puzzle.shape, board);
    if (!hint) break;
    hints += 1;
    for (const { cell, state } of hint.cells) {
      if (state !== truthOf(puzzle.shape, cell)) wrong += 1;
      board[cell] = state;
    }
    pebbleDoneLines(
      puzzle,
      board,
      hint.cells.map(({ cell }) => cell),
    );
  }
  return { board, hints, wrong };
}
