/**
 * The meadow board: buds hanging in rows from a branch at the top, each row half a bud to the
 * side of the one above, like the cells of a honeycomb. Pip the bee shoots a ball of pollen
 * from below. It flies straight, bounces off the sides, and sticks where it first touches a bud
 * or reaches the branch. Three or more buds of one colour touching each other pop, and
 * whatever then hangs from nothing falls.
 *
 * Some buds hold a baby bee, freed when its bud pops or falls. Wax never pops in a match, only
 * falls. Honey keeps a bud out of matches until a pop beside it melts the honey. A dandelion
 * puff beside a pop bursts and pops everything around it. A butterfly changes the colour of its
 * bud after every shot.
 *
 * Everything here is a plain function of a board, so a shot plays out the same way from the
 * same save, and the rules can be tested without any screen. Distances are in bud widths.
 */

/** Buds across a row: the even rows hold this many, the odd rows, half a bud to the right, one fewer. */
export const COLS = 11;
/** Rows from the branch down; a bud in the last row has reached Pip, and the try is over. */
export const ROWS = 13;
export const LAST_ROW = ROWS - 1;
export const CELLS = ROWS * COLS;
/** Rows are this far apart: the buds of a row sit in the dips of the row above. */
export const ROW_H = Math.sqrt(3) / 2;
export const RADIUS = 0.5;

/** Where Pip shoots from: the middle, a little below the last row. */
export const SHOOTER = { x: COLS / 2, y: RADIUS + LAST_ROW * ROW_H + 1.45 } as const;
/** The whole board, Pip's place under it included. */
export const BOARD_HEIGHT = SHOOTER.y + 1.05;

/** The six colours, each with its own mark on the bud. */
export const COLOURS = ['rose', 'buttercup', 'clover', 'bluebell', 'violet', 'marigold'] as const;
export type Colour = (typeof COLOURS)[number];

export type BudKind = 'bud' | 'wax' | 'puff';

export interface Bud {
  /** Stays with the bud, so the screens can follow it. */
  readonly id: number;
  readonly kind: BudKind;
  /** 0 to 5 for a bud; -1 for wax and puffs, which have no colour. */
  readonly colour: number;
  /** A baby bee inside, freed when the bud pops or falls. */
  readonly bee: boolean;
  /** Honey on the bud: it joins no match until a pop beside it melts the honey. */
  readonly honey: boolean;
  /** A butterfly on the bud, which changes its colour after every shot. */
  readonly butterfly: boolean;
}

export interface Board {
  /** By cell, `row * COLS + col`; the last cell of an odd row is never used. */
  cells: (Bud | null)[];
  nextId: number;
}

/** What a level puts in a cell at the start; the colours of buds come from the try's seed. */
export interface Seed {
  readonly kind: BudKind;
  readonly bee: boolean;
  readonly honey: boolean;
  readonly butterfly: boolean;
}
export type Layout = readonly (Seed | null)[];

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const rowOf = (cell: number): number => Math.floor(cell / COLS);
export const colOf = (cell: number): number => cell % COLS;
export const cellAt = (row: number, col: number): number => row * COLS + col;
export const widthOf = (row: number): number => (row % 2 === 0 ? COLS : COLS - 1);

export function isCell(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < widthOf(row);
}

export function validCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < CELLS && isCell(rowOf(cell), colOf(cell));
}

/** Every cell a bud can be in, top row first. */
export const ALL_CELLS: readonly number[] = Array.from({ length: CELLS }, (_, cell) => cell).filter(validCell);

const CENTRES: readonly Point[] = Array.from({ length: CELLS }, (_, cell) => ({
  x: RADIUS + colOf(cell) + (rowOf(cell) % 2) * 0.5,
  y: RADIUS + rowOf(cell) * ROW_H,
}));

export function centreOf(cell: number): Point {
  return CENTRES[cell] ?? { x: 0, y: 0 };
}

