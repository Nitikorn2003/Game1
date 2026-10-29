/**
 * The reef: eight zones of twelve levels, each zone bringing one new thing to the board, then
 * the open sea, which goes on for ever by revisiting the reef's boards, and a daily dive.
 *
 * Boards are drawn as text, one character a cell:
 *   .  a cell          -  a gap, which pieces fall straight through
 *   s  sand            S  two layers of sand
 *   r  a rock          R  a rock that takes two hits
 *   k  kelp on a piece K  kelp on a piece, on sand
 *
 * The moves of each level were tuned on the bot in sim/bot.ts (tuneMoves): with them, the bot
 * reaches the goals on about the share of tries that `test/balance.test.ts` expects of its zone.
 */
import { hashString } from '@game1/engine';
import { COLOURS, type Colour, type Layout } from './board.js';
import type { Goal, Level } from './dive.js';

export const ZONES = ['shallows', 'meadow', 'kelp', 'garden', 'beach', 'wreck', 'caves', 'lagoon'] as const;
export type ZoneId = (typeof ZONES)[number];
export const LEVELS_PER_ZONE = 12;
/** The levels of the reef; after these the open sea goes on. */
export const REEF_LEVELS = ZONES.length * LEVELS_PER_ZONE;

/** The creature that comes back to each zone once all its levels are reached. */
export const CREATURES: Readonly<Record<ZoneId, string>> = {
  shallows: 'crab',
  meadow: 'dugong',
  kelp: 'seahorse',
  garden: 'parrotfish',
  beach: 'turtle',
  wreck: 'octopus',
  caves: 'jellyfish',
  lagoon: 'whaleshark',
};
export type Creature = string;

export function parseLayout(rows: readonly string[]): Layout {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const open: boolean[] = [];
  const sand: number[] = [];
  const rock: number[] = [];
  const kelp: number[] = [];
  for (const row of rows) {
    if (row.length !== width) throw new Error(`Every row of a board must be ${String(width)} cells: "${row}"`);
    for (const ch of row) {
      if (!'.-sSrRkK'.includes(ch)) throw new Error(`Unknown cell "${ch}" in "${row}"`);
      open.push(ch !== '-');
      sand.push(ch === 's' || ch === 'K' ? 1 : ch === 'S' ? 2 : 0);
      rock.push(ch === 'r' ? 1 : ch === 'R' ? 2 : 0);
      kelp.push(ch === 'k' || ch === 'K' ? 1 : 0);
    }
  }
  return { width, height, open, sand, rock, kelp };
}

const colour = (name: Colour): number => COLOURS.indexOf(name);
const collect = (name: Colour, count: number): Goal => ({ kind: 'collect', colour: colour(name), count });
const SAND: Goal = { kind: 'sand' };
const ROCK: Goal = { kind: 'rock' };
const KELP: Goal = { kind: 'kelp' };
const turtles = (count: number): Goal => ({ kind: 'turtle', count });

interface Spec {
  board: readonly string[];
  colours: number;
  moves: number;
  goals: readonly Goal[];
  /** Turtles on the board at once; one unless said. */
  atOnce?: number;
}

const full = (width: number, height: number): string[] => Array.from({ length: height }, () => '.'.repeat(width));

const B = {
  lagoon: ['-.......-', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '-.......-'],
  diamond: ['---...---', '--.....--', '-.......-', '.........', '.........', '.........', '-.......-', '--.....--', '---...---'],
  heart: ['-...-...-', '.........', '.........', '.........', '-.......-', '--.....--', '---...---', '----.----'],
  ring: ['.........', '.........', '.........', '...---...', '...---...', '...---...', '.........', '.........', '.........'],
  cross: ['---...---', '---...---', '---...---', '.........', '.........', '.........', '---...---', '---...---', '---...---'],
  hourglass: ['.........', '.........', '-.......-', '--.....--', '---...---', '--.....--', '-.......-', '.........', '.........'],
  windows: ['.........', '.--...--.', '.--...--.', '.........', '.........', '.........', '.--...--.', '.--...--.', '.........'],
  arch: ['.........', '.........', '.........', '.........', '.........', '...---...', '...---...', '...---...'],
  boat: ['....-....', '....-....', '....-....', '.........', '.........', '.........', '-.......-', '--.....--'],
  cave: ['.........', '..-...-..', '.........', '.-..-..-.', '.........', '..-...-..', '.........', '.-..-..-.', '.........'],
  lantern: ['---...---', '--.....--', '-.......-', '-.......-', '-.......-', '-.......-', '-.......-', '--.....--', '---...---'],
  split: ['....-....', '....-....', '....-....', '....-....', '.........', '....-....', '....-....', '....-....', '....-....'],
} as const;

