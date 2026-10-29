import { describe, expect, it } from 'vitest';
import * as B from '../src/sim/board.js';
import * as Q from '../src/sim/quilt.js';
import { SHAPES } from '../src/sim/shapes.js';
import { EMPTY_ROWS, board, quiltWith } from './helpers.js';

/** The top row sewn in mixed fabrics up to x = 5, and one square in the far corner. */
const SIX_MIXED = `
  012301..
  ........
  ........
  ........
  ........
  ........
  ........
  .......2`;

const fits = (q: Q.Quilt, b: B.Board) => q.tray.filter((patch) => patch !== null && B.fitsAnywhere(b, SHAPES[patch.shape])).length;

describe('a new quilt', () => {
  it('deals the same three patches from the same seed', () => {
    const a = Q.newQuilt('endless', null, 5);
    const b = Q.newQuilt('endless', null, 5);
    expect(a.tray).toHaveLength(Q.TRAY);
    expect(a.tray).toEqual(b.tray);
    expect(a.tray.every((patch) => patch !== null && patch.fabric >= 0 && patch.fabric < Q.FABRICS)).toBe(true);
    const trays = new Set(Array.from({ length: 10 }, (_, seed) => JSON.stringify(Q.newQuilt('endless', null, seed).tray)));
    expect(trays.size).toBeGreaterThan(5);
  });

  it('starts empty, with nothing to undo', () => {
    const q = Q.newQuilt('daily', '2026-10-29', 9);
    expect(B.filledCount(q.board)).toBe(0);
    expect(q.undo).toBeNull();
    expect(q.score).toBe(0);
    expect(q.day).toBe('2026-10-29');
  });
});

describe('sewing a patch', () => {
  it('refuses a patch that does not fit there, and changes nothing', () => {
    const q = quiltWith(SIX_MIXED, [['square', 0], null, null]);
    const before = structuredClone(q);
    expect(Q.place(q, 0, 4, 0)).toBeNull();
    expect(Q.place(q, 0, 7, 6)).toBeNull();
    expect(Q.place(q, 1, 0, 3)).toBeNull();
    expect(q).toEqual(before);
  });

  it('pays a point a square, and stitches a full row into a seam', () => {
    const q = quiltWith(SIX_MIXED, [['duo_h', 1], ['dot', 0], ['dot', 0]]);
    const stitch = Q.place(q, 0, 6, 0);
    expect(stitch).toMatchObject({ points: 2 + 10, streak: 1, perfect: 0, cleared: false, spools: 0, dealt: false });
    expect(stitch?.seams).toEqual([{ kind: 'row', index: 0, fabric: null }]);
    expect(stitch?.unpicked).toHaveLength(8);
    expect(B.filledCount(q.board)).toBe(1);
    expect(q.tray[0]).toBeNull();
    expect(q).toMatchObject({ score: 12, seams: 1, patches: 1 });
  });

  it('doubles a perfect seam, of one fabric, and gives a spool for it', () => {
    const q = quiltWith(
      `222222..
       ......3.
       ........
       ........
       ........
       ........
       ........
       ........`,
      [['duo_h', 2], null, ['dot', 0]],
    );
    const stitch = Q.place(q, 0, 6, 0);
    expect(stitch).toMatchObject({ points: 2 + 20, perfect: 1, spools: 1 });
    expect(q).toMatchObject({ perfect: 1, spools: 1 });
  });

  it('multiplies seams stitched together by how many there are', () => {
    const q = quiltWith(
      `0123012.
       0......1
       .......2
       .......3
       .......0
       .......1
       .......2
       .......3`,
      [['dot', 0], ['dot', 1], null],
    );
    const stitch = Q.place(q, 0, 7, 0);
    expect(stitch?.seams).toHaveLength(2);
    // (10 + 10) points for the seams, times 2 seams, and the square itself.
    expect(stitch?.points).toBe(1 + 40);
    expect(q.doubles).toBe(1);
  });

  it('counts a clean quilt, emptied by a seam, for points and spools', () => {
    const q = quiltWith('012301.. ' + '........ '.repeat(7), [['duo_h', 3], ['dot', 0], null]);
    const stitch = Q.place(q, 0, 6, 0);
    expect(stitch).toMatchObject({ cleared: true, points: 2 + 10 + Q.CLEAR_QUILT_POINTS, spools: Q.CLEAR_QUILT_SPOOLS });
    expect(q.clears).toBe(1);
  });

  it('keeps a streak through two patches without a seam, and multiplies the seams by it', () => {
    expect([1, 2, 3, 7, 10].map(Q.streakFactor)).toEqual([1, 1.5, 2, 4, 4]);
    const q = quiltWith(SIX_MIXED, [['duo_h', 1], ['dot', 0], ['dot', 0]]);
    q.streak = 2;
    q.sinceSeam = Q.STREAK_GRACE;
    const stitch = Q.place(q, 0, 6, 0);
    expect(stitch?.streak).toBe(3);
    expect(stitch?.points).toBe(2 + 10 * Q.streakFactor(3));
    expect(q.bestStreak).toBe(3);
  });

  it('ends the streak on the third patch without a seam', () => {
    const q = quiltWith(EMPTY_ROWS, [['dot', 0], ['dot', 1], ['dot', 2]]);
    q.streak = 3;
    q.sinceSeam = Q.STREAK_GRACE;
    expect(Q.place(q, 0, 0, 0)?.streak).toBe(0);
    expect(q.bestStreak).toBe(0);
  });

  it('deals a new tray once all three patches are sewn', () => {
    const q = quiltWith(EMPTY_ROWS, [['dot', 0], ['dot', 1], ['dot', 2]]);
    expect(Q.place(q, 0, 0, 0)?.dealt).toBe(false);
    expect(Q.place(q, 1, 2, 0)?.dealt).toBe(false);
    expect(Q.place(q, 2, 4, 0)?.dealt).toBe(true);
    expect(q.tray.every((patch) => patch !== null)).toBe(true);
  });
});