function neighboursOf(cell: number): number[] {
  const row = rowOf(cell);
  const col = colOf(cell);
  // An odd row sits half a bud to the right, so its neighbours above and below are one column further on.
  const shift = row % 2;
  const out: [number, number][] = [
    [row, col - 1],
    [row, col + 1],
    [row - 1, col - 1 + shift],
    [row - 1, col + shift],
    [row + 1, col - 1 + shift],
    [row + 1, col + shift],
  ];
  return out.filter(([r, c]) => isCell(r, c)).map(([r, c]) => cellAt(r, c));
}

const NEIGHBOURS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, cell) => (validCell(cell) ? neighboursOf(cell) : []));

/** The cells touching a cell: two beside it, two above and two below, where the board has them. */
export function neighbours(cell: number): readonly number[] {
  return NEIGHBOURS[cell] ?? [];
}

/** The cells no more than `steps` cells away from a cell, itself included. */
export function within(cell: number, steps: number): number[] {
  const seen = new Set([cell]);
  let edge = [cell];
  for (let i = 0; i < steps; i++) {
    const next: number[] = [];
    for (const c of edge)
      for (const n of neighbours(c)) {
        if (seen.has(n)) continue;
        seen.add(n);
        next.push(n);
      }
    edge = next;
  }
  return [...seen];
}

export function makeBud(b: Board, kind: BudKind, colour: number, extra: Partial<Pick<Bud, 'bee' | 'honey' | 'butterfly'>> = {}): Bud {
  const bud: Bud = { id: b.nextId, kind, colour: kind === 'bud' ? colour : -1, bee: false, honey: false, butterfly: false, ...extra };
  b.nextId += 1;
  return bud;
}

export function copyBoard(b: Board): Board {
  return { cells: [...b.cells], nextId: b.nextId };
}

/** Whether a bud can be part of a match: a coloured bud with no honey on it. */
export const matchable = (bud: Bud | null): bud is Bud => bud !== null && bud.kind === 'bud' && !bud.honey;

/** No patch of one colour on a new board is bigger than this, so every pop takes a shot that adds to one. */
export const MAX_PATCH = 3;

