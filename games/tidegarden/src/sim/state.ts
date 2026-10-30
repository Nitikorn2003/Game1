import { bool, dayKeyOf, int, isRecord, list, num, oneOf, recordOf, type Data, type SaveFormat } from '@game1/engine';
import {
  createAdLedger,
  createSettings,
  createShop,
  restoreAdLedger,
  restoreSettings,
  restoreShop,
  type AdLedger,
  type ShellSettings,
  type ShopRecord,
} from '@game1/shell';
import { BOMB, COLOURS, KINDS, NONE, TURTLE, isColour, type Board, type Piece, type Special } from './board.js';
import {
  AD_PLACEMENTS,
  BUDDIES,
  ENTITLEMENTS,
  MAX_TOOLS,
  MODES,
  START_TOOLS,
  TIPS,
  TOOLS,
  WATERS,
  type AdPlacement,
  type Buddy,
  type Entitlement,
  type LookId,
  type Mode,
  type TipId,
  type Tool,
  type Water,
} from './content.js';
import { MORE_MOVES, isWon, type Dive, type Level } from './dive.js';
import { ZONES, dailyLevel, levelAt, type ZoneId } from './levels.js';

export type { AdPlacement, Entitlement } from './content.js';

/** Which level a dive is a try at: a level of the reef or the sea by its number, or a day's daily dive. */
export interface DiveKey {
  mode: Mode;
  /** The level, from 1, of a reef dive; 0 for a daily dive. */
  level: number;
  /** The day of a daily dive; null for a reef dive. */
  day: string | null;
}

/** The dive in progress: there is one at a time. */
export interface Current extends DiveKey {
  dive: Dive;
}

/** The last dive that ended, shown until the next one starts. */
export interface DiveResult extends DiveKey {
  won: boolean;
  /** Stars for a dive that reached its goals, 0 for one given up. */
  stars: number;
  /** The stars the level had before, for a level reached again. */
  before: number;
  movesLeft: number;
  /** What the dive paid, which a rewarded ad can double once. */
  pay: number;
  doubled: boolean;
  /** The zone this level was the last of, reached for the first time, and what that paid on top; never doubled. */
  zone: ZoneId | null;
  zoneCoins: number;
  /** The daily streak after a daily dive. */
  streak: number;
}

export interface GameState {
  createdAt: number;
  coins: number;
  /** The stars of each level reached, 1 to 3, from level 1. The level after the last one reached is open. */
  stars: number[];
  current: Current | null;
  daily: {
    /** Tries at the daily dive on `day`, which give each try its board. */
    day: string | null;
    tries: number;
    lastDone: string | null;
    streak: number;
    bestStreak: number;
  };
  result: DiveResult | null;
  tools: Record<Tool, number>;
  looks: { water: Water; buddy: Buddy; bought: LookId[] };
  /** The notes on what is new that have been shown. */
  tips: TipId[];
  stats: {
    /** Dives started, which give each try at a level its board. */
    dives: number;
    /** Dives that reached their goals, the daily dive's too. */
    won: number;
    dailies: number;
    moves: number;
    /** Pieces cleared. */
    cleared: number;
    turtles: number;
    continues: number;
    toolsUsed: number;
    playSeconds: number;
  };
  ads: AdLedger<AdPlacement>;
  shop: ShopRecord<Entitlement>;
  settings: ShellSettings;
}

export const SAVE_VERSION = 1;
/** More levels than anyone will reach, which keeps a damaged save small. */
const MAX_LEVELS = 100_000;

export function createState(now: number): GameState {
  return {
    createdAt: now,
    coins: 0,
    stars: [],
    current: null,
    daily: { day: null, tries: 0, lastDone: null, streak: 0, bestStreak: 0 },
    result: null,
    tools: { ...START_TOOLS },
    looks: { water: 'sunlit', buddy: 'clownfish', bought: [] },
    tips: [],
    stats: { dives: 0, won: 0, dailies: 0, moves: 0, cleared: 0, turtles: 0, continues: 0, toolsUsed: 0, playSeconds: 0 },
    ads: createAdLedger(AD_PLACEMENTS),
    shop: createShop(),
    settings: createSettings(),
  };
}

