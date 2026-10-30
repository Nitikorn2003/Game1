/**
 * The meadow: eight zones of twelve levels, each zone bringing one new thing to the board, then
 * the wild meadow, which goes on for ever by revisiting the meadow's boards, and a daily meadow.
 *
 * A board is a shape, which says which cells start with a bud, and marks, which say which of
 * those buds hold a bee or are wax, honey, a dandelion puff or a butterfly. Shapes are drawn
 * with the centres of the cells, in bud widths: x runs from 0.5 at the left wall to 10.5 at the
 * right, and y from 0.5 at the branch down by 0.87 a row.
 *
 * The pollen of each level was tuned on the bot in sim/bot.ts (tuneShots): with it, the bot
 * reaches the goals on about the share of tries that `test/balance.test.ts` expects of its zone.
 * The first zone has three pollen more than that, for players still learning to aim.
 */
import { hashString } from '@game1/engine';
import { ALL_CELLS, CELLS, COLOURS, cellAt, centreOf, colOf, rowOf, type Colour, type Layout, type Seed } from './hive.js';
import { beesIn, type Goal, type Level } from './round.js';

export const ZONES = ['clover', 'sunflower', 'hollow', 'orchard', 'dandelion', 'butterfly', 'moonlit', 'queen'] as const;
export type ZoneId = (typeof ZONES)[number];
export const LEVELS_PER_ZONE = 12;
/** The levels of the meadow; after these the wild meadow goes on. */
export const MEADOW_LEVELS = ZONES.length * LEVELS_PER_ZONE;

/** The flower that blooms in Pip's garden once every level of a zone is reached. */
export const FLOWERS: Readonly<Record<ZoneId, string>> = {
  clover: 'daisy',
  sunflower: 'sunflower',
  hollow: 'tulip',
  orchard: 'orchid',
  dandelion: 'frangipani',
  butterfly: 'hibiscus',
  moonlit: 'moonflower',
  queen: 'goldenshower',
};

interface Spot {
  row: number;
  col: number;
  x: number;
  y: number;
}
type Where = (c: Spot) => boolean;
/** Cells by row and column, or by a rule. */
type Cells = readonly (readonly [number, number])[] | Where;

const MID = 5.5;
const spots: readonly Spot[] = ALL_CELLS.map((cell) => ({ row: rowOf(cell), col: colOf(cell), ...centreOf(cell) }));

// Shapes
const rows = (n: number): Where => (c) => c.row < n;
const band = (from: number, to: number): Where => (c) => c.row >= from && c.row <= to;
/** An upside-down triangle: the top row full, each row below narrower. */
const vee =
  (n: number, slope = 0.62): Where =>
  (c) =>
    c.row < n && Math.abs(c.x - MID) <= 5.6 - c.row * slope;
/** A bell hanging from a few buds of the top row, wider each row down. */
const bell =
  (n: number, top = 1.1, slope = 0.62): Where =>
  (c) =>
    c.row < n && Math.abs(c.x - MID) <= top + c.row * slope;
const disc =
  (cx: number, cy: number, r: number): Where =>
  (c) =>
    (c.x - cx) ** 2 + (c.y - cy) ** 2 <= r * r + 1e-9;
const xs =
  (...ranges: readonly (readonly [number, number])[]): Where =>
  (c) =>
    ranges.some(([from, to]) => c.x >= from && c.x <= to);
/** A heart, its point down, its lobes under the branch. */
const heart =
  (n: number): Where =>
  (c) => {
    if (c.row >= n) return false;
    const u = (c.x - MID) / 5.2;
    const v = (2.6 - c.y) / 3.3;
    return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0 || c.row === 0;
  };
const any =
  (...ws: Where[]): Where =>
  (c) =>
    ws.some((w) => w(c));
const both =
  (...ws: Where[]): Where =>
  (c) =>
    ws.every((w) => w(c));
const not =
  (w: Where): Where =>
  (c) =>
    !w(c);
/** Full rows, then every other cell of each row down to `to`, each still hanging from one above. */
const sparse =
  (from: number, to: number): Where =>
  (c) =>
    c.row < from || (c.row < to && (c.row % 2 === 1 ? c.col % 2 === 1 : c.col % 2 === 0 && c.col > 0));