/** The cells of the patch a bud of a colour in a cell would be in: the buds of that colour it would join, and itself. */
function patchCells(b: Board, cell: number, colour: number): number[] {
  const seen = new Set([cell]);
  const stack = [cell];
  while (stack.length > 0) {
    const c = stack.pop() ?? cell;
    for (const n of neighbours(c)) {
      const bud = b.cells[n];
      if (!seen.has(n) && bud?.kind === 'bud' && bud.colour === colour) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return [...seen];
}

const patchSize = (b: Board, cell: number, colour: number): number => patchCells(b, cell, colour).length;

/**
 * A new board from a level's layout. A bud often takes the colour of a bud above or beside it,
 * so colours come in small patches, as on a real hedge; otherwise, or where that patch would
 * grow too big, it takes a random colour that keeps every patch small.
 */
export function newBoard(layout: Layout, colours: number, random: () => number): Board {
  const b: Board = { cells: new Array<Bud | null>(CELLS).fill(null), nextId: 1 };
  for (const cell of ALL_CELLS) {
    const seed = layout[cell];
    if (!seed) continue;
    let colour = -1;
    if (seed.kind === 'bud') {
      const near = neighbours(cell).flatMap((n) => {
        const bud = n < cell ? b.cells[n] : null;
        return bud?.kind === 'bud' ? [bud.colour] : [];
      });
      const order = Array.from({ length: colours }, (_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j] ?? 0, order[i] ?? 0];
      }
      const liked = near.length > 0 && random() < 0.45 ? near[Math.floor(random() * near.length)] : undefined;
      const tries = liked === undefined ? order : [liked, ...order];
      colour = tries.find((c) => patchSize(b, cell, c) <= MAX_PATCH) ?? order[0] ?? 0;
    }
    b.cells[cell] = makeBud(b, seed.kind, colour, { bee: seed.bee, honey: seed.honey, butterfly: seed.butterfly });
  }
  evenOut(b, colours, random);
  return b;
}

/**
 * Recolours buds of a new board until no patch is too big, which the buds placed first can
 * leave with few colours, and every colour is on the board, so that each can be collected.
 */
function evenOut(b: Board, colours: number, random: () => number): void {
  const colourOf = (cell: number) => {
    const bud = b.cells[cell];
    return bud?.kind === 'bud' ? bud.colour : -1;
  };
  const recolour = (cell: number, colour: number) => {
    const bud = b.cells[cell];
    if (bud) b.cells[cell] = { ...bud, colour };
  };
  const others = (colour: number) => {
    const order = Array.from({ length: colours }, (_, i) => i).filter((c) => c !== colour);
    const start = Math.floor(random() * order.length);
    return [...order.slice(start), ...order.slice(0, start)];
  };
  for (let guard = 0; guard < CELLS; guard++) {
    const big = ALL_CELLS.find((cell) => colourOf(cell) >= 0 && patchSize(b, cell, colourOf(cell)) > MAX_PATCH);
    if (big === undefined) break;
    const fix = patchCells(b, big, colourOf(big)).flatMap((cell) => others(colourOf(cell)).map((colour) => ({ cell, colour })));
    const found = fix.find(({ cell, colour }) => patchSize(b, cell, colour) <= MAX_PATCH);
    if (!found) break;
    recolour(found.cell, found.colour);
  }
  for (let colour = 0; colour < colours; colour++) {
    const count = (c: number) => ALL_CELLS.filter((cell) => colourOf(cell) === c).length;
    if (count(colour) > 0) continue;
    const spots = ALL_CELLS.filter((cell) => colourOf(cell) >= 0 && count(colourOf(cell)) > 1 && patchSize(b, cell, colour) <= MAX_PATCH);
    const spot = spots[Math.floor(random() * spots.length)];
    if (spot !== undefined) recolour(spot, colour);
  }
}

/** The colours of the buds on the board, which are the colours Pip's pollen comes in. */
export function coloursOn(b: Board): number[] {
  const seen = new Set<number>();
  for (const bud of b.cells) if (bud?.kind === 'bud') seen.add(bud.colour);
  return [...seen].sort((p, q) => p - q);
}

export function budsIn(b: Board, row: number): number {
  let n = 0;
  for (let col = 0; col < widthOf(row); col++) if (b.cells[cellAt(row, col)]) n++;
  return n;
}

/** Whether a bud has reached the last row, where it touches Pip. */
export function reachedPip(b: Board): boolean {
  return budsIn(b, LAST_ROW) > 0;
}

// ---------------------------------------------------------------------------------------
// Shots

/** The aim, in degrees anticlockwise from straight right: a shot goes no flatter than this either way. */
export const MIN_ANGLE = 8;
export const MAX_ANGLE = 172;
/** A flying ball touches a bud this close, centre to centre: a little less than a bud's width, so a ball slips through a gap it nearly fits. */
export const TOUCH = 0.84;
/** Walls a shot may bounce off on its way. */
const MAX_BOUNCES = 16;

export function clampAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 90;
  return Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, angle));
}

/** The aim, in degrees, of a straight shot from Pip at a point. */
export function aimTo(p: Point): number {
  return (Math.atan2(SHOOTER.y - p.y, p.x - SHOOTER.x) * 180) / Math.PI;
}

/** The aim of a straight shot from Pip at the centre of a cell. */
export function aimAt(cell: number): number {
  return aimTo(centreOf(cell));
}

export interface Trace {
  /** Where the ball flies: from Pip, to each wall it bounces off, to where it stops. */
  points: Point[];
  /** The cell it sticks in; null when it cannot fly at all, with a bud already at Pip. */
  cell: number | null;
}