describe('dealing', () => {
  it('always deals a patch that fits, down to the last empty square', () => {
    const q = Q.newQuilt('endless', null, 3);
    q.board = board(`
      0123012.
      12301230
      23012301
      30123012
      01230123
      12301230
      23012301
      30123012`);
    for (let i = 0; i < 20; i++) {
      Q.deal(q);
      expect(Q.canMove(q)).toBe(true);
    }
    expect(q.tray.some((patch) => patch?.shape === 'dot')).toBe(true);
  });

  it('gives a crowded quilt patches that fit more often than one draw would', () => {
    // Nothing wider than two squares fits here.
    const crowded = board(`
      ..01..23
      ..23..01
      0123..01
      2301..23
      ..01..01
      ..23..23
      0123.123
      2301.301`);
    let oneDraw = 0;
    let dealt = 0;
    for (let seed = 0; seed < 200; seed++) {
      // On an empty quilt every first draw fits, so its tray shows what one draw would give.
      const q = Q.newQuilt('endless', null, seed);
      oneDraw += fits(q, crowded);
      q.rng = seed;
      q.board = [...crowded];
      Q.deal(q);
      dealt += fits(q, crowded);
    }
    expect(dealt).toBeGreaterThan(oneDraw * 1.3);
  });
});

describe('the tools', () => {
  it('unpicks the last patch: board, tray, score, spools and the patches to come', () => {
    const q = quiltWith(
      `222222..
       ........
       ........
       ........
       ........
       ........
       ........
       .......1`,
      [['duo_h', 2], ['dot', 1], ['square', 0]],
    );
    const before = structuredClone(q);
    expect(Q.place(q, 0, 6, 0)?.spools).toBe(1);
    expect(Q.unpick(q)).toBe(1);
    expect(q).toEqual(before);
    expect(Q.unpick(q)).toBeNull();
  });

  it('deals new patches and forgets the undo', () => {
    const q = quiltWith(EMPTY_ROWS, [['dot', 0], ['block', 1], ['block', 2]]);
    Q.place(q, 0, 0, 0);
    const tray = structuredClone(q.tray);
    Q.newPatches(q);
    expect(q.undo).toBeNull();
    expect(q.tray).not.toEqual(tray);
    expect(q.tray.every((patch) => patch !== null)).toBe(true);
  });

  it('snips one sewn square, and nothing else', () => {
    const q = quiltWith(SIX_MIXED, [['dot', 0], null, null]);
    Q.place(q, 0, 0, 7);
    expect(q.undo).not.toBeNull();
    expect(Q.snip(q, 6, 0)).toBe(false);
    expect(Q.snip(q, 8, 0)).toBe(false);
    expect(Q.snip(q, 0, 0)).toBe(true);
    expect(q.board[B.indexOf(0, 0)]).toBe(B.EMPTY);
    expect(q.undo).toBeNull();
  });
});

describe('the second chance', () => {
  it('unpicks the three fullest lines, once a quilt', () => {
    // One hole in every row and column, on the diagonal: no 3 by 3 patch fits.
    const q = quiltWith(
      `.1230123
       0.230123
       01.30123
       012.0123
       0123.123
       01230.23
       012301.3
       0123012.`,
      [['block', 0], ['block', 1], ['block', 2]],
    );
    expect(Q.canMove(q)).toBe(false);
    expect(Q.secondChance(q)).toHaveLength(3 * 7);
    expect(Q.canMove(q)).toBe(true);
    expect(q.tray.map((patch) => patch?.shape)).toEqual(['block', 'block', 'block']);
    expect(Q.secondChance(q)).toBeNull();
  });

  it('deals new patches when the room it made is not enough', () => {
    // Rows 1, 4 and 7 are the fullest; with them empty, a 3 by 3 patch still fits nowhere.
    const q = quiltWith(
      `..012301
       .1230123
       01..2301
       0123..01
       012.0123
       012301..
       ..230123
       012301.3`,
      [['block', 0], ['block', 1], ['block', 2]],
    );
    expect(Q.canMove(q)).toBe(false);
    Q.secondChance(q);
    for (const y of [1, 4, 7]) expect(B.seamSquares({ kind: 'row', index: y, fabric: null }).every((i) => q.board[i] === B.EMPTY)).toBe(true);
    expect(Q.canMove(q)).toBe(true);
    expect(q.tray.some((patch) => patch?.shape !== 'block')).toBe(true);
  });
});