const mirror = (cells: readonly (readonly [number, number])[]): [number, number][] =>
  cells.flatMap(([row, col]) => {
    const other = (row % 2 === 0 ? 10 : 9) - col;
    return other === col ? [[row, col] as [number, number]] : [[row, col] as [number, number], [row, other] as [number, number]];
  });

/** A goal: free every bee, clear the top row, or collect buds of a colour. */
type Want = 'bees' | 'top' | readonly [Colour, number];

interface Spec {
  shape: Where;
  bees?: Cells;
  wax?: Cells;
  honey?: Cells;
  puffs?: Cells;
  butterflies?: Cells;
  colours: number;
  shots: number;
  goals: readonly Want[];
}

const twin = any(rows(1), disc(2.8, 3.1, 2.15), disc(8.2, 3.1, 2.15));
const pillars = both(rows(7), xs([0.4, 2.6], [4.4, 6.6], [8.4, 10.6]));
const arch = any(rows(2), both(rows(7), xs([0.4, 2.6], [8.4, 10.6])));
const ring = any(rows(1), both(disc(MID, 3.7, 3.3), not(disc(MID, 3.9, 1.5))));
const corridors = any(rows(1), both(rows(7), xs([2.2, 8.8])));
/** Stripes that bend down to the middle, each held up by the buds of the middle. */
const chevron = both(rows(7), (c) => c.row === 0 || Math.abs(c.x - MID) < 0.9 || (c.row - Math.floor(Math.abs(c.x - MID) / 1.5) + 9) % 3 !== 2);
const fan = any(rows(3), both(rows(8), xs([0.4, 1.6], [3.4, 4.6], [6.4, 7.6], [9.4, 10.6])));
const hourglass = both(rows(8), (c) => Math.abs(c.x - MID) <= 1.2 + Math.abs(c.y - 3.4) * 1.25);
/** A slope: two rows deep at the left wall, eight at the right. */
const slope = both(rows(8), (c) => c.row <= 1 + Math.floor(c.x / 1.7));
const crown = both(rows(7), (c) => c.row < 4 || [0.5, 3, 5.5, 8, 10.5].some((x) => Math.abs(c.x - x) <= 0.55));
const bridge = any(rows(1), both(rows(6), xs([0.4, 2.1], [8.9, 10.6])), band(4, 5));