/** The nearest empty cell next to the bud that was hit, to where the ball touched it. */
function stickBeside(b: Board, hit: number, at: Point): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const n of neighbours(hit)) {
    if (b.cells[n]) continue;
    const c = centreOf(n);
    const distance = (c.x - at.x) ** 2 + (c.y - at.y) ** 2;
    if (distance < bestDistance) {
      best = n;
      bestDistance = distance;
    }
  }
  return best;
}

/** The nearest empty cell of the top row, for a ball that reached the branch. */
function stickToBranch(b: Board, x: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (let col = 0; col < COLS; col++) {
    if (b.cells[col]) continue;
    const distance = Math.abs(centreOf(col).x - x);
    if (distance < bestDistance) {
      best = col;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The flight of a ball shot at an angle: straight, bouncing off the sides, until it touches a
 * bud or reaches the branch. With `through`, it flies through every bud to the branch, as a
 * sunbeam does, and `cell` is null.
 */
export function trace(b: Board, angle: number, through = false): Trace {
  const rad = (clampAngle(angle) * Math.PI) / 180;
  let x: number = SHOOTER.x;
  let y: number = SHOOTER.y;
  let dx = Math.cos(rad);
  const dy = -Math.sin(rad);
  const points: Point[] = [{ x, y }];
  const occupied = through ? [] : ALL_CELLS.filter((cell) => b.cells[cell]);
  for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
    const tWall = dx > 1e-9 ? (COLS - RADIUS - x) / dx : dx < -1e-9 ? (RADIUS - x) / dx : Infinity;
    const tTop = (y - RADIUS) / -dy;
    let tHit = Infinity;
    let hit = -1;
    for (const cell of occupied) {
      const c = centreOf(cell);
      const fx = x - c.x;
      const fy = y - c.y;
      const near = fx * dx + fy * dy;
      const far = fx * fx + fy * fy - TOUCH * TOUCH;
      if (far <= 0) {
        // Already touching where it starts: only when a bud has come down to Pip.
        if (bounce === 0) return { points, cell: null };
        continue;
      }
      if (near >= 0) continue;
      const disc = near * near - far;
      if (disc < 0) continue;
      const t = -near - Math.sqrt(disc);
      if (t >= 0 && t < tHit) {
        tHit = t;
        hit = cell;
      }
    }
    const t = Math.min(tWall, tTop, tHit);
    x += dx * t;
    y += dy * t;
    points.push({ x, y });
    if (hit >= 0 && t === tHit) return { points, cell: stickBeside(b, hit, { x, y }) };
    if (t === tTop) return { points, cell: through ? null : stickToBranch(b, x) };
    dx = -dx;
  }
  return { points, cell: null };
}

/** How close a cell's centre must come to a sunbeam's path for the beam to pop its bud. */
const BEAM = 0.62;

function distanceToSegment(p: Point, a: Point, c: Point): number {
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const length = vx * vx + vy * vy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / length));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/** The cells a sunbeam shot at an angle passes over, on its way through every bud to the branch. */
export function beamCells(points: readonly Point[]): number[] {
  return ALL_CELLS.filter((cell) => {
    const c = centreOf(cell);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const e = points[i];
      if (a && e && distanceToSegment(c, a, e) <= BEAM) return true;
    }
    return false;
  });
}

// ---------------------------------------------------------------------------------------
// What a shot does

export interface Gone {
  readonly cell: number;
  readonly bud: Bud;
}

