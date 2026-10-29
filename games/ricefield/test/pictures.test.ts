import { describe, expect, it } from 'vitest';
import { DAILY_SIZE, dailyPicture } from '../src/sim/daily.js';
import { ALBUM_IDS, cellCount, complete, PICTURES, picturesOf, puzzleOf, startBoard } from '../src/sim/fields.js';
import { lineSolve, UNKNOWN } from '../src/sim/nonogram.js';
import { ALBUMS, shapeOf, wellDrawn } from '../src/sim/pictures.js';
import { dayAfter, solveByHints } from './helpers.js';

describe('the albums', () => {
  it('has six albums of twelve pictures, each picture with an id of its own', () => {
    expect(ALBUMS.map((album) => album.pictures.length)).toEqual([12, 12, 12, 12, 12, 12]);
    expect(new Set(PICTURES.map((picture) => picture.id)).size).toBe(72);
    expect(ALBUM_IDS).toEqual(['first', 'water', 'farm', 'village', 'harvest', 'sky']);
    expect(picturesOf('farm')).toHaveLength(12);
  });

  it.each(PICTURES.map((picture) => [picture.id, picture] as const))('draws %s in the inks, at most twelve cells a side', (_, picture) => {
    expect(wellDrawn(picture)).toBe(true);
    const shape = shapeOf(picture);
    expect(Math.max(shape.width, shape.height)).toBeLessThanOrEqual(12);
    expect(Math.min(shape.width, shape.height)).toBeGreaterThanOrEqual(5);
    // A picture, not a block: some cells planted, some left plain, in every picture.
    const planted = shape.filled.filter(Boolean).length;
    expect(planted).toBeGreaterThan(cellCount(puzzleOf(picture)) * 0.25);
    expect(planted).toBeLessThan(cellCount(puzzleOf(picture)) * 0.9);
  });

  it.each(PICTURES.map((picture) => [picture.id, picture] as const))('lets %s be worked out by logic alone, from the cells it shows', (_, picture) => {
    const puzzle = puzzleOf(picture);
    const solved = lineSolve(puzzle.clues, puzzle.shape, startBoard(puzzle));
    expect(solved.contradiction).toBe(false);
    expect(solved.board.filter((state) => state === UNKNOWN)).toEqual([]);
    expect(complete(puzzle, solved.board)).toBe(true);
    // The hints find the same way, one right line at a time.
    const hinted = solveByHints(puzzle, startBoard(puzzle));
    expect(hinted.wrong).toBe(0);
    expect(complete(puzzle, hinted.board)).toBe(true);
  });

  it('shows hardly any cells at the start', () => {
    const givens = PICTURES.map((picture) => puzzleOf(picture).givens.length);
    expect(Math.max(...givens)).toBeLessThanOrEqual(2);
    expect(givens.filter((n) => n === 0).length).toBeGreaterThanOrEqual(54);
  });

  it('gets bigger album by album, with small pictures to start', () => {
    const average = ALBUMS.map((album) => album.pictures.reduce((sum, picture) => sum + cellCount(puzzleOf(picture)), 0) / album.pictures.length);
    expect(average.toSorted((a, b) => a - b)).toEqual(average);
    expect(cellCount(puzzleOf(ALBUMS[0].pictures[0]))).toBe(25);
  });
});

describe('the daily field', () => {
  it('is the same for everyone on a day, and new the next day', () => {
    expect(dailyPicture('2026-10-29')).toEqual(dailyPicture('2026-10-29'));
    expect(dailyPicture('2026-10-29').rows).not.toEqual(dailyPicture('2026-10-30').rows);
    expect(dailyPicture('2026-10-29').id).toBe('daily:2026-10-29');
  });

  it('is folded the same in all four quarters', () => {
    for (let d = 0; d < 20; d++) {
      const { rows } = dailyPicture(dayAfter('2026-10-29', d));
      expect(rows).toHaveLength(DAILY_SIZE);
      expect(rows.toReversed()).toEqual(rows);
      expect(rows.map((row) => row.split('').toReversed().join(''))).toEqual(rows);
    }
  });

  it('can be worked out by logic every day of a year, and is a pattern rather than a block', () => {
    const shown: number[] = [];
    for (let d = 0; d < 366; d++) {
      const puzzle = puzzleOf(dailyPicture(dayAfter('2026-10-29', d)));
      expect(wellDrawn(puzzle.picture)).toBe(true);
      const solved = lineSolve(puzzle.clues, puzzle.shape, startBoard(puzzle));
      expect(complete(puzzle, solved.board)).toBe(true);
      shown.push(puzzle.givens.length);
      const share = puzzle.shape.filled.filter(Boolean).length / cellCount(puzzle);
      expect(share).toBeGreaterThanOrEqual(0.36);
      expect(share).toBeLessThanOrEqual(0.72);
      // Not one round shape: rows and columns with gaps to work out.
      expect([...puzzle.clues.rows, ...puzzle.clues.cols].filter((clue) => clue.length > 1).length).toBeGreaterThanOrEqual(4);
    }
    expect(shown.filter((n) => n > 0).length).toBeLessThanOrEqual(3);
  });
});