const SPECS: readonly Spec[] = [
  // Clover Lawn: aim, match and free the bees.
  { shape: rows(5), bees: [[2, 3], [2, 7], [4, 5]], colours: 3, shots: 11, goals: ['bees'] },
  { shape: corridors, bees: [[0, 0], [0, 10], [0, 5]], colours: 3, shots: 16, goals: ['bees'] },
  { shape: vee(6), bees: mirror([[3, 2], [5, 4]]), colours: 3, shots: 13, goals: ['bees'] },
  { shape: twin, bees: [[5, 2], [5, 7]], colours: 3, shots: 11, goals: ['bees'] },
  { shape: bell(7), bees: mirror([[6, 1]]), colours: 4, shots: 12, goals: ['bees'] },
  { shape: heart(7), bees: mirror([[2, 2], [5, 4]]), colours: 4, shots: 15, goals: ['bees'] },
  { shape: pillars, bees: [[6, 1], [6, 5], [6, 9]], colours: 4, shots: 12, goals: ['bees'] },
  { shape: ring, bees: mirror([[3, 2], [6, 4]]), colours: 4, shots: 13, goals: ['bees'] },
  { shape: chevron, bees: mirror([[1, 1], [4, 3]]), colours: 4, shots: 16, goals: ['bees'] },
  { shape: sparse(3, 8), bees: mirror([[1, 2], [2, 5]]), colours: 4, shots: 17, goals: ['bees'] },
  { shape: arch, bees: mirror([[6, 1], [1, 4]]), colours: 4, shots: 13, goals: ['bees'] },
  { shape: rows(7), bees: mirror([[0, 2], [1, 4], [0, 5]]), colours: 4, shots: 24, goals: ['bees'] },

  // Sunflower Field: clear the top row, and collect.
  { shape: rows(4), colours: 4, shots: 18, goals: ['top'] },
  { shape: vee(6), colours: 4, shots: 17, goals: ['top'] },
  { shape: rows(5), colours: 4, shots: 14, goals: [['rose', 13]] },
  { shape: bell(7), colours: 4, shots: 12, goals: ['top'] },
  { shape: twin, colours: 5, shots: 18, goals: ['top'] },
  { shape: crown, colours: 5, shots: 17, goals: [['buttercup', 12], ['clover', 12]] },
  { shape: pillars, colours: 5, shots: 17, goals: ['top'] },
  { shape: heart(7), colours: 5, shots: 17, goals: [['bluebell', 11]] },
  { shape: fan, bees: mirror([[7, 1], [7, 4]]), colours: 5, shots: 21, goals: ['bees', 'top'] },
  { shape: ring, colours: 5, shots: 14, goals: ['top'] },
  { shape: rows(6), colours: 5, shots: 27, goals: ['top'] },
  { shape: chevron, colours: 5, shots: 14, goals: [['violet', 11], ['rose', 11]] },

  // Beeswax Hollow: wax, which only falls.
  { shape: rows(5), wax: (c) => c.row === 3 && c.col % 3 !== 1, bees: mirror([[1, 2], [0, 5]]), colours: 5, shots: 28, goals: ['bees'] },
  { shape: twin, wax: (c) => c.row >= 4 && Math.hypot(c.x - 2.8, c.y - 3.1) > 1.2 && Math.hypot(c.x - 8.2, c.y - 3.1) > 1.2, bees: [[3, 2], [3, 7]], colours: 5, shots: 35, goals: ['bees'] },
  { shape: pillars, wax: (c) => c.row <= 1, bees: [[2, 1], [2, 5], [2, 9]], colours: 5, shots: 11, goals: ['bees'] },
  { shape: vee(7), wax: (c) => c.row === 0 && c.col % 2 === 0, bees: mirror([[2, 3], [5, 4]]), colours: 5, shots: 11, goals: ['bees'] },
  { shape: slope, wax: (c) => c.row === 2 && c.col <= 4, bees: [[3, 4], [5, 7], [6, 9]], colours: 5, shots: 11, goals: ['bees'] },
  { shape: rows(6), wax: (c) => c.row === 2 && Math.abs(c.x - MID) > 1.5, colours: 5, shots: 37, goals: ['top'] },
  { shape: ring, wax: (c) => c.row >= 5, bees: mirror([[0, 0], [0, 3]]), colours: 5, shots: 10, goals: ['bees'] },
  { shape: arch, wax: (c) => c.row >= 2 && c.row <= 4, bees: mirror([[6, 1], [1, 5]]), colours: 5, shots: 12, goals: ['bees'] },
  { shape: crown, wax: (c) => c.row === 4, colours: 5, shots: 25, goals: [['violet', 11], ['clover', 11]] },
  { shape: heart(7), wax: (c) => c.row >= 1 && c.row <= 2 && Math.abs(c.x - MID) < 1.2, bees: mirror([[4, 2], [6, 4]]), colours: 5, shots: 10, goals: ['bees'] },
  { shape: bridge, wax: (c) => c.row >= 1 && c.row <= 3 && (c.x < 2.2 || c.x > 8.8), bees: [[5, 3], [5, 6]], colours: 5, shots: 29, goals: ['bees', 'top'] },
  { shape: rows(7), wax: (c) => (c.row === 2 || c.row === 4) && c.col % 4 === 1, bees: mirror([[0, 1], [0, 4]]), colours: 5, shots: 26, goals: ['bees'] },

  // Honey Orchard: honey keeps a bud out of matches until a pop beside it melts it.
  { shape: rows(5), honey: (c) => c.row === 0, colours: 5, shots: 24, goals: ['top'] },
  { shape: vee(6), honey: mirror([[2, 3], [2, 5], [4, 4]]), bees: mirror([[2, 3], [2, 5], [4, 4]]), colours: 5, shots: 12, goals: ['bees'] },
  { shape: twin, honey: (c) => c.row >= 4, colours: 5, shots: 19, goals: [['rose', 9], ['bluebell', 9]] },
  { shape: rows(6), honey: (c) => c.row % 2 === 1 && Math.floor(Math.abs(c.x - MID)) % 2 === 0, bees: mirror([[1, 0], [3, 4]]), colours: 5, shots: 26, goals: ['bees'] },
  { shape: pillars, honey: (c) => c.row === 0 || c.row === 3, colours: 5, shots: 22, goals: ['top'] },
  { shape: heart(7), honey: (c) => c.row <= 1, bees: mirror([[3, 3], [6, 4]]), colours: 5, shots: 26, goals: ['bees', 'top'] },
  { shape: ring, honey: (c) => Math.hypot(c.x - MID, c.y - 3.7) > 2.6, colours: 5, shots: 16, goals: [['buttercup', 8]] },
  { shape: fan, honey: (c) => c.row >= 5, bees: mirror([[7, 1], [7, 4]]), colours: 5, shots: 20, goals: ['bees'] },
  { shape: rows(6), honey: (c) => c.row === 4, wax: (c) => c.row === 2 && c.col % 3 === 0, colours: 5, shots: 30, goals: ['top'] },
  { shape: chevron, honey: (c) => c.row <= 2, bees: mirror([[0, 2], [2, 4]]), colours: 5, shots: 22, goals: ['bees'] },
  { shape: hourglass, honey: (c) => c.row === 3 || c.row === 4, colours: 5, shots: 17, goals: [['violet', 11], ['buttercup', 11]] },
  { shape: rows(7), honey: (c) => (c.row === 1 && c.col % 2 === 0) || c.row === 6, bees: mirror([[0, 2], [0, 5], [6, 3]]), colours: 5, shots: 34, goals: ['bees', 'top'] },

  // Dandelion Hill: a puff beside a pop bursts, and pops everything around it.
  { shape: rows(5), puffs: [[3, 2], [3, 7]], bees: mirror([[1, 2], [0, 5]]), colours: 5, shots: 12, goals: ['bees'] },
  { shape: vee(6), puffs: mirror([[2, 4], [4, 3]]), colours: 5, shots: 12, goals: ['top'] },
  { shape: twin, puffs: [[3, 2], [3, 7]], bees: [[5, 2], [5, 7], [0, 2], [0, 8]], colours: 5, shots: 9, goals: ['bees'] },
  { shape: rows(6), puffs: (c) => c.row === 4 && c.col % 3 === 1, wax: (c) => c.row === 2 && c.col % 3 === 1, colours: 5, shots: 19, goals: ['top'] },
  { shape: pillars, puffs: [[4, 1], [5, 4], [4, 9]], bees: [[0, 1], [0, 5], [0, 9]], colours: 5, shots: 12, goals: ['bees'] },
  { shape: heart(7), puffs: mirror([[3, 4], [5, 3]]), honey: (c) => c.row === 0, colours: 5, shots: 19, goals: ['top'] },
  { shape: ring, puffs: mirror([[5, 2]]), bees: mirror([[0, 2], [0, 4]]), colours: 5, shots: 7, goals: ['bees'] },
  { shape: crown, puffs: (c) => c.row === 3 && c.col % 4 === 2, colours: 5, shots: 14, goals: [['clover', 12], ['rose', 12]] },
  { shape: rows(7), puffs: mirror([[2, 2], [4, 4], [5, 1]]), wax: (c) => c.row === 6 && Math.abs(c.x - MID) >= 1.5 && Math.abs(c.x - MID) <= 3.5, bees: mirror([[0, 3]]), colours: 5, shots: 16, goals: ['bees', 'top'] },
  { shape: fan, puffs: mirror([[2, 2], [2, 4]]), honey: (c) => c.row >= 6, colours: 5, shots: 9, goals: ['top'] },
  { shape: slope, puffs: [[2, 2], [4, 5]], bees: [[1, 6], [4, 8], [6, 10]], colours: 5, shots: 9, goals: ['bees'] },
  { shape: chevron, puffs: mirror([[1, 3], [3, 1], [5, 4]]), wax: (c) => c.row === 6, colours: 5, shots: 11, goals: [['bluebell', 8], ['violet', 8]] },

  // Butterfly Garden: a butterfly changes the colour of its bud after every shot.
  { shape: rows(5), butterflies: mirror([[2, 2], [2, 5]]), bees: mirror([[0, 3]]), colours: 5, shots: 15, goals: ['bees'] },
  { shape: vee(6), butterflies: mirror([[1, 3], [3, 4]]), colours: 5, shots: 16, goals: ['top'] },
  { shape: twin, butterflies: [[3, 2], [3, 7], [5, 2], [5, 7]], bees: [[0, 2], [0, 8]], colours: 5, shots: 11, goals: ['bees'] },
  { shape: rows(6), butterflies: (c) => c.row === 3 && c.col % 3 === 0, honey: (c) => c.row === 1, colours: 5, shots: 24, goals: ['top'] },
  { shape: heart(7), butterflies: mirror([[2, 3], [4, 2], [6, 5]]), bees: mirror([[1, 2]]), colours: 5, shots: 12, goals: ['bees'] },
  { shape: pillars, butterflies: [[3, 1], [3, 5], [3, 9]], wax: (c) => c.row === 5, colours: 5, shots: 15, goals: ['top'] },
  { shape: ring, butterflies: mirror([[2, 3], [5, 2]]), bees: mirror([[0, 1], [0, 4]]), colours: 5, shots: 7, goals: ['bees'] },
  { shape: crown, butterflies: (c) => c.row === 2 && c.col % 3 === 1, puffs: (c) => c.row === 4 && c.col % 4 === 0, colours: 5, shots: 15, goals: [['rose', 12], ['buttercup', 12]] },
  { shape: rows(7), butterflies: mirror([[1, 2], [3, 4], [5, 1]]), bees: mirror([[0, 1], [0, 4]]), colours: 5, shots: 20, goals: ['bees'] },
  { shape: hourglass, butterflies: (c) => c.row === 3, honey: (c) => c.row === 0, colours: 5, shots: 15, goals: ['top'] },
  { shape: fan, butterflies: mirror([[4, 0], [4, 3]]), puffs: mirror([[1, 3]]), bees: mirror([[7, 1], [7, 4]]), colours: 5, shots: 13, goals: ['bees', 'top'] },
  { shape: chevron, butterflies: mirror([[2, 3], [4, 3]]), wax: (c) => c.row === 5 && c.col % 3 === 0, colours: 5, shots: 16, goals: ['top'] },

  // Moonlit Meadow: all six colours.
  { shape: rows(5), bees: mirror([[1, 2], [3, 4]]), colours: 6, shots: 17, goals: ['bees'] },
  { shape: vee(6), colours: 6, shots: 19, goals: ['top'] },
  { shape: twin, honey: (c) => c.row >= 5, bees: [[2, 2], [2, 7]], colours: 6, shots: 13, goals: ['bees'] },
  { shape: crown, colours: 6, shots: 17, goals: [['rose', 10], ['violet', 10]] },
  { shape: pillars, puffs: [[4, 1], [4, 5], [4, 9]], colours: 6, shots: 13, goals: ['top'] },
  { shape: heart(7), wax: (c) => c.row === 3 && Math.abs(c.x - MID) > 2, bees: mirror([[2, 2], [5, 4]]), colours: 6, shots: 23, goals: ['bees'] },
  { shape: ring, butterflies: mirror([[3, 2]]), colours: 6, shots: 10, goals: ['top'] },
  { shape: bell(8), honey: (c) => c.row === 7, bees: mirror([[7, 1], [5, 3]]), colours: 6, shots: 23, goals: ['bees'] },
  { shape: slope, wax: (c) => c.row === 1 + Math.floor(c.x / 1.7) && c.col % 3 === 1, bees: [[0, 0], [3, 3], [6, 9]], colours: 6, shots: 15, goals: ['bees'] },
  { shape: rows(6), puffs: mirror([[3, 2], [3, 4]]), butterflies: mirror([[1, 2]]), colours: 6, shots: 16, goals: ['top'] },
  { shape: hourglass, bees: [[0, 4], [0, 6], [7, 5]], colours: 6, shots: 14, goals: ['bees'] },
  { shape: rows(7), honey: (c) => c.row === 4, wax: (c) => c.row === 6 && c.col % 2 === 0, colours: 6, shots: 28, goals: [['clover', 11], ['bluebell', 11]] },

  // The Queen's Garden: everything the meadow has.
  { shape: rows(6), wax: (c) => c.row === 3 && c.col % 3 === 1, honey: (c) => c.row === 0, bees: mirror([[1, 3]]), colours: 5, shots: 28, goals: ['bees', 'top'] },
  { shape: twin, puffs: [[3, 2], [3, 7]], butterflies: [[5, 1], [5, 8]], colours: 6, shots: 14, goals: ['top'] },
  { shape: heart(7), honey: (c) => c.row === 2, puffs: mirror([[4, 3]]), bees: mirror([[1, 2], [6, 4]]), colours: 6, shots: 13, goals: ['bees'] },
  { shape: pillars, wax: (c) => c.row === 2, butterflies: [[5, 1], [5, 5], [5, 9]], bees: [[0, 1], [0, 5], [0, 9]], colours: 6, shots: 19, goals: ['bees'] },
  { shape: ring, honey: (c) => c.row <= 1, wax: (c) => c.row === 6, colours: 6, shots: 20, goals: ['top'] },
  { shape: crown, puffs: (c) => c.row === 5 && c.col % 4 === 1, butterflies: (c) => c.row === 1 && c.col % 4 === 2, colours: 6, shots: 18, goals: [['buttercup', 10], ['marigold', 10]] },
  { shape: fan, wax: (c) => c.row === 2 && c.col % 2 === 1, bees: mirror([[7, 1], [7, 4]]), honey: mirror([[7, 1], [7, 4]]), colours: 6, shots: 11, goals: ['bees'] },
  { shape: chevron, honey: (c) => c.row === 0, puffs: mirror([[3, 1]]), butterflies: mirror([[5, 3]]), colours: 6, shots: 18, goals: ['top'] },
  { shape: slope, puffs: [[3, 5], [4, 7]], honey: (c) => c.row >= 3 && c.row === 1 + Math.floor(c.x / 1.7), bees: [[0, 0], [6, 10]], colours: 6, shots: 17, goals: ['bees'] },
  { shape: bridge, wax: (c) => c.row === 5 && c.col % 2 === 0, butterflies: [[4, 4], [4, 6]], bees: [[1, 0], [1, 9]], colours: 6, shots: 21, goals: ['bees', 'top'] },
  { shape: hourglass, honey: (c) => c.row === 1 || c.row === 6, puffs: [[3, 4], [4, 5]], colours: 6, shots: 15, goals: [['rose', 9], ['clover', 9]] },
  { shape: rows(7), wax: (c) => c.row === 5 && c.col % 3 === 0, honey: (c) => c.row === 1, puffs: mirror([[3, 2]]), butterflies: mirror([[2, 4]]), bees: mirror([[0, 1], [0, 5]]), colours: 6, shots: 25, goals: ['bees', 'top'] },
];

