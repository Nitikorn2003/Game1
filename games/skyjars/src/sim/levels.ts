import { Rng, hashString } from '@game1/engine';
import { complete, solve, type Jar, type Puzzle } from './jars.js';

/** How a level is made: its colours, how much a jar holds, and the empty jars it starts with. */
export interface LevelSpec {
  colours: number;
  capacity: number;
  empty: number;
}

/** A puzzle ready to play, and the length of a known way to solve it. */
export interface Made {
  puzzle: Puzzle;
  par: number;
}

/** Starlight comes in this many colours, each with its own symbol so no one needs to tell them apart by colour. */
export const MAX_COLOURS = 10;
export const CAPACITY = 4;
export const TALL_CAPACITY = 5;

/**
 * Level 1 teaches pouring: three pours solve it. From level 2 a colour joins every five levels,
 * so the first ones go quickly, up to ten from level 37. From level 30 every fifth level is a
 * breather with two colours fewer, and from 36 every sixth has tall jars that hold five.
 */
export function specOf(level: number): LevelSpec {
  if (level <= 1) return { colours: 2, capacity: CAPACITY, empty: 1 };
  const colours = Math.min(MAX_COLOURS, 3 + Math.floor((level - 2) / 5));
  if (level >= 36 && level % 6 === 0) return { colours: colours - 2, capacity: TALL_CAPACITY, empty: 2 };
  if (level >= 30 && level % 5 === 0) return { colours: colours - 2, capacity: CAPACITY, empty: 2 };
  return { colours, capacity: CAPACITY, empty: 2 };
}

/** The daily sky: seven to nine colours, the same for everyone on a day. */
export function dailySpec(day: string): LevelSpec {
  return { colours: 7 + (hashString(`skyjars:daily-size:${day}`) % 3), capacity: CAPACITY, empty: 2 };
}

const TUTORIAL: readonly Jar[] = [[0, 0, 0, 1], [1, 1, 1, 0], []];

/** Units of the same colour lying on each other: the fewer, the more mixed the jars. */
function pairs(jars: readonly Jar[]): number {
  let n = 0;
  for (const jar of jars) for (let i = 1; i < jar.length; i++) if (jar[i] === jar[i - 1]) n++;
  return n;
}

function deal(rng: Rng, spec: LevelSpec): Puzzle {
  const units: number[] = [];
  for (let c = 0; c < spec.colours; c++) for (let i = 0; i < spec.capacity; i++) units.push(c);
  for (let i = units.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [units[i], units[j]] = [units[j] as number, units[i] as number];
  }
  const jars: Jar[] = [];
  for (let j = 0; j < spec.colours; j++) jars.push(units.slice(j * spec.capacity, (j + 1) * spec.capacity));
  for (let e = 0; e < spec.empty; e++) jars.push([]);
  return { jars, capacity: spec.capacity };
}

/**
 * Deals jars from a seed until a deal is mixed enough and can be solved, so every level is
 * fair and every player gets the same one. A deal no search can solve is never handed out.
 */
export function make(seed: number, spec: LevelSpec): Made {
  const rng = new Rng(seed);
  // At most a fifth of the units may already lie on their own colour.
  const maxPairs = Math.floor((spec.colours * spec.capacity) / 5);
  for (let attempt = 0; attempt < 200; attempt++) {
    // Deals that keep failing get an empty jar more, and then another.
    const empty = spec.empty + (attempt < 60 ? 0 : attempt < 120 ? 1 : 2);
    const puzzle = deal(rng, { ...spec, empty });
    if (puzzle.jars.some((jar) => complete(jar, spec.capacity))) continue;
    if (attempt < 30 && pairs(puzzle.jars) > maxPairs) continue;
    const solution = solve(puzzle);
    if (solution) return { puzzle, par: solution.moves.length };
  }
  throw new Error(`No puzzle could be made from seed ${String(seed)}.`);
}

export function makeLevel(level: number): Made {
  if (level <= 1) {
    const puzzle = { jars: TUTORIAL.map((jar) => [...jar]), capacity: CAPACITY };
    return { puzzle, par: 3 };
  }
  return make(hashString(`skyjars:level:${String(level)}`), specOf(level));
}

export function makeDaily(day: string): Made {
  return make(hashString(`skyjars:daily:${day}`), dailySpec(day));
}
