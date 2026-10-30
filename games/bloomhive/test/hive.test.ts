import { describe, expect, it } from 'vitest';
import {
  ALL_CELLS,
  CELLS,
  COLS,
  MAX_PATCH,
  ROWS,
  SHOOTER,
  aimAt,
  beamCells,
  cellAt,
  centreOf,
  coloursOn,
  dropLoose,
  groupAt,
  heldCells,
  moveButterflies,
  neighbours,
  newBoard,
  popCells,
  rainbowColour,
  reachedPip,
  trace,
  validCell,
  within,
  type Board,
  type Gone,
} from '../src/sim/hive.js';
import { layoutOf } from '../src/sim/levels.js';
import { boardOf, textOf } from './helpers.js';

const EMPTY_ROW = '. . . . . . . . . . .';
const EMPTY_ODD = '. . . . . . . . . .';

describe('the board', () => {
  it('has rows of eleven and ten, each odd row half a bud to the right', () => {
    expect(ALL_CELLS).toHaveLength(Math.ceil(ROWS / 2) * COLS + Math.floor(ROWS / 2) * (COLS - 1));
    expect(validCell(cellAt(1, 10))).toBe(false);
    expect(validCell(cellAt(1, 9))).toBe(true);
    expect(validCell(-1)).toBe(false);
    expect(validCell(CELLS)).toBe(false);
    expect(centreOf(cellAt(0, 0))).toEqual({ x: 0.5, y: 0.5 });
    expect(centreOf(cellAt(1, 0)).x).toBe(1);
    expect(centreOf(cellAt(1, 0)).y).toBeCloseTo(0.5 + Math.sqrt(3) / 2);
  });

  it('knows the cells touching each cell, at the walls too', () => {
    const sorted = (cells: readonly number[]) => [...cells].sort((a, b) => a - b);
    expect(sorted(neighbours(cellAt(0, 0)))).toEqual([cellAt(0, 1), cellAt(1, 0)]);
    expect(sorted(neighbours(cellAt(1, 0)))).toEqual(sorted([cellAt(0, 0), cellAt(0, 1), cellAt(1, 1), cellAt(2, 0), cellAt(2, 1)]));
    expect(sorted(neighbours(cellAt(1, 9)))).toEqual(sorted([cellAt(0, 9), cellAt(0, 10), cellAt(1, 8), cellAt(2, 9), cellAt(2, 10)]));
    expect(neighbours(cellAt(4, 5))).toHaveLength(6);
    // Neighbours are one bud apart, and the relation goes both ways.
    for (const cell of ALL_CELLS)
      for (const n of neighbours(cell)) {
        const a = centreOf(cell);
        const b = centreOf(n);
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(1);
        expect(neighbours(n)).toContain(cell);
      }
    expect(within(cellAt(4, 5), 1)).toHaveLength(7);
    expect(within(cellAt(4, 5), 2)).toHaveLength(19);
  });

  it('starts from a level’s layout with small patches of each colour', () => {
    const layout = layoutOf({ shape: (c) => c.row < 7, bees: [[1, 1]], wax: [[2, 2]], puffs: [[3, 3]], honey: [[4, 4]], butterflies: [[5, 5]] });
    for (let seed = 0; seed < 20; seed++) {
      let n = seed + 1;
      const random = () => {
        n = (n * 16807) % 2147483647;
        return n / 2147483647;
      };
      const b = newBoard(layout, 4, random);
      for (const cell of ALL_CELLS) {
        const bud = b.cells[cell];
        if (!bud || bud.kind !== 'bud') continue;
        expect(bud.colour).toBeLessThan(4);
        expect(groupAt({ cells: b.cells.map((x) => (x ? { ...x, honey: false } : x)), nextId: b.nextId }, cell).length).toBeLessThanOrEqual(MAX_PATCH);
      }
      expect(b.cells[cellAt(1, 1)]?.bee).toBe(true);
      expect(b.cells[cellAt(2, 2)]?.kind).toBe('wax');
      expect(b.cells[cellAt(3, 3)]?.kind).toBe('puff');
      expect(b.cells[cellAt(4, 4)]?.honey).toBe(true);
      expect(b.cells[cellAt(5, 5)]?.butterfly).toBe(true);
      expect(new Set(b.cells.flatMap((bud) => (bud ? [bud.id] : []))).size).toBe(b.cells.filter(Boolean).length);
    }
  });
});

