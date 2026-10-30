/**
 * Crumb Lane: eight shops of twelve levels, each shop bringing one new thing to the counter,
 * then the late shift, which goes on for ever by baking the lane's counters again with more
 * kinds of pastry, and a daily special.
 *
 * A counter is drawn in layers, each a grid of tiles placed some half tiles from the top left:
 * layer 0 at the bottom. Every counter has a whole number of sets of three; a shape that does
 * not is fitted by taking tiles off its top, in pairs either side of the middle where it can.
 *
 * The kinds and the mix of each level were tuned on the bot in sim/bot.ts: with them the bot
 * clears about the share of deals that `test/balance.test.ts` expects of its shop.
 */
import { hashString } from '@game1/engine';
import { COUNTER_H, COUNTER_W, LAYER, layerOf, type Slot } from './counter.js';
import type { Level } from './round.js';

export const ZONES = ['bread', 'cafe', 'cookies', 'cupcakes', 'pies', 'donuts', 'chocolate', 'cakes'] as const;
export type ZoneId = (typeof ZONES)[number];
export const LEVELS_PER_ZONE = 12;
/** The levels of the lane; after these the late shift goes on. */
export const LANE_LEVELS = ZONES.length * LEVELS_PER_ZONE;

// ---------------------------------------------------------------------------------------
// Shapes

/** A layer drawn as text, a character a tile: `x` a tile, a digit a stack of that many, anything else none. */
function art(layer: number, dx: number, dy: number, ...rows: readonly string[]): Slot[] {
  const slots: Slot[] = [];
  rows.forEach((row, r) => {
    row.split('').forEach((ch, c) => {
      const n = ch === 'x' ? 1 : /[2-9]/.test(ch) ? Number(ch) : 0;
      for (let k = 0; k < n; k++) slots.push({ x: dx + 2 * c, y: dy + 2 * r, z: layer * LAYER + k });
    });
  });
  return slots;
}

/** A block of `w` by `h` tiles in a layer. */
function rect(w: number, h: number, dx = 0, dy = 0, layer = 0): Slot[] {
  return art(layer, dx, dy, ...Array.from({ length: h }, () => 'x'.repeat(w)));
}

/** Layers of blocks, each a tile smaller each way than the one under it and centred on it. */
function pyramid(w: number, h: number, layers: number): Slot[] {
  return Array.from({ length: layers }, (_, k) => rect(w - k, h - k, k, k, k)).flat();
}

/** The outline of a block, `t` tiles thick. */
function frame(w: number, h: number, dx = 0, dy = 0, layer = 0, t = 1): Slot[] {
  return rect(w, h, dx, dy, layer).filter((s) => {
    const c = (s.x - dx) / 2;
    const r = (s.y - dy) / 2;
    return c < t || r < t || c >= w - t || r >= h - t;
  });
}

/** Rows centred on one another, each `widths[i]` tiles wide, in a layer. */
function rows(widths: readonly number[], dy = 0, layer = 0): Slot[] {
  const widest = Math.max(...widths);
  return widths.flatMap((w, r) => rect(w, 1, widest - w, dy + 2 * r, layer));
}

const join = (...parts: readonly (readonly Slot[])[]): Slot[] => parts.flat();

/** Moves a shape so that it starts at the top left. */
function anchor(slots: readonly Slot[]): Slot[] {
  const x0 = Math.min(...slots.map((s) => s.x));
  const y0 = Math.min(...slots.map((s) => s.y));
  return slots.map((s) => ({ ...s, x: s.x - x0, y: s.y - y0 }));
}

/**
 * Takes the fewest tiles off the top of a shape that leave a whole number of sets: a pair
 * either side of the middle for one too many twice over, the middle tile or two pairs for one.
 */