function listed(cells: Cells | undefined): Set<number> {
  if (!cells) return new Set();
  if (typeof cells === 'function') return new Set(spots.filter(cells).map((c) => cellAt(c.row, c.col)));
  return new Set(cells.map(([row, col]) => cellAt(row, col)));
}

/**
 * The seeds of a board. A bee listed outside the shape adds a bud for it; any other mark listed
 * by row and column must be on a bud of the shape, or the level is wrong.
 */
export function layoutOf(spec: Pick<Spec, 'shape' | 'bees' | 'wax' | 'honey' | 'puffs' | 'butterflies'>): Layout {
  const layout: (Seed | null)[] = new Array<Seed | null>(CELLS).fill(null);
  const bees = listed(spec.bees);
  const wax = listed(spec.wax);
  const honey = listed(spec.honey);
  const puffs = listed(spec.puffs);
  const butterflies = listed(spec.butterflies);
  for (const marks of [spec.wax, spec.honey, spec.puffs, spec.butterflies])
    if (marks && typeof marks !== 'function')
      for (const [row, col] of marks) {
        const spot = spots.find((c) => c.row === row && c.col === col);
        if (!spot || (!spec.shape(spot) && !bees.has(cellAt(row, col)))) throw new Error(`No bud at row ${String(row)}, column ${String(col)}`);
      }
  for (const cell of bees) if (wax.has(cell) || puffs.has(cell)) throw new Error(`A bee in wax or a puff, in cell ${String(cell)}`);
  for (const c of spots) {
    const cell = cellAt(c.row, c.col);
    if (!spec.shape(c) && !bees.has(cell)) continue;
    const kind = wax.has(cell) ? 'wax' : puffs.has(cell) ? 'puff' : 'bud';
    layout[cell] = { kind, bee: kind === 'bud' && bees.has(cell), honey: kind === 'bud' && honey.has(cell), butterfly: kind === 'bud' && butterflies.has(cell) };
  }
  return layout;
}