describe('a shot', () => {
  it('flies straight up to the branch, and sticks in the top row', () => {
    const b = boardOf([]);
    const flight = trace(b, 90);
    expect(flight.points).toHaveLength(2);
    expect(flight.points[0]).toEqual({ x: SHOOTER.x, y: SHOOTER.y });
    expect(flight.cell).toBe(cellAt(0, 5));
  });

  it('bounces off the walls', () => {
    const flight = trace(boardOf([]), 60);
    expect(flight.points).toHaveLength(3);
    expect(flight.points[1]?.x).toBeCloseTo(10.5);
    expect(flight.cell).toBe(cellAt(0, 8));
    const twice = trace(boardOf([]), 80);
    expect(twice.points.length).toBeGreaterThanOrEqual(2);
    const left = trace(boardOf([]), 120);
    expect(left.points[1]?.x).toBeCloseTo(0.5);
  });

  it('sticks beside the first bud it touches', () => {
    const b = boardOf(['. . . . . a . . . . .']);
    // Under the bud, on the side the ball comes from.
    expect([cellAt(1, 4), cellAt(1, 5)]).toContain(trace(b, 90).cell);
    expect(trace(b, 92).cell).toBe(cellAt(1, 4));
    expect(trace(b, 88).cell).toBe(cellAt(1, 5));
    expect(trace(b, aimAt(cellAt(1, 5))).cell).toBe(cellAt(1, 5));
    expect(trace(b, aimAt(cellAt(0, 4))).cell).toBe(cellAt(0, 4));
  });

  it('slips through a gap between two buds a cell apart', () => {
    const b = boardOf([EMPTY_ROW, EMPTY_ODD, '. . . . a . a . . . .']);
    expect(trace(b, 90).cell).toBe(cellAt(0, 5));
  });

  it('knows when a bud has come down to Pip', () => {
    const rows = Array.from({ length: ROWS }, (_, row) => (row % 2 === 0 ? '. . . . . a . . . . .' : '. . . . a . . . . .'));
    expect(reachedPip(boardOf(rows))).toBe(true);
    expect(reachedPip(boardOf(rows.slice(0, -1)))).toBe(false);
  });

  it('as a sunbeam goes through every bud to the branch, over the cells on its way', () => {
    const b = boardOf(['a b c d e f a b c d e', 'a b c d e f a b c d']);
    const beam = trace(b, 90, true);
    expect(beam.cell).toBeNull();
    expect(beam.points.at(-1)?.y).toBeCloseTo(0.5);
    const cells = beamCells(beam.points);
    expect(cells).toContain(cellAt(0, 5));
    expect(cells).toContain(cellAt(1, 4));
    expect(cells).toContain(cellAt(1, 5));
    expect(cells).not.toContain(cellAt(0, 3));
  });
});

describe('matches and falls', () => {
  it('pops three or more of a colour that touch, and not two', () => {
    const b = boardOf(['a a b . . . . . . . .', 'a . . . . . . . . .']);
    expect(groupAt(b, cellAt(0, 0)).sort((p, q) => p - q)).toEqual([cellAt(0, 0), cellAt(0, 1), cellAt(1, 0)]);
    expect(groupAt(b, cellAt(0, 2))).toEqual([cellAt(0, 2)]);
    expect(groupAt(b, cellAt(0, 5))).toEqual([]);
  });

  it('keeps honey and wax out of matches', () => {
    const b = boardOf(['a a~ W . . . . . . . .', 'a . . . . . . . . .']);
    expect(groupAt(b, cellAt(0, 0))).toHaveLength(2);
    expect(groupAt(b, cellAt(0, 2))).toEqual([]);
  });

  it('melts honey beside a pop', () => {
    const b = boardOf(['a a b~ . . . . . . . .', 'a . . . . . . . . .']);
    const popped: Gone[] = [];
    const melted = popCells(b, [cellAt(0, 0), cellAt(0, 1), cellAt(1, 0)], popped);
    expect(popped).toHaveLength(3);
    expect(melted).toEqual([cellAt(0, 2)]);
    expect(b.cells[cellAt(0, 2)]?.honey).toBe(false);
    expect(textOf(b)).toEqual(['. . b . . . . . . . .']);
  });

  it('bursts a puff beside a pop, and everything around it, wax too, one puff after another', () => {
    const b = boardOf(['a a * W * c . . . . .', '. . b . d . . . . .']);
    const popped: Gone[] = [];
    popCells(b, [cellAt(0, 0), cellAt(0, 1)], popped);
    // The first puff takes the wax and b, the second puff beside it takes c and d.
    expect(textOf(b)).toEqual([]);
    expect(popped).toHaveLength(8);
  });

  it('drops whatever hangs from nothing once the buds holding it pop', () => {
    const b = boardOf(['a a . . . . . . . . .', 'b+ . . . . . . . . .', 'c W . . . . . . . . .']);
    const popped: Gone[] = [];
    popCells(b, [cellAt(0, 0), cellAt(0, 1)], popped);
    expect(heldCells(b).size).toBe(0);
    const fell = dropLoose(b);
    expect(fell.map((g) => g.bud.kind)).toEqual(['bud', 'bud', 'wax']);
    expect(fell[0]?.bud.bee).toBe(true);
    expect(textOf(b)).toEqual([]);
  });

  it('keeps everything that hangs from the branch, however long the chain', () => {
    const b = boardOf(['. . . . . a . . . . .', '. . . . . b . . . .', '. . . . . . c . . . .', '. . . . . . d . . .']);
    expect(dropLoose(b)).toEqual([]);
  });

  it('lets a rainbow take the colour that makes the biggest group', () => {
    const b: Board = boardOf(['a . b b . . . . . . .', '. a . b . . . . . .']);
    // Between the a's and the b's of the second row: the b's make four.
    expect(rainbowColour(b, cellAt(0, 1))).toBe(1);
    expect(rainbowColour(boardOf(['. a . . . . . . . . .']), cellAt(0, 0))).toBe(0);
    expect(rainbowColour(boardOf([]), cellAt(0, 0))).toBe(0);
  });

  it('moves each butterfly’s bud on to the next colour', () => {
    const b = boardOf(['a^ c^ b . . . . . . . .']);
    expect(moveButterflies(b, 3)).toEqual([cellAt(0, 0), cellAt(0, 1)]);
    expect(textOf(b)).toEqual(['b^ a^ b . . . . . . . .']);
    expect(coloursOn(b)).toEqual([0, 1]);
  });
});