/** The reef's levels, zone by zone. */
const SPECS: readonly Spec[] = [
  // Sunlit Shallows: matches and special pieces.
  { board: full(7, 7), colours: 4, moves: 12, goals: [collect('star', 30)] },
  { board: full(8, 8), colours: 4, moves: 12, goals: [collect('shell', 35)] },
  { board: B.lagoon, colours: 4, moves: 10, goals: [collect('coral', 45), collect('glass', 45)] },
  { board: B.diamond, colours: 5, moves: 16, goals: [collect('bubble', 25)] },
  { board: B.heart, colours: 5, moves: 15, goals: [collect('coral', 20)] },
  { board: B.ring, colours: 5, moves: 18, goals: [collect('star', 20), collect('shell', 20)] },
  { board: B.cross, colours: 5, moves: 18, goals: [collect('glass', 20)] },
  { board: B.hourglass, colours: 5, moves: 17, goals: [collect('bubble', 22), collect('coral', 22)] },
  { board: B.windows, colours: 5, moves: 20, goals: [collect('star', 25)] },
  { board: B.arch, colours: 5, moves: 22, goals: [collect('shell', 24), collect('coral', 24)] },
  { board: B.boat, colours: 5, moves: 21, goals: [collect('glass', 26), collect('star', 26)] },
  { board: full(9, 9), colours: 5, moves: 20, goals: [collect('coral', 40), collect('bubble', 40)] },

  // Seagrass Meadow: sand.
  { board: ['........', '........', '........', 'ssssssss', 'ssssssss', '........', '........', '........'], colours: 5, moves: 18, goals: [SAND] },
  { board: ['-.......-', '.........', '...sss...', '..sssss..', '.sssssss.', '..sssss..', '...sss...', '.........', '-.......-'], colours: 5, moves: 16, goals: [SAND] },
  { board: ['---...---', '--.....--', '-..sss..-', '..sssss..', '.sssssss.', '..sssss..', '-..sss..-', '--.....--', '---...---'], colours: 5, moves: 15, goals: [SAND, collect('glass', 15)] },
  { board: ['.........', 'sssssssss', '.........', 'sssssssss', '.........', 'sssssssss', '.........', 'sssssssss'], colours: 5, moves: 28, goals: [SAND] },
  { board: ['s.s.s.s.', '.s.s.s.s', 's.s.s.s.', '.s.s.s.s', 's.s.s.s.', '.s.s.s.s', 's.s.s.s.', '.s.s.s.s'], colours: 5, moves: 25, goals: [SAND] },
  { board: ['.........', '.sssssss.', '.s.....s.', '.s.---.s.', '.s.---.s.', '.s.---.s.', '.s.....s.', '.sssssss.', '.........'], colours: 5, moves: 24, goals: [SAND] },
  { board: ['-...-...-', '.........', '.........', 'sssssssss', '-sssssss-', '--sssss--', '---sss---', '----s----'], colours: 5, moves: 33, goals: [SAND, collect('star', 15)] },
  { board: ['.........', '.........', 'sssssssss', 'sssssssss', 'sssssssss', 'sssssssss', 'sssssssss', 'sssssssss', 'sssssssss'], colours: 5, moves: 30, goals: [SAND] },
  { board: ['.........', '.........', '..sssss..', '..sSSSs..', '..sSSSs..', '..sSSSs..', '..sssss..', '.........', '.........'], colours: 5, moves: 19, goals: [SAND, collect('coral', 30)] },
  { board: ['---sss---', '---sss---', '---sss---', 'sssssssss', 'sss...sss', 'sssssssss', '---sss---', '---sss---', '---sss---'], colours: 5, moves: 37, goals: [SAND] },
  { board: ['.........', '.--sss--.', '.--sss--.', 'sssssssss', '.........', 'sssssssss', '.--sss--.', '.--sss--.', '.........'], colours: 5, moves: 26, goals: [SAND] },
  { board: ['.........', '.........', '.........', '.........', '.........', 'SSSSSSSSS', 'SSSSSSSSS', 'SSSSSSSSS', 'SSSSSSSSS'], colours: 5, moves: 36, goals: [SAND, collect('coral', 20)] },

  // Kelp Forest: kelp holds pieces in place until a match or a blast cuts it.
  { board: ['........', '........', '........', '........', '........', '........', '........', '..kkkk..'], colours: 5, moves: 22, goals: [KELP] },
  { board: ['.........', '.........', '.........', '.........', '..k...k..', '..k...k..', '..k...k..', '..k...k..', '..k...k..'], colours: 5, moves: 22, goals: [KELP] },
  { board: ['.........', '.........', '.........', '.........', 'k.k.k.k.k', '.........', '.........', '.........', '.........'], colours: 5, moves: 18, goals: [KELP, collect('glass', 30)] },
  { board: ['.........', '.........', '.........', '.........', '.........', 'sssssssss', 'sKsKsKsKs', 'sssssssss', '.........'], colours: 5, moves: 23, goals: [SAND, KELP] },
  { board: ['k........', '.k.......', '..k......', '...k.....', '....k....', '.....k...', '......k..', '.......k.', '........k'], colours: 5, moves: 20, goals: [KELP] },
  { board: ['........', 'k......k', 'k......k', 'k......k', 'k......k', 'k......k', 'k......k', 'kkkkkkkk'], colours: 5, moves: 34, goals: [KELP] },
  { board: ['.........', '.k.....k.', '..k...k..', '...k.k...', '....k....', '...k.k...', '..k...k..', '.k.....k.', '.........'], colours: 5, moves: 19, goals: [KELP] },
  { board: ['-.......-', '.........', '.........', '..kk.kk..', '..kk.kk..', '.........', '.........', '.........', '-.......-'], colours: 5, moves: 18, goals: [KELP, collect('shell', 35)] },
  { board: ['.........', '.........', '.kk...kk.', '.kk...kk.', '.........', '...kkk...', '...kkk...', '.........', '.........'], colours: 5, moves: 23, goals: [KELP, collect('coral', 20)] },
  { board: ['.........', '.........', '.........', 'KK.....KK', 'sKK...KKs', 'ssKK.KKss', 'sssKKKsss', 'sssssssss', '.........'], colours: 5, moves: 33, goals: [SAND, KELP] },
  { board: ['.........', '.........', '.k.k.k.k.', 'k.k.k.k.k', '.k.k.k.k.', 'k.k.k.k.k', '.k.k.k.k.', '.........', '.........'], colours: 5, moves: 24, goals: [KELP] },
  { board: ['.........', '.........', '..k...k..', '..K...K..', '.sKs.sKs.', '.sKs.sKs.', 'sssssssss', '.........', '.........'], colours: 5, moves: 21, goals: [SAND, KELP, collect('glass', 30)] },

  // Coral Garden: rocks, broken by matches beside them and by blasts.
  { board: ['........', '........', '........', '........', '........', '........', '.rrrrrr.', 'rrrrrrrr'], colours: 5, moves: 23, goals: [ROCK] },
  { board: ['.........', '.........', '..R...R..', '.........', '....R....', '.........', '..R...R..', '.........', '.........'], colours: 5, moves: 15, goals: [ROCK, collect('coral', 30)] },
  { board: ['.........', '.........', '..RRRRR..', '..R...R..', '..R...R..', '..R...R..', '..RRRRR..', '.........', '.........'], colours: 5, moves: 18, goals: [ROCK] },
  { board: ['.........', '.........', '.........', '...RRR...', '...RRR...', '...RRR...', '.........', '.........', '.........'], colours: 5, moves: 16, goals: [ROCK, collect('glass', 25)] },
  { board: ['.........', '.........', '.........', '.........', '.R.R.R.R.', '.R.R.R.R.', '.........', '.........', '.........'], colours: 5, moves: 14, goals: [ROCK, collect('shell', 20)] },
  { board: ['-.......-', '.........', '.........', '.........', 'R.R.R.R.R', '.........', '.........', '.........', '-.......-'], colours: 5, moves: 16, goals: [ROCK, collect('star', 35)] },
  { board: ['.........', '.........', '.........', '..R...R..', '.sRs.sRs.', '.sss.sss.', '.........', '.........', '.........'], colours: 5, moves: 13, goals: [ROCK, SAND, collect('coral', 25)] },
  { board: ['rr.....rr', 'r.......r', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], colours: 5, moves: 17, goals: [ROCK, collect('bubble', 40)] },
  { board: ['.........', '.........', '.R.R.R.R.', '.........', '.R.R.R.R.', '.........', '.R.R.R.R.', '.........', '.........'], colours: 5, moves: 13, goals: [ROCK, collect('bubble', 20)] },
  { board: ['.........', '.........', '.........', 'RR.....RR', '.........', '.........', '.........', 'RR.....RR', '.........'], colours: 5, moves: 25, goals: [ROCK] },
  { board: ['.........', '.........', '..R...R..', '..k...k..', '..k...k..', '..R...R..', '.........', '.........', '.........'], colours: 5, moves: 15, goals: [ROCK, KELP, collect('star', 30)] },
  { board: ['.........', '.........', '.........', '.R.....R.', 'sssRRRsss', 'sssssssss', 'sssssssss', '.........', '.........'], colours: 5, moves: 18, goals: [ROCK, SAND, collect('glass', 30)] },

  // Turtle Beach: baby turtles to bring down to the bottom of the board.
  { board: full(8, 8), colours: 5, moves: 19, goals: [turtles(2)] },
  { board: B.lagoon, colours: 5, moves: 25, goals: [turtles(2), collect('star', 15)] },
  { board: full(8, 8), colours: 5, moves: 21, goals: [turtles(2), collect('shell', 15)] },
  { board: ['.........', '.........', '.........', '.........', '.........', '.........', 'sssssssss', '.........', '.........'], colours: 5, moves: 31, goals: [turtles(3), SAND] },
  { board: B.ring, colours: 5, moves: 25, goals: [turtles(3)] },
  { board: full(9, 9), colours: 5, moves: 31, goals: [turtles(4)], atOnce: 2 },
  { board: ['.........', '.........', '.........', '..r...r..', '.........', '....r....', '.........', '.r.....r.', '.........'], colours: 5, moves: 31, goals: [turtles(3), ROCK] },
  { board: ['.........', '.........', '.........', '.........', '.........', '.........', '.........', '...kkk...', '.........'], colours: 5, moves: 24, goals: [turtles(2), KELP] },
  { board: B.cross, colours: 5, moves: 21, goals: [turtles(3)] },
  { board: B.hourglass, colours: 5, moves: 21, goals: [turtles(3)] },
  { board: B.lagoon, colours: 5, moves: 26, goals: [turtles(4)], atOnce: 2 },
  { board: ['.........', '.........', '.........', 'r.......r', '.r.....r.', 'sssssssss', 'sssssssss', '.........', '.........'], colours: 5, moves: 31, goals: [turtles(4), SAND, ROCK], atOnce: 2 },

  // Old Shipwreck: two layers of sand and rocks that take two hits.
  { board: ['....-....', '....-....', '....-....', '.........', '.........', 'SSSSSSSSS', '-SSSSSSS-', '--SSSSS--'], colours: 5, moves: 33, goals: [SAND] },
  { board: ['.........', '.........', '.R.R.R.R.', '.........', '.R.R.R.R.', '-.......-', '--.....--'], colours: 5, moves: 20, goals: [ROCK, collect('glass', 35)] },
  { board: ['.........', '.........', '..R...R..', '.SSS.SSS.', '.SSS.SSS.', '.........', '.........', '.........', '.........'], colours: 5, moves: 16, goals: [SAND, ROCK, collect('star', 30)] },
  { board: ['.........', '.........', '.........', 'k.......k', 'sk.....ks', 'ssk...kss', 'sssk.ksss', 'ssssSssss'], colours: 5, moves: 22, goals: [SAND, KELP] },
  { board: ['.........', '.........', '.........', '.R.....R.', '...R.R...', '.........', '.R.....R.', '.........', '.........'], colours: 5, moves: 33, goals: [turtles(3), ROCK] },
  { board: ['.........', '....S....', '...SSS...', '..SSSSS..', '.SSSSSSS.', '..SSSSS..', '...SSS...', '....S....', '.........'], colours: 5, moves: 18, goals: [SAND, collect('bubble', 30)] },
  { board: ['....-....', '...---...', '.........', '.........', '.........', '.........', '.........', '-.......-', '--.....--'], colours: 5, moves: 19, goals: [collect('coral', 40), collect('star', 40)] },
  { board: ['.........', '.........', 'RR.....RR', '.........', '...RRR...', '.........', 'RR.....RR', '.........', '.........'], colours: 5, moves: 19, goals: [ROCK, collect('shell', 20)] },
  { board: ['.........', '.........', '.........', '..RRRRR..', '..RSSSR..', '..RSSSR..', '..RRRRR..', '.........', '.........'], colours: 5, moves: 17, goals: [ROCK, SAND] },
  { board: ['.........', '.........', '.........', '..k...k..', '..K...K..', 'ssKsssKss', 'sssssssss', '.........', '.........'], colours: 5, moves: 27, goals: [turtles(2), SAND, KELP] },
  { board: ['.........', '.........', '.........', 'R.R.R.R.R', '.........', '-.......-', '--.....--'], colours: 5, moves: 19, goals: [ROCK, collect('shell', 35)] },
  { board: ['....-....', '....-....', '.........', '.R.....R.', 'SSSRRRSSS', 'SSSSSSSSS', '-SSSSSSS-', '--SSSSS--'], colours: 5, moves: 31, goals: [SAND, ROCK, collect('coral', 20)] },

  // Lantern Caves: gaps in the board, and all six colours.
  { board: B.cave, colours: 6, moves: 27, goals: [collect('urchin', 20), collect('glass', 20)] },
  { board: ['.........', '..-...-..', '.........', '.-..-..-.', 'sssssssss', '..-...-..', 'sssssssss', '.-..-..-.', '.........'], colours: 6, moves: 39, goals: [SAND] },
  { board: ['.-.....-.', '.-.....-.', '.-.....-.', '.........', '.........', '.........', '.-.....-.', '.-.....-.', '.-.....-.'], colours: 6, moves: 24, goals: [collect('bubble', 25), collect('star', 25)] },
  { board: ['.........', '..-...-..', '.........', '.-.k-k.-.', '...k.k...', '..-k.k-..', '.........', '.-..-..-.', '.........'], colours: 6, moves: 27, goals: [KELP] },
  { board: ['.........', '..-...-..', '..R...R..', '.-..-..-.', '...RRR...', '..-...-..', '.........', '.-..-..-.', '.........'], colours: 6, moves: 28, goals: [ROCK, collect('coral', 20)] },
  { board: B.cave, colours: 6, moves: 20, goals: [turtles(3)] },
  { board: B.lantern, colours: 6, moves: 25, goals: [collect('coral', 25), collect('urchin', 25)] },
  { board: ['.........', '..-...-..', '.........', '.-..-..-.', 'SSSSSSSSS', '..-...-..', '.........', '.-..-..-.', '.........'], colours: 6, moves: 35, goals: [SAND] },
  { board: B.split, colours: 6, moves: 28, goals: [collect('shell', 25), collect('glass', 25)] },
  { board: ['.........', '..-...-..', '.........', '.-.R-R.-.', 'sssssssss', '..-sss-..', 'sssssssss', '.-..-..-.', '.........'], colours: 6, moves: 34, goals: [SAND, ROCK] },
  { board: ['.........', '.........', '..-...-..', '.r.....r.', '...-.-...', '.........', '..r...r..', '.........', '.........'], colours: 6, moves: 27, goals: [turtles(3), ROCK] },
  { board: ['---...---', '--.....--', '-k.....k-', '-k.....k-', '-sssssss-', '-sssssss-', '-sssssss-', '--.....--', '---...---'], colours: 6, moves: 29, goals: [SAND, KELP, collect('star', 20)] },

  // Pearl Lagoon: everything the reef has.
  { board: full(9, 9), colours: 6, moves: 26, goals: [collect('coral', 30), collect('shell', 30), collect('urchin', 30)] },
  { board: ['.........', '.........', '.........', 'sssssssss', 'sSSSSSSSs', 'sSSSSSSSs', 'sssssssss', '.........', '.........'], colours: 6, moves: 33, goals: [SAND] },
  { board: ['.........', '.........', '.k.k.k.k.', '.........', '.R.R.R.R.', '.........', '.k.k.k.k.', '.........', '.........'], colours: 6, moves: 25, goals: [KELP, ROCK] },
  { board: B.lagoon, colours: 6, moves: 27, goals: [turtles(3), collect('bubble', 20)], atOnce: 2 },
  { board: ['.........', '.........', '.........', 'RRR...RRR', 'SSS...SSS', 'sssssssss', 'sssssssss', '.........', '.........'], colours: 6, moves: 34, goals: [SAND, ROCK] },
  { board: B.diamond, colours: 6, moves: 29, goals: [collect('glass', 30), collect('star', 30)] },
  { board: ['.........', '.........', '..k...k..', '.sKs.sKs.', '.sKs.sKs.', '.sss.sss.', '..r...r..', '.........', '.........'], colours: 6, moves: 21, goals: [SAND, KELP, ROCK] },
  { board: ['.........', '.........', '.........', '.r.....r.', '...r.r...', 'sssssssss', 'sssssssss', '.........', '.........'], colours: 6, moves: 30, goals: [turtles(3), SAND, ROCK], atOnce: 2 },
  { board: B.windows, colours: 6, moves: 32, goals: [collect('coral', 30), collect('urchin', 30)] },
  { board: ['.........', '.........', '..RRRRR..', '..RSSSR..', '..RSSSR..', '..RSSSR..', '..RRRRR..', '.........', '.........'], colours: 6, moves: 26, goals: [ROCK, SAND] },
  { board: ['.........', '.........', '.k.....k.', '.K.....K.', 'sKsssssKs', 'sssssssss', '.........', '.........', '.........'], colours: 6, moves: 29, goals: [SAND, KELP, collect('shell', 25)] },
  { board: ['.........', '.........', '.........', '.R.....R.', 'sssRRRsss', 'sssssssss', 'sssssssss', 'sssssssss', '.........'], colours: 6, moves: 37, goals: [turtles(3), SAND, ROCK], atOnce: 2 },
];