function goalOf(want: Want, layout: Layout): Goal {
  if (want === 'bees') return { kind: 'bees', count: beesIn(layout) };
  if (want === 'top') return { kind: 'top' };
  return { kind: 'collect', colour: COLOURS.indexOf(want[0]), count: want[1] };
}

function levelOf(spec: Spec): Level {
  const layout = layoutOf(spec);
  return { layout, colours: spec.colours, shots: spec.shots, goals: spec.goals.map((want) => goalOf(want, layout)) };
}

const MEADOW: readonly Level[] = SPECS.map(levelOf);

export function zoneOf(level: number): ZoneId | null {
  return ZONES[Math.floor((level - 1) / LEVELS_PER_ZONE)] ?? null;
}

/** The levels of a zone, by number from 1. */
export function levelsOf(zone: ZoneId): number[] {
  const first = ZONES.indexOf(zone) * LEVELS_PER_ZONE + 1;
  return Array.from({ length: LEVELS_PER_ZONE }, (_, i) => first + i);
}

/** The same level with its collect goals in other colours, which plays just as hard. */
function recoloured(level: Level, by: number): Level {
  return {
    ...level,
    goals: level.goals.map((goal) => (goal.kind === 'collect' ? { ...goal, colour: (goal.colour + by) % level.colours } : goal)),
  };
}

