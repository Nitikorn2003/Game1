/**
 * The puzzle: jars of starlight. Each jar holds up to `capacity` units, listed from the bottom;
 * a unit is a colour from 0. Pouring moves the top run of one jar (its top unit and the units of
 * the same colour right under it) onto another jar that is empty or has that colour on top, as
 * much of it as fits. The puzzle is solved when every jar is empty or full of one colour.
 */

export type Jar = number[];

export interface Puzzle {
  jars: Jar[];
  capacity: number;
}

/** One pour: from jar, to jar, and how many units went. */
export type Move = readonly [from: number, to: number];

export function top(jar: readonly number[]): number | undefined {
  return jar[jar.length - 1];
}

/** How many units of the top colour sit together at the top of the jar. */
export function runLength(jar: readonly number[]): number {
  const colour = top(jar);
  if (colour === undefined) return 0;
  let n = 0;
  for (let i = jar.length - 1; i >= 0 && jar[i] === colour; i--) n++;
  return n;
}

/** Full of one colour. */
export function complete(jar: readonly number[], capacity: number): boolean {
  return jar.length === capacity && runLength(jar) === capacity;
}

/** How many units a pour from `from` into `to` would move: 0 when it is not allowed. */
export function pourAmount(p: Puzzle, from: number, to: number): number {
  if (from === to) return 0;
  const source = p.jars[from];
  const target = p.jars[to];
  if (!source || !target || source.length === 0) return 0;
  const room = p.capacity - target.length;
  if (room <= 0) return 0;
  const colour = top(source);
  if (target.length > 0 && top(target) !== colour) return 0;
  return Math.min(room, runLength(source));
}

export function canPour(p: Puzzle, from: number, to: number): boolean {
  return pourAmount(p, from, to) > 0;
}

/** Pours and returns how many units moved, 0 when the pour is not allowed. */
export function pour(p: Puzzle, from: number, to: number): number {
  const n = pourAmount(p, from, to);
  const source = p.jars[from];
  const target = p.jars[to];
  if (n === 0 || !source || !target) return 0;
  for (let i = 0; i < n; i++) target.push(source.pop() as number);
  return n;
}

/** Takes a pour back exactly: `n` units return from `to` to `from`. */
export function unpour(p: Puzzle, from: number, to: number, n: number): void {
  const source = p.jars[from];
  const target = p.jars[to];
  if (!source || !target) return;
  for (let i = 0; i < n && target.length > 0; i++) source.push(target.pop() as number);
}

export function solved(p: Puzzle): boolean {
  return p.jars.every((jar) => jar.length === 0 || complete(jar, p.capacity));
}

/** Every pour that is allowed now. */
export function moves(p: Puzzle): Move[] {
  const found: Move[] = [];
  for (let from = 0; from < p.jars.length; from++) {
    for (let to = 0; to < p.jars.length; to++) if (canPour(p, from, to)) found.push([from, to]);
  }
  return found;
}

/** No pour is allowed and the puzzle is not solved: only undo, restart or an extra jar help. */
export function stuck(p: Puzzle): boolean {
  return !solved(p) && moves(p).length === 0;
}

export function copy(p: Puzzle): Puzzle {
  return { jars: p.jars.map((jar) => [...jar]), capacity: p.capacity };
}

/** The same for two puzzles whose jars only stand in another order. */
export function key(p: Puzzle): string {
  return p.jars
    .map((jar) => jar.join(','))
    .sort()
    .join('|');
}

/** How many colours the puzzle has, each with exactly `capacity` units. */
export function colourCount(p: Puzzle): number {
  return new Set(p.jars.flat()).size;
}

/** Whether every colour has exactly `capacity` units and no jar overflows: a puzzle that can be solved at all. */
export function wellFormed(p: Puzzle): boolean {
  if (p.capacity < 2 || p.jars.some((jar) => jar.length > p.capacity)) return false;
  const counts = new Map<number, number>();
  for (const unit of p.jars.flat()) {
    if (!Number.isInteger(unit) || unit < 0) return false;
    counts.set(unit, (counts.get(unit) ?? 0) + 1);
  }
  return [...counts.values()].every((n) => n === p.capacity) && counts.size <= p.jars.length;
}

// ---------------------------------------------------------------------------------------
// Solving

export interface Solution {
  moves: Move[];
  /** Positions looked at, a measure of how hard the search was. */
  nodes: number;
}

/**
 * The pours worth trying from a position, best first. Leaves out pours that change nothing:
 * from a full jar of one colour, a jar of one colour into an empty jar, and into any empty jar
 * but the first. Unless `thorough`, it also leaves out a run that would only partly fit onto a
 * jar of mixed colours: that rarely helps, and leaving it out makes the search much faster,
 * but once in a while it is the only way.
 */
export function usefulMoves(p: Puzzle, thorough = false): Move[] {
  const firstEmpty = p.jars.findIndex((jar) => jar.length === 0);
  const scored: [Move, number][] = [];
  p.jars.forEach((source, from) => {
    if (source.length === 0 || complete(source, p.capacity)) return;
    const run = runLength(source);
    const single = run === source.length;
    p.jars.forEach((target, to) => {
      const n = pourAmount(p, from, to);
      if (n === 0) return;
      if (target.length === 0) {
        // Empty jars are all alike, and moving a jar of one colour into one changes nothing.
        if (to === firstEmpty && !single) scored.push([[from, to], 1]);
        return;
      }
      const targetSingle = runLength(target) === target.length;
      const all = n === run;
      // A run split onto a jar of mixed colours strands the rest of it.
      if (!all && !targetSingle && !thorough) return;
      const finishes = targetSingle && target.length + n === p.capacity;
      scored.push([[from, to], (finishes ? 8 : 0) + (targetSingle ? 4 : 2) + (all ? 2 : 0) + (single ? 1 : 0)]);
    });
  });
  return scored.sort((a, b) => b[1] - a[1]).map(([move]) => move);
}

/**
 * Finds a way to solve the puzzle, looking at no more than `budget` positions; null when there
 * is none, or none was found in time. Not always the shortest way. A `thorough` search tries
 * every pour that could matter, so when it ends within its budget and finds nothing, there is
 * no way at all.
 */
export function solve(start: Puzzle, budget = 20_000, thorough = false): Solution | null {
  const p = copy(start);
  const seen = new Set<string>([key(p)]);
  const path: Move[] = [];
  const amounts: number[] = [];
  let nodes = 0;
  const search = (): boolean => {
    if (solved(p)) return true;
    for (const [from, to] of usefulMoves(p, thorough)) {
      if (nodes >= budget) return false;
      const n = pour(p, from, to);
      const k = key(p);
      if (!seen.has(k)) {
        seen.add(k);
        nodes++;
        path.push([from, to]);
        amounts.push(n);
        if (search()) return true;
        path.pop();
        amounts.pop();
      }
      unpour(p, from, to, n);
    }
    return false;
  };
  return search() ? { moves: path, nodes } : null;
}
