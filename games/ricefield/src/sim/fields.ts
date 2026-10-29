/** The pictures of the albums and the daily field, made ready to play. */
import { dailyPicture } from './daily.js';
import { cluesOf, EMPTY, FILLED, givensFor, lineCells, truthOf, UNKNOWN, type CellState, type Clues, type LineRef, type Shape } from './nonogram.js';
import { ALBUMS, shapeOf, type AlbumId, type Picture } from './pictures.js';

export type PictureId = (typeof ALBUMS)[number]['pictures'][number]['id'];

export const ALBUM_IDS: readonly AlbumId[] = ALBUMS.map((album) => album.id);

/** Every album picture, album after album. */
export const PICTURES: readonly (Picture & { id: PictureId; album: AlbumId })[] = ALBUMS.flatMap((album) =>
  album.pictures.map((picture) => ({ ...picture, album: album.id })),
);

const byId = new Map(PICTURES.map((picture) => [picture.id as string, picture]));

export function isPictureId(v: unknown): v is PictureId {
  return typeof v === 'string' && byId.has(v);
}

export function pictureOf(id: PictureId): Picture & { album: AlbumId } {
  const picture = byId.get(id);
  if (!picture) throw new Error(`no picture ${id}`);
  return picture;
}

export function albumOf(id: PictureId): AlbumId {
  return pictureOf(id).album;
}

export function picturesOf(album: AlbumId): readonly PictureId[] {
  return PICTURES.filter((picture) => picture.album === album).map((picture) => picture.id);
}

/** A picture made ready to play: its shape, its clues, and the cells shown from the start. */
export interface Puzzle {
  picture: Picture;
  shape: Shape;
  clues: Clues;
  /** The cells line logic cannot work out alone; most pictures have none. */
  givens: readonly number[];
}

const puzzles = new Map<string, Puzzle>();

export function puzzleOf(picture: Picture): Puzzle {
  const known = puzzles.get(picture.id);
  if (known) return known;
  const shape = shapeOf(picture);
  const puzzle: Puzzle = { picture, shape, clues: cluesOf(shape), givens: givensFor(shape) };
  puzzles.set(picture.id, puzzle);
  return puzzle;
}

/** The puzzle of an album picture, or of the daily field of a day. */
export function puzzleFor(mode: 'album' | 'daily', id: string): Puzzle {
  return puzzleOf(mode === 'album' && isPictureId(id) ? pictureOf(id) : dailyPicture(id));
}

export function cellCount(puzzle: Puzzle): number {
  return puzzle.shape.width * puzzle.shape.height;
}

/** The cells of the picture: the ones to plant. */
export function plantedCount(puzzle: Puzzle): number {
  return puzzle.shape.filled.filter(Boolean).length;
}

/** Whether every cell of the line that belongs to the picture is planted. */
export function lineDone(puzzle: Puzzle, board: readonly CellState[], line: LineRef): boolean {
  return lineCells(puzzle.shape, line).every((cell) => !puzzle.shape.filled[cell] || board[cell] === FILLED);
}

/** Whether the picture is all planted: the field has grown. */
export function complete(puzzle: Puzzle, board: readonly CellState[]): boolean {
  return puzzle.shape.filled.every((filled, cell) => !filled || board[cell] === FILLED);
}

/**
 * Puts pebbles on the unknown cells of the lines through `cells` whose picture cells are all
 * planted. Returns the cells it pebbled, and the lines among those that are done.
 */
export function pebbleDoneLines(puzzle: Puzzle, board: CellState[], cells: readonly number[]): { pebbled: number[]; lines: LineRef[] } {
  const { width } = puzzle.shape;
  const rows = new Set(cells.map((cell) => Math.floor(cell / width)));
  const cols = new Set(cells.map((cell) => cell % width));
  const lines: LineRef[] = [
    ...[...rows].sort((a, b) => a - b).map((index): LineRef => ({ axis: 'row', index })),
    ...[...cols].sort((a, b) => a - b).map((index): LineRef => ({ axis: 'col', index })),
  ].filter((line) => lineDone(puzzle, board, line));
  const pebbled: number[] = [];
  for (const line of lines) {
    for (const cell of lineCells(puzzle.shape, line)) {
      if (board[cell] !== UNKNOWN) continue;
      board[cell] = EMPTY;
      pebbled.push(cell);
    }
  }
  return { pebbled, lines };
}

/** Every cell of the grid, for checking all lines at once. */
function allCells(puzzle: Puzzle): number[] {
  return Array.from({ length: cellCount(puzzle) }, (_, cell) => cell);
}

/**
 * A field as it starts: the givens shown, and pebbles along every line that has nothing left
 * to plant, such as a line whose clue is 0.
 */
export function startBoard(puzzle: Puzzle): CellState[] {
  const board = new Array<CellState>(cellCount(puzzle)).fill(UNKNOWN);
  for (const cell of puzzle.givens) board[cell] = truthOf(puzzle.shape, cell);
  pebbleDoneLines(puzzle, board, allCells(puzzle));
  return board;
}

/**
 * A board read back from a save: the cells it knows that are right, on top of the start of
 * the field, so a damaged board can only lose cells, never show a wrong one.
 */
export function restoreBoard(puzzle: Puzzle, saved: readonly unknown[]): CellState[] {
  const board = startBoard(puzzle);
  board.forEach((state, cell) => {
    if (state === UNKNOWN && saved[cell] === truthOf(puzzle.shape, cell)) board[cell] = truthOf(puzzle.shape, cell);
  });
  pebbleDoneLines(puzzle, board, allCells(puzzle));
  return board;
}
