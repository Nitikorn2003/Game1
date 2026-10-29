import { describe, expect, it } from 'vitest';
import * as B from '../src/sim/board.js';
import { SHAPES, SHAPE_IDS, SHAPE_WEIGHTS, isShapeId } from '../src/sim/shapes.js';
import { board } from './helpers.js';

describe('the patch shapes', () => {
  it.each(SHAPE_IDS)('%s is drawn tight: every row and column of its box has a square', (id) => {
    const shape = SHAPES[id];
    expect(shape.cells.length).toBeGreaterThan(0);
    expect(new Set(shape.cells.map(([x, y]) => `${x},${y}`)).size).toBe(shape.cells.length);
    for (let x = 0; x < shape.width; x++) expect(shape.cells.some(([cx]) => cx === x)).toBe(true);
    for (let y = 0; y < shape.height; y++) expect(shape.cells.some(([, cy]) => cy === y)).toBe(true);
    expect(shape.cells.every(([x, y]) => x < shape.width && y < shape.height)).toBe(true);
  });

  it('has no two shapes alike, and none wider or taller than five squares', () => {
    const drawn = SHAPE_IDS.map((id) => JSON.stringify(SHAPES[id].cells.toSorted(([ax, ay], [bx, by]) => ay - by || ax - bx)));
    expect(new Set(drawn).size).toBe(SHAPE_IDS.length);
    expect(Math.max(...SHAPE_IDS.map((id) => Math.max(SHAPES[id].width, SHAPES[id].height)))).toBe(5);
  });

  it('gives every shape a chance to turn up', () => {
    expect(SHAPE_WEIGHTS.map(([id]) => id)).toEqual(SHAPE_IDS);
    for (const [id, weight] of SHAPE_WEIGHTS) expect(weight, id).toBeGreaterThan(0);
  });

  it('knows its own shape names and nothing else', () => {
    expect(isShapeId('ell_a')).toBe(true);
    expect(isShapeId('toString')).toBe(false);
    expect(isShapeId('constructor')).toBe(false);
    expect(isShapeId(3)).toBe(false);
  });
});

describe('the quilt board', () => {
  it('fits a patch only on empty squares inside the quilt', () => {
    const b = board(`
      ##......
      ........
      ........
      ........
      ........
      ........
      ........
      ........`.replace(/#/g, '0'));
    const square = SHAPES.square;
    expect(B.fits(b, square, 0, 0)).toBe(false);
    expect(B.fits(b, square, 2, 0)).toBe(true);
    expect(B.fits(b, square, 7, 0)).toBe(false);
    expect(B.fits(b, square, 6, 6)).toBe(true);
    expect(B.fits(b, square, -1, 3)).toBe(false);
    // Four places in every row but the first, where the two sewn squares leave two.
    expect(B.placements(b, SHAPES.long_h)).toHaveLength(4 * 7 + 2);
  });

  it('finds full rows and columns, and tells perfect seams from mixed ones', () => {
    const b = board(`
      11111111
      0.......
      0.......
      0.......
      0.......
      0.......
      0.......
      ........`);
    expect(B.fullSeams(b)).toEqual([{ kind: 'row', index: 0, fabric: 1 }]);
    b[B.indexOf(0, 7)] = 0;
    b[B.indexOf(0, 0)] = 0;
    expect(B.fullSeams(b)).toEqual([
      { kind: 'row', index: 0, fabric: null },
      { kind: 'column', index: 0, fabric: 0 },
    ]);
  });

  it('unpicks a square that is in two seams once, and remembers its fabric', () => {
    const b = board(`
      22222222
      2.......
      2.......
      2.......
      2.......
      2.......
      2.......
      2......3`);
    const unpicked = B.unpickSeams(b, B.fullSeams(b));
    expect(unpicked).toHaveLength(15);
    expect(unpicked.every((u) => u.fabric === 2)).toBe(true);
    expect(B.filledCount(b)).toBe(1);
  });

  it('orders lines fullest first, rows before columns when they tie', () => {
    const b = board(`
      ........
      000000..
      ........
      ........
      0000000.
      ........
      ........
      ........`);
    const [first, second, third] = B.fullestLines(b);
    expect(first).toEqual({ kind: 'row', index: 4, fabric: null });
    expect(second).toEqual({ kind: 'row', index: 1, fabric: null });
    expect(third).toEqual({ kind: 'column', index: 0, fabric: null });
  });

  it('aims a tapped patch by its middle, and covers the tapped square whenever the patch can', () => {
    expect(B.aimAt(SHAPES.block, 4, 4)).toEqual([3, 3]);
    expect(B.aimAt(SHAPES.long_h, 4, 4)).toEqual([2, 4]);
    // At the top right corner the bend can only cover the square with its own right end.
    expect(B.aimAt(SHAPES.corner_a, 7, 0)).toEqual([6, 0]);
    // No placement of this corner covers the very corner square, so it stays as near as it goes.
    expect(B.aimAt(SHAPES.corner_a, 7, 7)).toEqual([6, 6]);
    const empty = B.emptyBoard();
    for (const id of SHAPE_IDS) {
      const shape = SHAPES[id];
      const covers = (left: number, top: number, x: number, y: number) => shape.cells.some(([cx, cy]) => left + cx === x && top + cy === y);
      for (let y = 0; y < B.SIZE; y++) {
        for (let x = 0; x < B.SIZE; x++) {
          const [left, top] = B.aimAt(shape, x, y);
          const where = `${id} aimed at ${String(x)},${String(y)}`;
          expect(B.fits(empty, shape, left, top), where).toBe(true);
          const coverable = B.placements(empty, shape).some(([l, t]) => covers(l, t, x, y));
          expect(covers(left, top, x, y), where).toBe(coverable);
        }
      }
    }
  });
});