/** The level a dive is a try at. */
export function levelOf(key: DiveKey): Level {
  return key.mode === 'daily' && key.day !== null ? dailyLevel(key.day) : levelAt(Math.max(1, key.level));
}

function restoreKey(data: Data, reached: number): DiveKey | null {
  const mode = oneOf(data.mode, MODES, 'reef');
  if (mode === 'daily') {
    const day = dayKeyOf(data.day);
    return day === null ? null : { mode, level: 0, day };
  }
  const level = int(data.level, 0, 0, MAX_LEVELS);
  // Only a level that is open: one reached, or the next.
  return level >= 1 && level <= reached + 1 ? { mode, level, day: null } : null;
}

const isWhole = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

/** A piece of a saved board, with an id no other piece has. */
function restorePiece(data: unknown, b: Board, ids: Set<number>): Piece | null {
  if (!isRecord(data) || !isWhole(data.kind, KINDS - 1)) return null;
  const kind = data.kind;
  // Only a colour can be a wave or a bomb.
  const special: Special = isColour(kind) && isWhole(data.special, BOMB) ? (data.special as Special) : NONE;
  let id = int(data.id, 0);
  if (id < 1 || ids.has(id)) {
    id = b.nextId;
    b.nextId += 1;
  }
  ids.add(id);
  b.nextId = Math.max(b.nextId, id + 1);
  return { id, kind, special };
}

/**
 * The board of a dive in progress, checked against its level's layout: never more sand, rock
 * or kelp than the level started with, and pieces only where pieces can be.
 */
function restoreBoard(data: unknown, level: Level): Board | null {
  if (!isRecord(data)) return null;
  const { layout } = level;
  const size = layout.width * layout.height;
  const pieces = list(data.pieces);
  const sand = list(data.sand);
  const rock = list(data.rock);
  const kelp = list(data.kelp);
  if (pieces.length !== size || sand.length !== size || rock.length !== size || kelp.length !== size) return null;
  const b: Board = {
    width: layout.width,
    height: layout.height,
    open: layout.open,
    pieces: new Array<Piece | null>(size).fill(null),
    sand: new Array<number>(size).fill(0),
    rock: new Array<number>(size).fill(0),
    kelp: new Array<number>(size).fill(0),
    nextId: int(data.nextId, 1, 1),
  };
  const ids = new Set<number>();
  for (let cell = 0; cell < size; cell++) {
    if (!layout.open[cell]) continue;
    b.sand[cell] = int(sand[cell], layout.sand[cell] ?? 0, 0, layout.sand[cell] ?? 0);
    b.rock[cell] = int(rock[cell], layout.rock[cell] ?? 0, 0, layout.rock[cell] ?? 0);
    if ((b.rock[cell] ?? 0) > 0) continue;
    const piece = restorePiece(pieces[cell], b, ids);
    b.pieces[cell] = piece;
    // Kelp always holds a piece.
    b.kelp[cell] = piece ? int(kelp[cell], layout.kelp[cell] ?? 0, 0, layout.kelp[cell] ?? 0) : 0;
  }
  return b;
}

function restoreDive(data: unknown, level: Level): Dive | null {
  if (!isRecord(data)) return null;
  const board = restoreBoard(data.board, level);
  if (!board) return null;
  const continues = int(data.continues, 0, 0, 1000);
  const turtles = isRecord(data.turtles) ? data.turtles : {};
  const saved = int(turtles.saved, 0);
  const onBoard = board.pieces.filter((piece) => piece?.kind === TURTLE).length;
  const collected = list(data.collected);
  const d: Dive = {
    board,
    rng: int(data.rng, 1, 0, 0xffff_ffff),
    movesLeft: int(data.movesLeft, level.moves, 0, level.moves + MORE_MOVES * continues),
    movesMade: int(data.movesMade, 0),
    collected: COLOURS.map((_, i) => int(collected[i], 0)),
    turtles: { spawned: Math.max(int(turtles.spawned, 0), saved + onBoard), saved },
    continues,
  };
  // A dive that reached its goals would have ended there and then.
  return isWon(d, level) ? null : d;
}