export function fit(shape: readonly Slot[]): Slot[] {
  let slots = anchor(shape);
  const width = Math.max(...slots.map((s) => s.x + 2));
  const mirror = (s: Slot) => slots.find((t) => t.x === width - 2 - s.x && t.y === s.y && t.z === s.z);
  const centre = (s: Slot) => Math.abs(s.x + 1 - width / 2) + Math.abs(s.y + 1 - Math.max(...slots.map((t) => t.y + 2)) / 2);
  const drop = (gone: readonly Slot[]) => {
    slots = slots.filter((s) => !gone.includes(s));
  };
  // Only tiles nothing sits on can come off.
  const bare = () => slots.filter((s) => !slots.some((t) => t.z > s.z && Math.abs(t.x - s.x) < 2 && Math.abs(t.y - s.y) < 2)).sort((a, b) => b.z - a.z || centre(a) - centre(b));
  const pair = () => {
    for (const s of bare()) {
      const m = mirror(s);
      if (m && m !== s && bare().includes(m)) return [s, m];
    }
    return null;
  };
  for (let guard = 0; guard < 8 && slots.length % 3 !== 0; guard++) {
    const over = slots.length % 3;
    const axis = bare().find((s) => mirror(s) === s);
    const twin = pair();
    if (over === 1 && axis) drop([axis]);
    else if (twin) drop(twin);
    else drop(bare().slice(0, over));
  }
  return slots;
}

