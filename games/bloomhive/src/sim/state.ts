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
import {
  AD_PLACEMENTS,
  ENTITLEMENTS,
  HATS,
  MAX_TOOLS,
  MODES,
  SKIES,
  START_TOOLS,
  TIPS,
  TOOLS,
  type AdPlacement,
  type Entitlement,
  type Hat,
  type LookId,
  type Mode,
  type Sky,
  type TipId,
  type Tool,
} from './content.js';
import { CELLS, COLOURS, validCell, type Board, type Bud, type BudKind, type Seed } from './hive.js';
import { ZONES, dailyLevel, levelAt, type ZoneId } from './levels.js';
import { MORE_SHOTS, NECTAR_FULL, beesIn, isWon, type Level, type Round } from './round.js';

export type { AdPlacement, Entitlement } from './content.js';

/** Which level a round is a try at: a level of the meadow or the wild by its number, or a day's daily meadow. */
export interface RoundKey {
  mode: Mode;
  /** The level, from 1, of a meadow round; 0 for a daily round. */
  level: number;
  /** The day of a daily round; null for a meadow round. */
  day: string | null;
}

/** The round in progress: there is one at a time. */
export interface Current extends RoundKey {
  round: Round;
}

/** The last round that ended, shown until the next one starts. */
export interface RoundResult extends RoundKey {
  won: boolean;
  /** Stars for a round that reached its goals, 0 for one given up. */
  stars: number;
  /** The stars the level had before, for a level reached again. */
  before: number;
  shotsLeft: number;
  /** What the round paid, which a rewarded ad can double once. */
  pay: number;
  doubled: boolean;
  /** The zone this level was the last of, reached for the first time, and what that paid on top; never doubled. */
  zone: ZoneId | null;
  zoneCoins: number;
  /** The daily streak after a daily round. */
  streak: number;
}

export interface GameState {
  createdAt: number;
  /** Honey, the game's one currency. */
  coins: number;
  /** The stars of each level reached, 1 to 3, from level 1. The level after the last one reached is open. */
  stars: number[];
  current: Current | null;
  daily: {
    /** Tries at the daily meadow on `day`, which give each try its colours. */
    day: string | null;
    tries: number;
    lastDone: string | null;
    streak: number;
    bestStreak: number;
  };
  result: RoundResult | null;
  tools: Record<Tool, number>;
  looks: { sky: Sky; hat: Hat; bought: LookId[] };
  /** The notes on what is new that have been shown. */
  tips: TipId[];
  stats: {
    /** Rounds started, which give each try at a level its colours. */
    rounds: number;
    /** Rounds that reached their goals, the daily meadow's too. */
    won: number;
    dailies: number;
    shots: number;
    /** Buds popped or fallen. */
    buds: number;
    bees: number;
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
    looks: { sky: 'morning', hat: 'leaf', bought: [] },
    tips: [],
    stats: { rounds: 0, won: 0, dailies: 0, shots: 0, buds: 0, bees: 0, continues: 0, toolsUsed: 0, playSeconds: 0 },
    ads: createAdLedger(AD_PLACEMENTS),
    shop: createShop(),
    settings: createSettings(),
  };
}

/** The level a round is a try at. */
export function levelOf(key: RoundKey): Level {
  return key.mode === 'daily' && key.day !== null ? dailyLevel(key.day) : levelAt(Math.max(1, key.level));
}

function restoreKey(data: Data, reached: number): RoundKey | null {
  const mode = oneOf(data.mode, MODES, 'meadow');
  if (mode === 'daily') {
    const day = dayKeyOf(data.day);
    return day === null ? null : { mode, level: 0, day };
  }
  const level = int(data.level, 0, 0, MAX_LEVELS);
  // Only a level that is open: one reached, or the next.
  return level >= 1 && level <= reached + 1 ? { mode, level, day: null } : null;
}