function restoreCurrent(data: unknown, reached: number): Current | null {
  if (!isRecord(data)) return null;
  const key = restoreKey(data, reached);
  if (!key) return null;
  const dive = restoreDive(data.dive, levelOf(key));
  return dive ? { ...key, dive } : null;
}

function restoreResult(data: unknown): DiveResult | null {
  if (!isRecord(data)) return null;
  const mode = oneOf(data.mode, MODES, 'reef');
  return {
    mode,
    level: int(data.level, 0, 0, MAX_LEVELS),
    day: dayKeyOf(data.day),
    won: bool(data.won, false),
    stars: int(data.stars, 0, 0, 3),
    before: int(data.before, 0, 0, 3),
    movesLeft: int(data.movesLeft, 0),
    pay: int(data.pay, 0),
    doubled: bool(data.doubled, false),
    zone: isZone(data.zone) ? data.zone : null,
    zoneCoins: int(data.zoneCoins, 0),
    streak: int(data.streak, 0),
  };
}

const isZone = (v: unknown): v is ZoneId => typeof v === 'string' && (ZONES as readonly string[]).includes(v);

const LOOKS: readonly LookId[] = [...WATERS, ...BUDDIES];
const isLook = (v: unknown): v is LookId => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);
const isTip = (v: unknown): v is TipId => typeof v === 'string' && (TIPS as readonly string[]).includes(v);

/** Every field is checked, so a damaged or hand-edited save can never break the game. */
export function restoreState(data: Data): GameState {
  const s = createState(num(data.createdAt, 0));
  // A refund can take back sand dollars that were already spent.
  s.coins = int(data.coins, 0, -1_000_000_000);
  s.stars = list(data.stars)
    .slice(0, MAX_LEVELS)
    .map((stars) => int(stars, 1, 1, 3));
  s.current = restoreCurrent(data.current, s.stars.length);
  const daily = isRecord(data.daily) ? data.daily : {};
  s.daily = {
    day: dayKeyOf(daily.day),
    tries: int(daily.tries, 0),
    lastDone: dayKeyOf(daily.lastDone),
    streak: int(daily.streak, 0),
    bestStreak: int(daily.bestStreak, 0),
  };
  s.result = restoreResult(data.result);
  const tools = isRecord(data.tools) ? data.tools : {};
  s.tools = recordOf(TOOLS, (tool) => int(tools[tool], START_TOOLS[tool], 0, MAX_TOOLS));
  const looks = isRecord(data.looks) ? data.looks : {};
  s.looks = {
    water: oneOf(looks.water, WATERS, 'sunlit'),
    buddy: oneOf(looks.buddy, BUDDIES, 'clownfish'),
    bought: [...new Set(list(looks.bought).filter(isLook))],
  };
  s.tips = [...new Set(list(data.tips).filter(isTip))];
  const stats = isRecord(data.stats) ? data.stats : {};
  s.stats = {
    dives: int(stats.dives, 0),
    won: int(stats.won, 0),
    dailies: int(stats.dailies, 0),
    moves: int(stats.moves, 0),
    cleared: int(stats.cleared, 0),
    turtles: int(stats.turtles, 0),
    continues: int(stats.continues, 0),
    toolsUsed: int(stats.toolsUsed, 0),
    playSeconds: num(stats.playSeconds, 0),
  };
  s.ads = restoreAdLedger(data.ads, AD_PLACEMENTS);
  s.shop = restoreShop(data.shop, ENTITLEMENTS);
  s.settings = restoreSettings(data.settings);
  return s;
}

export const saveFormat: SaveFormat<GameState> = {
  game: 'tidegarden',
  version: SAVE_VERSION,
  // migrations[1] will turn a version 1 save into version 2, once there is a version 2.
  migrations: {},
  restore: restoreState,
};