/** The buds of one colour that touch a bud and each other, its own cell included; none for a bud that cannot match. */
export function groupAt(b: Board, cell: number): number[] {
  const bud = b.cells[cell] ?? null;
  if (!matchable(bud)) return [];
  const seen = new Set([cell]);
  const stack = [cell];
  while (stack.length > 0) {
    const c = stack.pop() ?? cell;
    for (const n of neighbours(c)) {
      const other = b.cells[n] ?? null;
      if (!seen.has(n) && matchable(other) && other.colour === bud.colour) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return [...seen];
}

/** The colour a rainbow ball takes in a cell: the one that makes the biggest group there. */
export function rainbowColour(b: Board, cell: number): number {
  let best = -1;
  let bestSize = 0;
  for (const n of neighbours(cell)) {
    const bud = b.cells[n] ?? null;
    if (!matchable(bud) || bud.colour === best) continue;
    const trial = copyBoard(b);
    trial.cells[cell] = { id: 0, kind: 'bud', colour: bud.colour, bee: false, honey: false, butterfly: false };
    const size = groupAt(trial, cell).length;
    if (size > bestSize || (size === bestSize && bud.colour < best)) {
      best = bud.colour;
      bestSize = size;
    }
  }
  if (best >= 0) return best;
  // Beside nothing that matches: the colour of any bud beside it, or the first.
  for (const n of neighbours(cell)) {
    const bud = b.cells[n];
    if (bud?.kind === 'bud') return bud.colour;
  }
  return 0;
}

/**
 * Pops the buds in some cells. A dandelion puff beside any pop bursts and pops everything around
 * it, which can burst more puffs; honey beside a pop melts. The popped buds go into `popped`;
 * the cells whose honey melted come back.
 */
export function popCells(b: Board, cells: Iterable<number>, popped: Gone[]): number[] {
  const queue: number[] = [];
  const pop = (cell: number) => {
    const bud = b.cells[cell];
    if (!bud) return;
    b.cells[cell] = null;
    popped.push({ cell, bud });
    queue.push(cell);
  };
  for (const cell of cells) pop(cell);
  const sticky = new Set<number>();
  for (let i = 0; i < queue.length; i++) {
    for (const n of neighbours(queue[i] ?? 0)) {
      const bud = b.cells[n];
      if (!bud) continue;
      if (bud.kind === 'puff') {
        pop(n);
        for (const m of neighbours(n)) pop(m);
      } else if (bud.honey) sticky.add(n);
    }
  }
  const melted: number[] = [];
  for (const cell of sticky) {
    const bud = b.cells[cell];
    if (bud?.honey) {
      b.cells[cell] = { ...bud, honey: false };
      melted.push(cell);
    }
  }
  return melted.sort((p, q) => p - q);
}

/** The cells that hang from the branch, through buds touching each other up to the top row. */
export function heldCells(b: Board): Set<number> {
  const held = new Set<number>();
  const stack: number[] = [];
  for (let col = 0; col < COLS; col++)
    if (b.cells[col]) {
      held.add(col);
      stack.push(col);
    }
  while (stack.length > 0) {
    const c = stack.pop() ?? 0;
    for (const n of neighbours(c))
      if (b.cells[n] && !held.has(n)) {
        held.add(n);
        stack.push(n);
      }
  }
  return held;
}

/** Takes off every bud that hangs from nothing; they fall. */
export function dropLoose(b: Board): Gone[] {
  const held = heldCells(b);
  const dropped: Gone[] = [];
  for (const cell of ALL_CELLS) {
    const bud = b.cells[cell];
    if (bud && !held.has(cell)) {
      b.cells[cell] = null;
      dropped.push({ cell, bud });
    }
  }
  return dropped;
}

/** After a shot, each butterfly takes its bud to the next of the level's colours. */
export function moveButterflies(b: Board, colours: number): number[] {
  const moved: number[] = [];
  for (const cell of ALL_CELLS) {
    const bud = b.cells[cell];
    if (bud?.butterfly) {
      b.cells[cell] = { ...bud, colour: (bud.colour + 1) % colours };
      moved.push(cell);
    }
  }
  return moved;
}

/** The baby bees still on a board, and the buds left in its top row. */
export function census(b: Board): { bees: number; top: number } {
  let bees = 0;
  for (const bud of b.cells) if (bud?.bee) bees++;
  return { bees, top: budsIn(b, 0) };
}