const KINDS: readonly BudKind[] = ['bud', 'wax', 'puff'];
const isColour = (v: unknown, colours: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < colours;

/** A bud of a saved board, with an id no other bud has; null for anything that is not one. */
function restoreBud(data: unknown, b: Board, ids: Set<number>, colours: number): Bud | null {
  if (!isRecord(data) || typeof data.kind !== 'string' || !(KINDS as readonly string[]).includes(data.kind)) return null;
  const kind = data.kind as BudKind;
  if (kind === 'bud' && !isColour(data.colour, colours)) return null;
  let id = int(data.id, 0);
  if (id < 1 || ids.has(id)) {
    id = b.nextId;
    b.nextId += 1;
  }
  ids.add(id);
  b.nextId = Math.max(b.nextId, id + 1);
  const flag = (v: unknown) => kind === 'bud' && bool(v, false);
  return { id, kind, colour: kind === 'bud' ? (data.colour as number) : -1, bee: flag(data.bee), honey: flag(data.honey), butterfly: flag(data.butterfly) };
}

/**
 * The board of a round in progress, checked against its level: never more wax, puffs, bees,
 * honey or butterflies than the level started with, as shots only ever add plain buds.
 */
function restoreBoard(data: unknown, level: Level): Board | null {
  if (!isRecord(data)) return null;
  const cells = list(data.cells);
  if (cells.length !== CELLS) return null;
  const b: Board = { cells: new Array<Bud | null>(CELLS).fill(null), nextId: int(data.nextId, 1, 1) };
  const ids = new Set<number>();
  for (let cell = 0; cell < CELLS; cell++) {
    if (!validCell(cell) || cells[cell] == null) continue;
    b.cells[cell] = restoreBud(cells[cell], b, ids, level.colours);
  }
  return MARKS.every((test) => tally(b.cells, test) <= tally(level.layout, test)) ? b : null;
}

/** What a bud and a level's seed for it have in common. */
type Marked = Pick<Seed, 'kind' | 'bee' | 'honey' | 'butterfly'>;
const MARKS: readonly ((m: Marked) => boolean)[] = [(m) => m.kind === 'wax', (m) => m.kind === 'puff', (m) => m.bee, (m) => m.honey, (m) => m.butterfly];
const tally = (cells: readonly (Marked | null)[], test: (m: Marked) => boolean): number => cells.filter((m) => m !== null && test(m)).length;

function restoreRound(data: unknown, level: Level): Round | null {
  if (!isRecord(data)) return null;
  const board = restoreBoard(data.board, level);
  if (!board) return null;
  const continues = int(data.continues, 0, 0, 1000);
  const queue = list(data.queue);
  const collected = list(data.collected);
  const r: Round = {
    board,
    rng: int(data.rng, 1, 0, 0xffff_ffff),
    shotsLeft: int(data.shotsLeft, level.shots, 0, level.shots + MORE_SHOTS * continues),
    shotsMade: int(data.shotsMade, 0),
    queue: [int(queue[0], 0, 0, level.colours - 1), int(queue[1], 0, 0, level.colours - 1)],
    nectar: int(data.nectar, 0, 0, NECTAR_FULL - 1),
    bomb: bool(data.bomb, false),
    freed: int(data.freed, 0, 0, beesIn(level.layout)),
    collected: COLOURS.map((_, i) => int(collected[i], 0)),
    continues,
  };
  // A round that reached its goals would have ended there and then.
  return isWon(r, level) ? null : r;
}

function restoreCurrent(data: unknown, reached: number): Current | null {
  if (!isRecord(data)) return null;
  const key = restoreKey(data, reached);
  if (!key) return null;
  const round = restoreRound(data.round, levelOf(key));
  return round ? { ...key, round } : null;
}

function restoreResult(data: unknown): RoundResult | null {
  if (!isRecord(data)) return null;
  const mode = oneOf(data.mode, MODES, 'meadow');
  return {
    mode,
    level: int(data.level, 0, 0, MAX_LEVELS),
    day: dayKeyOf(data.day),
    won: bool(data.won, false),
    stars: int(data.stars, 0, 0, 3),
    before: int(data.before, 0, 0, 3),
    shotsLeft: int(data.shotsLeft, 0),
    pay: int(data.pay, 0),
    doubled: bool(data.doubled, false),
    zone: isZone(data.zone) ? data.zone : null,
    zoneCoins: int(data.zoneCoins, 0),
    streak: int(data.streak, 0),
  };
}

const isZone = (v: unknown): v is ZoneId => typeof v === 'string' && (ZONES as readonly string[]).includes(v);

const LOOKS: readonly LookId[] = [...SKIES, ...HATS];
const isLook = (v: unknown): v is LookId => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);
const isTip = (v: unknown): v is TipId => typeof v === 'string' && (TIPS as readonly string[]).includes(v);

/** Every field is checked, so a damaged or hand-edited save can never break the game. */
export function restoreState(data: Data): GameState {
  const s = createState(num(data.createdAt, 0));
  // A refund can take back honey that was already spent.
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
    sky: oneOf(looks.sky, SKIES, 'morning'),
    hat: oneOf(looks.hat, HATS, 'leaf'),
    bought: [...new Set(list(looks.bought).filter(isLook))],
  };
  s.tips = [...new Set(list(data.tips).filter(isTip))];
  const stats = isRecord(data.stats) ? data.stats : {};
  s.stats = {
    rounds: int(stats.rounds, 0),
    won: int(stats.won, 0),
    dailies: int(stats.dailies, 0),
    shots: int(stats.shots, 0),
    buds: int(stats.buds, 0),
    bees: int(stats.bees, 0),
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
  game: 'bloomhive',
  version: SAVE_VERSION,
  // migrations[1] will turn a version 1 save into version 2, once there is a version 2.
  migrations: {},
  restore: restoreState,
};