function levelOf(spec: Spec): Level {
  return { layout: parseLayout(spec.board), colours: spec.colours, moves: spec.moves, goals: spec.goals, turtlesAtOnce: spec.atOnce ?? 1 };
}

const REEF: readonly Level[] = SPECS.map(levelOf);

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

/** Level `n`, from 1: the reef's levels, then the open sea, which revisits the boards of the reef past its first zones. */
export function levelAt(n: number): Level {
  const reef = REEF[n - 1];
  if (reef) return reef;
  const past = n - REEF_LEVELS - 1;
  const from = LEVELS_PER_ZONE * 2;
  const source = REEF[from + (past % (REEF_LEVELS - from))] ?? REEF[REEF_LEVELS - 1];
  if (!source) throw new Error('The reef has no levels');
  return recoloured(source, 1 + Math.floor(past / (REEF_LEVELS - from)));
}

/** Two more moves than its board had in the reef: the daily dive is a treat, not a wall. */
export const DAILY_EXTRA_MOVES = 2;

/** The daily dive: the same for everyone on a day, a reef board past the first zone in new colours. */
export function dailyLevel(day: string): Level {
  const hash = hashString(`dive:${day}`);
  const from = LEVELS_PER_ZONE;
  const source = REEF[from + (hash % (REEF_LEVELS - from))] ?? REEF[REEF_LEVELS - 1];
  if (!source) throw new Error('The reef has no levels');
  const level = recoloured(source, 1 + ((hash >>> 8) % 5));
  return { ...level, moves: level.moves + DAILY_EXTRA_MOVES };
}

/** The seed of a try at a level: a new board each try, and the same board on every device for the same try. */
export function seedOf(key: string, attempt: number): number {
  return hashString(`${key}#${String(attempt)}`);
}