// The counters, from small to big. Each fits the counter: 7 tiles across and 9 down at most.
const SQUARE = rect(3, 3);
const CUSHION = join(rect(4, 3), rect(3, 2, 1, 1, 1));
const BUN = join(rect(5, 3), rect(4, 2, 1, 1, 1), rect(1, 1, 4, 2, 2));
const BARS = join(rect(4, 1), rect(4, 1, 0, 4), rect(4, 1, 0, 8), rect(3, 1, 1, 1, 1), rect(3, 1, 1, 4, 1), rect(3, 1, 1, 7, 1));
const PYRAMID = pyramid(4, 4, 2);
const STEPS = pyramid(5, 5, 3);
const DIAMOND = join(rows([2, 3, 4, 3, 2]), rows([2, 3, 3, 2], 1, 1).map((s) => ({ ...s, x: s.x + 1 })));
const RING = join(frame(5, 5), frame(4, 4, 1, 1, 1));
const CROSS = join(art(0, 0, 0, '..xx..', '..xx..', 'xxxxxx', 'xxxxxx', '..xx..', '..xx..'), art(1, 1, 1, '..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..'));
const TWIN = join(rect(3, 5), rect(3, 5, 8), rect(2, 4, 1, 1, 1), rect(2, 4, 9, 1, 1));
const HOURGLASS = join(rows([5, 4, 3, 2, 3, 4, 5]), rows([4, 3, 2, 1, 2, 3, 4], 1, 1).map((s) => ({ ...s, x: s.x + 1 })));
const HEART = join(
  art(0, 0, 0, '.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'),
  art(1, 1, 1, '.x..x.', 'xxxxxx', '.xxxx.', '..xx..'),
);
const FLOWER = join(art(0, 0, 0, '..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..'), art(1, 1, 1, '.xx.', 'x..x', 'x..x', '.xx.'));
/** The flower again, its petals stacked on it and a stack at its heart. */
const BLOOM = join(art(0, 0, 0, '..x..', '.xxx.', 'xxxxx', '.xxx.', '..x..'), art(1, 0, 0, '..x..', '.x.x.', 'x.3.x', '.x.x.', '..x..'));
const STAIRS = join(art(0, 0, 0, 'x.....', 'xx....', 'xxx...', 'xxxx..', 'xxxxx.', 'xxxxxx'), art(1, 1, 1, 'x....', 'xx...', 'xxx..', 'xxxx.', 'xxxxx'));
const BOWL = join(art(0, 0, 0, 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..'), art(1, 1, 1, 'xxxxxx', '.xxxx.', '..xx..'), art(2, 2, 2, 'xxxxx'));
const COLUMNS = join(art(0, 0, 0, '3.3.3', '3.3.3', '3.3.3'), art(1, 2, 1, 'xxx', 'xxx'));
const CAKE = join(rect(7, 2, 0, 12), rect(5, 2, 2, 8), rect(3, 2, 4, 4), rect(1, 2, 6, 0), rect(6, 1, 1, 13, 1), rect(4, 1, 3, 9, 1), rect(2, 1, 5, 5, 1));
const BUTTERFLY = join(art(0, 0, 0, 'xx...xx', 'xxx.xxx', 'xxxxxxx', 'xxx.xxx', 'xx...xx'), art(1, 1, 1, 'x....x', 'xx..xx', 'xx..xx', 'x....x'), art(2, 6, 2, 'x', 'x', 'x'));
const ARCH = join(art(0, 0, 0, 'xxxxxxx', 'xxxxxxx', 'xx...xx', 'xx...xx', 'xx...xx', 'xx...xx'), art(1, 1, 1, 'xxxxxx', 'x....x', 'x....x', 'x....x'));
const WINDOW = join(frame(7, 7, 0, 0, 0, 2), frame(6, 6, 1, 1, 1), rect(3, 3, 4, 4, 0), rect(2, 2, 5, 5, 1));
const ZIGZAG = join(art(0, 0, 0, 'xxx....', '.xxx...', '..xxx..', '...xxx.', '....xxx', '...xxx.', '..xxx..', '.xxx...', 'xxx....'), art(1, 1, 1, 'xx....', '.xx...', '..xx..', '...xx.', '..xx..', '.xx...', 'xx....'));
const ROUND = join(art(0, 0, 0, '.xxxxx.', 'xxxxxxx', 'xx...xx', 'xx...xx', 'xx...xx', 'xxxxxxx', '.xxxxx.'), art(1, 1, 1, '.xxxx.', 'xx..xx', 'x....x', 'xx..xx', '.xxxx.'), art(2, 2, 6, 'x.x.x'));
const TOWER = join(rect(5, 7), rect(4, 6, 1, 1, 1), rect(3, 5, 2, 2, 2), rect(2, 4, 3, 3, 3));
const BIG_PYRAMID = pyramid(7, 7, 4);
const SLAB = join(rect(7, 6), rect(6, 5, 1, 1, 1));
const CHIMNEYS = join(rect(7, 4, 0, 10), art(1, 0, 6, '4.4.4.4'), art(0, 0, 0, '2.2.2.2', '.......', '2.2.2.2'));
const TERRACE = join(rect(7, 3), rect(6, 3, 1, 6, 0), rect(5, 3, 2, 12, 0), rect(6, 2, 1, 1, 1), rect(5, 2, 2, 7, 1), rect(4, 2, 3, 13, 1));
const PINWHEEL = join(art(0, 0, 0, 'xxx....', 'xxx.xxx', 'xxx.xxx', '...x...', 'xxx.xxx', 'xxx.xxx', '....xxx'), art(1, 1, 1, 'xx....', 'xx.xx.', '..xx..', '.xx.xx', '....xx'));
const BRIDGE = join(rect(7, 2), rect(2, 4, 0, 4), rect(2, 4, 10, 4), rect(6, 1, 1, 1, 1), rect(1, 3, 1, 5, 1), rect(1, 3, 11, 5, 1), art(2, 2, 0, '22222'));
const GRAND = join(rect(7, 9), rect(6, 8, 1, 1, 1), rect(5, 7, 2, 2, 2));
const HIVE = join(art(0, 0, 0, '.x.x.x.', 'xxxxxxx', '.x.x.x.', 'xxxxxxx', '.x.x.x.', 'xxxxxxx', '.x.x.x.'), art(1, 1, 1, 'xxxxxx', '......', 'xxxxxx', '......', 'xxxxxx'), art(2, 2, 2, '2.2.2', '.....', '2.2.2'));

export const SHAPES = {
  SQUARE,
  CUSHION,
  BUN,
  BARS,
  PYRAMID,
  STEPS,
  DIAMOND,
  RING,
  CROSS,
  TWIN,
  HOURGLASS,
  HEART,
  FLOWER,
  BLOOM,
  STAIRS,
  BOWL,
  COLUMNS,
  CAKE,
  BUTTERFLY,
  ARCH,
  WINDOW,
  ZIGZAG,
  ROUND,
  TOWER,
  BIG_PYRAMID,
  SLAB,
  CHIMNEYS,
  TERRACE,
  PINWHEEL,
  BRIDGE,
  GRAND,
  HIVE,
} as const;
export type ShapeId = keyof typeof SHAPES;

// ---------------------------------------------------------------------------------------
// Specials

/** A rule for which tiles of a counter are special. */
type Where = (s: Slot, all: readonly Slot[]) => boolean;

const top = (s: Slot, all: readonly Slot[]) => layerOf(s.z) === Math.max(...all.map((t) => layerOf(t.z)));
const bottom = (s: Slot) => layerOf(s.z) === 0;
const under: Where = (s, all) => !top(s, all);
/** Every other tile, like the squares of a board. */
const checker = (s: Slot) => (Math.floor(s.x / 2) + Math.floor(s.y / 2)) % 2 === 0;
/** A stacked tile that is not on top of its stack. */
const deep: Where = (s, all) => all.some((t) => t.x === s.x && t.y === s.y && t.z > s.z);
/** The corners of the top layer: the place nearest each of its corners, the whole stack there if there is one. */
const corners: Where = (s, all) => {
  if (!top(s, all)) return false;
  const layer = all.filter((t) => top(t, all));
  const xs = layer.map((t) => t.x);
  const ys = layer.map((t) => t.y);
  const far = (t: Slot, x: number, y: number) => (t.x - x) ** 2 + (t.y - y) ** 2;
  const nearest = (x: number, y: number) => layer.reduce((a, b) => (far(b, x, y) < far(a, x, y) ? b : a));
  const box = [Math.min(...xs), Math.max(...xs)].flatMap((x) => [Math.min(...ys), Math.max(...ys)].map((y) => nearest(x, y)));
  return box.some((t) => t.x === s.x && t.y === s.y);
};
/** The middle column of the whole counter. */
const middle: Where = (s, all) => {
  const w = Math.max(...all.map((t) => t.x + 2));
  return Math.abs(s.x + 1 - w / 2) < 1.5;
};
const both =
  (...ws: Where[]): Where =>
  (s, all) =>
    ws.every((w) => w(s, all));

/** How the lane's deals are made: how often a new set is started while one is unfinished, and how often the way goes on under the last tile. */
export const DEAL_MIX = 0.5;
export const DEAL_DIG = 0.3;

interface Spec {
  shape: ShapeId;
  kinds: number;
  bags?: Where;
  /** Ribbon boxes, and the sets each waits for. */
  boxes?: readonly (readonly [Where, number])[];
  sprinkles?: Where;
}

const SPECS: readonly Spec[] = [
  // Bread Corner: take what is on top, and box up sets of three.
  { shape: 'SQUARE', kinds: 3 },
  { shape: 'CUSHION', kinds: 3 },
  { shape: 'BUN', kinds: 4 },
  { shape: 'BARS', kinds: 4 },
  { shape: 'PYRAMID', kinds: 4 },
  { shape: 'DIAMOND', kinds: 5 },
  { shape: 'RING', kinds: 5 },
  { shape: 'CROSS', kinds: 5 },
  { shape: 'TWIN', kinds: 6 },
  { shape: 'FLOWER', kinds: 5 },
  { shape: 'HOURGLASS', kinds: 6 },
  { shape: 'STEPS', kinds: 6 },

  // Croissant Café: higher counters and more kinds.
  { shape: 'HEART', kinds: 7 },
  { shape: 'STAIRS', kinds: 8 },
  { shape: 'BOWL', kinds: 7 },
  { shape: 'CAKE', kinds: 8 },
  { shape: 'BUTTERFLY', kinds: 7 },
  { shape: 'ARCH', kinds: 7 },
  { shape: 'WINDOW', kinds: 7 },
  { shape: 'ZIGZAG', kinds: 8 },
  { shape: 'ROUND', kinds: 8 },
  { shape: 'TOWER', kinds: 8 },
  { shape: 'PINWHEEL', kinds: 8 },
  { shape: 'BIG_PYRAMID', kinds: 8 },

  // The Cookie Jar: paper bags hide what is under the top.
  { shape: 'CUSHION', kinds: 6, bags: bottom },
  { shape: 'BUN', kinds: 8, bags: under },
  { shape: 'RING', kinds: 8, bags: bottom },
  { shape: 'HEART', kinds: 10, bags: both(bottom, checker) },
  { shape: 'STEPS', kinds: 10, bags: under },
  { shape: 'TWIN', kinds: 10, bags: bottom },
  { shape: 'CAKE', kinds: 10, bags: bottom },
  { shape: 'BUTTERFLY', kinds: 10, bags: under },
  { shape: 'WINDOW', kinds: 10, bags: both(under, checker) },
  { shape: 'ROUND', kinds: 10, bags: under },
  { shape: 'TERRACE', kinds: 10, bags: bottom },
  { shape: 'SLAB', kinds: 9, bags: bottom },

  // The Cupcake Parlour: stacks of tiles, the top one on show.
  { shape: 'COLUMNS', kinds: 9 },
  { shape: 'BLOOM', kinds: 8 },
  { shape: 'BRIDGE', kinds: 9 },
  { shape: 'CHIMNEYS', kinds: 11 },
  { shape: 'HIVE', kinds: 10 },
  { shape: 'BUTTERFLY', kinds: 11, bags: bottom },
  { shape: 'COLUMNS', kinds: 11, bags: deep },
  { shape: 'TOWER', kinds: 9 },
  { shape: 'CHIMNEYS', kinds: 11, bags: deep },
  { shape: 'BRIDGE', kinds: 9, bags: bottom },
  { shape: 'HIVE', kinds: 10, bags: bottom },
  { shape: 'GRAND', kinds: 11 },

  // The Pie Pantry: ribbon boxes open once enough sets are boxed up.
  { shape: 'BUN', kinds: 7, boxes: [[corners, 2]] },
  { shape: 'PYRAMID', kinds: 7, boxes: [[corners, 3]] },
  { shape: 'DIAMOND', kinds: 7, boxes: [[top, 2]] },
  { shape: 'CROSS', kinds: 11, boxes: [[corners, 3]] },
  { shape: 'HOURGLASS', kinds: 12, boxes: [[both(top, middle), 2]] },
  { shape: 'ARCH', kinds: 10, boxes: [[corners, 4]], bags: bottom },
  { shape: 'ZIGZAG', kinds: 12, boxes: [[corners, 3]] },
  { shape: 'PINWHEEL', kinds: 12, boxes: [[corners, 4]] },
  { shape: 'HEART', kinds: 12, boxes: [[corners, 3]], bags: bottom },
  { shape: 'TOWER', kinds: 7, boxes: [[corners, 5]] },
  { shape: 'TERRACE', kinds: 12, boxes: [[corners, 4]] },
  { shape: 'BIG_PYRAMID', kinds: 11, boxes: [[corners, 6]] },

  // The Donut Stand: sprinkled pastries, and more kinds.
  { shape: 'RING', kinds: 8, sprinkles: top },
  { shape: 'ROUND', kinds: 12, sprinkles: checker },
  { shape: 'BLOOM', kinds: 8, sprinkles: top, bags: bottom },
  { shape: 'STAIRS', kinds: 12, sprinkles: checker },
  { shape: 'WINDOW', kinds: 13, sprinkles: top, boxes: [[corners, 3]] },
  { shape: 'HIVE', kinds: 9, sprinkles: deep },
  { shape: 'CAKE', kinds: 13, sprinkles: top, bags: bottom },
  { shape: 'BRIDGE', kinds: 12, sprinkles: checker },
  { shape: 'SLAB', kinds: 13, sprinkles: top },
  { shape: 'CHIMNEYS', kinds: 13, sprinkles: deep, bags: bottom },
  { shape: 'PINWHEEL', kinds: 13, sprinkles: checker, boxes: [[corners, 3]] },
  { shape: 'GRAND', kinds: 13, sprinkles: top },

  // The Chocolate Shop: bags, stacks and boxes together.
  { shape: 'HEART', kinds: 13, bags: under, boxes: [[corners, 2]] },
  { shape: 'COLUMNS', kinds: 11, bags: deep, sprinkles: top },
  { shape: 'ARCH', kinds: 14, bags: bottom, boxes: [[corners, 3]] },
  { shape: 'BUTTERFLY', kinds: 14, bags: under, sprinkles: checker },
  { shape: 'TOWER', kinds: 8, bags: under, boxes: [[corners, 4]] },
  { shape: 'ZIGZAG', kinds: 12, bags: bottom, sprinkles: top },
  { shape: 'BRIDGE', kinds: 11, bags: deep, boxes: [[corners, 3]] },
  { shape: 'ROUND', kinds: 13, bags: under, sprinkles: checker },
  { shape: 'TERRACE', kinds: 14, bags: under, boxes: [[corners, 4]] },
  { shape: 'HIVE', kinds: 12, bags: deep, sprinkles: top },
  { shape: 'BIG_PYRAMID', kinds: 12, bags: under, boxes: [[corners, 5]] },
  { shape: 'GRAND', kinds: 14, bags: bottom, sprinkles: checker },

  // The Cake Hall: the biggest counters on the lane.
  { shape: 'SLAB', kinds: 13, bags: bottom, boxes: [[corners, 3]] },
  { shape: 'CAKE', kinds: 14, bags: under, sprinkles: top },
  { shape: 'CHIMNEYS', kinds: 14, bags: deep, boxes: [[corners, 4]] },
  { shape: 'WINDOW', kinds: 13, bags: under, sprinkles: checker },
  { shape: 'PINWHEEL', kinds: 14, bags: bottom, boxes: [[corners, 4]], sprinkles: top },
  { shape: 'STEPS', kinds: 9, bags: under, boxes: [[corners, 3]] },
  { shape: 'TERRACE', kinds: 14, bags: under, sprinkles: checker },
  { shape: 'HIVE', kinds: 11, bags: under, boxes: [[corners, 5]] },
  { shape: 'BRIDGE', kinds: 12, bags: under, sprinkles: top },
  { shape: 'TOWER', kinds: 8, bags: under, boxes: [[corners, 5]], sprinkles: checker },
  { shape: 'BIG_PYRAMID', kinds: 12, bags: under, sprinkles: checker },
  { shape: 'GRAND', kinds: 14, bags: under, boxes: [[corners, 6]], sprinkles: top },
];

function levelOf(spec: Spec): Level {
  const slots = fit(SHAPES[spec.shape]);
  for (const s of slots) if (s.x < 0 || s.y < 0 || s.x + 2 > COUNTER_W || s.y + 2 > COUNTER_H) throw new Error(`${spec.shape} does not fit the counter`);
  const lock = (s: Slot) => spec.boxes?.reduce((most, [where, n]) => (where(s, slots) ? Math.max(most, n) : most), 0) ?? 0;
  return {
    slots,
    kinds: spec.kinds,
    mix: DEAL_MIX,
    dig: DEAL_DIG,
    bags: slots.map((s) => spec.bags?.(s, slots) ?? false),
    locks: slots.map(lock),
    sprinkles: slots.map((s) => spec.sprinkles?.(s, slots) ?? false),
  };
}

const LANE: readonly Level[] = SPECS.map(levelOf);

export function zoneOf(level: number): ZoneId | null {
  return ZONES[Math.floor((level - 1) / LEVELS_PER_ZONE)] ?? null;
}

/** The levels of a shop, by number from 1. */
export function levelsOf(zone: ZoneId): number[] {
  const first = ZONES.indexOf(zone) * LEVELS_PER_ZONE + 1;
  return Array.from({ length: LEVELS_PER_ZONE }, (_, i) => first + i);
}

/** The most kinds a counter has: two of the sixteen pastries are always left out. */
export const MAX_KINDS = 14;

/** Level `n`, from 1: the lane's levels, then the late shift, which bakes the counters of the lane past its first shops again with a kind more each time round. */
export function levelAt(n: number): Level {
  const lane = LANE[n - 1];
  if (lane) return lane;
  const past = n - LANE_LEVELS - 1;
  const from = LEVELS_PER_ZONE * 2;
  const source = LANE[from + (past % (LANE_LEVELS - from))] ?? LANE[LANE_LEVELS - 1];
  if (!source) throw new Error('The lane has no levels');
  return { ...source, kinds: Math.min(MAX_KINDS, source.slots.length / 3, source.kinds + 1 + Math.floor(past / (LANE_LEVELS - from))) };
}

/** A kind fewer than its counter had on the lane: the daily special is a treat, not a wall. */
export const DAILY_FEWER_KINDS = 1;

/** The daily special: the same for everyone on a day, a counter of the lane past its first shop. */
export function dailyLevel(day: string): Level {
  const hash = hashString(`special:${day}`);
  const from = LEVELS_PER_ZONE;
  const source = LANE[from + (hash % (LANE_LEVELS - from))] ?? LANE[LANE_LEVELS - 1];
  if (!source) throw new Error('The lane has no levels');
  return { ...source, kinds: Math.max(3, source.kinds - DAILY_FEWER_KINDS) };
}

/** The seed of a try at a level: a new deal each try, and the same on every device for the same try. */
export function seedOf(key: string, attempt: number): number {
  return hashString(`${key}#${String(attempt)}`);
}