/** Level `n`, from 1: the meadow's levels, then the wild meadow, which revisits the boards of the meadow past its first zones. */
export function levelAt(n: number): Level {
  const meadow = MEADOW[n - 1];
  if (meadow) return meadow;
  const past = n - MEADOW_LEVELS - 1;
  const from = LEVELS_PER_ZONE * 2;
  const source = MEADOW[from + (past % (MEADOW_LEVELS - from))] ?? MEADOW[MEADOW_LEVELS - 1];
  if (!source) throw new Error('The meadow has no levels');
  return recoloured(source, 1 + Math.floor(past / (MEADOW_LEVELS - from)));
}

/** Three more pollen than its board had in the meadow: the daily meadow is a treat, not a wall. */
export const DAILY_EXTRA_SHOTS = 3;

/** The daily meadow: the same for everyone on a day, a board past the first zone in new colours. */
export function dailyLevel(day: string): Level {
  const hash = hashString(`meadow:${day}`);
  const from = LEVELS_PER_ZONE;
  const source = MEADOW[from + (hash % (MEADOW_LEVELS - from))] ?? MEADOW[MEADOW_LEVELS - 1];
  if (!source) throw new Error('The meadow has no levels');
  const level = recoloured(source, 1 + ((hash >>> 8) % 5));
  return { ...level, shots: level.shots + DAILY_EXTRA_SHOTS };
}

/** The seed of a try at a level: new colours each try, and the same on every device for the same try. */
export function seedOf(key: string, attempt: number): number {
  return hashString(`${key}#${String(attempt)}`);
}
