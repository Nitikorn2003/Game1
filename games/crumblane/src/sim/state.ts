import { dayKeyOf, int, isRecord, list, num, oneOf, recordOf, type Data, type SaveFormat } from '@game1/engine';
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
  MAX_TOOLS,
  MODES,
  SEASONS,
  START_TOOLS,
  TILE_SETS,
  TIPS,
  TOOLS,
  type AdPlacement,
  type Entitlement,
  type LookId,
  type Mode,
  type Season,
  type TileSet,
  type TipId,
  type Tool,
} from './content.js';
import { PASTRIES } from './counter.js';
import { ZONES, dailyLevel, levelAt, type ZoneId } from './levels.js';
import { RACK, TRAY, isWon, type Level, type Place, type Round, type Taken } from './round.js';

export type { AdPlacement, Entitlement } from './content.js';

/** Which level a round is a try at: a level of the lane or the late shift by its number, or a day's daily special. */
export interface RoundKey {
  mode: Mode;
  /** The level, from 1, of a lane round; 0 for a daily round. */
  level: number;
  /** The day of a daily round; null for a lane round. */
  day: string | null;
}

/** The round in progress: there is one at a time. */
export interface Current extends RoundKey {
  round: Round;
}

/** The last round that ended, shown until the next one starts. */
export interface RoundResult extends RoundKey {
  won: boolean;
  /** Stars for a counter cleared, 0 for one given up. */
  stars: number;
  /** The stars the level had before, for a level cleared again. */
  before: number;
  /** The most pastries the tray held. */
  peak: number;
  /** What the round paid, which a rewarded ad can double once: the level or the daily special, and the sprinkles. */
  pay: number;
  /** The part of the pay that came from sprinkled pastries. */
  sprinkles: number;
  doubled: boolean;
  /** The shop this level was the last of, cleared for the first time, and what that paid on top; never doubled. */
  zone: ZoneId | null;
  zoneCoins: number;
  /** The daily streak after a daily round. */
  streak: number;
}

export interface GameState {
  createdAt: number;
  /** Sugar, the game's one currency. */
  coins: number;
  /** The stars of each level cleared, 1 to 3, from level 1. The level after the last one cleared is open. */
  stars: number[];
  current: Current | null;
  daily: {
    /** Tries at the daily special on `day`, which give each try its deal. */
    day: string | null;
    tries: number;
    lastDone: string | null;
    streak: number;
    bestStreak: number;
  };
  result: RoundResult | null;
  tools: Record<Tool, number>;
  looks: { tiles: TileSet; season: Season; bought: LookId[] };
  /** The notes on what is new that have been shown. */
  tips: TipId[];
  stats: {
    /** Rounds started, which give each try at a level its deal. */
    rounds: number;
    /** Counters cleared, the daily special's too. */
    won: number;
    dailies: number;
    /** Pastries put on the tray. */
    taken: number;
    /** Sets of three boxed up. */
    sets: number;
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
    looks: { tiles: 'cream', season: 'spring', bought: [] },
    tips: [],
    stats: { rounds: 0, won: 0, dailies: 0, taken: 0, sets: 0, continues: 0, toolsUsed: 0, playSeconds: 0 },
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
  const mode = oneOf(data.mode, MODES, 'lane');
  if (mode === 'daily') {
    const day = dayKeyOf(data.day);
    return day === null ? null : { mode, level: 0, day };
  }
  const level = int(data.level, 0, 0, MAX_LEVELS);
  // Only a level that is open: one cleared, or the next.
  return level >= 1 && level <= reached + 1 ? { mode, level, day: null } : null;
}

const PLACES: readonly Place[] = ['counter', 'tray', 'rack', 'gone'];

/** The tiles of a saved list that are in `place`, each once, in the saved order. */
function tilesIn(data: unknown, at: readonly Place[], place: Place): number[] {
  const out: number[] = [];
  for (const v of list(data)) if (typeof v === 'number' && Number.isInteger(v) && at[v] === place && !out.includes(v)) out.push(v);
  return out;
}

/**
 * The round in progress, checked against its level: every pastry a real one, every tile in one
 * place, the tray and the rack holding just the tiles that are on them, and every pastry still
 * there in whole sets. The counts of sets and sprinkles come from the tiles boxed up.
 */
function restoreRound(data: unknown, level: Level): Round | null {
  if (!isRecord(data)) return null;
  const n = level.slots.length;
  const savedKinds = list(data.kinds);
  const savedAt = list(data.at);
  if (savedKinds.length !== n || savedAt.length !== n) return null;
  const kinds = savedKinds.map((k) => (typeof k === 'number' && Number.isInteger(k) && k >= 0 && k < PASTRIES.length ? k : -1));
  const at = savedAt.map((p) => oneOf(p, PLACES, 'counter'));
  if (kinds.some((k) => k < 0)) return null;
  const tray = tilesIn(data.tray, at, 'tray');
  const rack = tilesIn(data.rack, at, 'rack');
  if (tray.length !== at.filter((p) => p === 'tray').length || rack.length !== at.filter((p) => p === 'rack').length) return null;
  if (tray.length > TRAY || rack.length > RACK) return null;
  const left = new Map<number, number>();
  at.forEach((p, i) => {
    if (p !== 'gone') left.set(kinds[i] ?? 0, (left.get(kinds[i] ?? 0) ?? 0) + 1);
  });
  if ([...left.values()].some((count) => count % 3 !== 0)) return null;
  if (PASTRIES.some((_, kind) => tray.filter((t) => kinds[t] === kind).length >= 3)) return null;
  const gone = at.flatMap((p, i) => (p === 'gone' ? [i] : []));
  // Where tray tiles came from: as saved, and from the counter for any the save lost.
  const taken: Taken[] = [];
  for (const entry of list(data.taken)) {
    if (!isRecord(entry)) continue;
    const tile = int(entry.tile, -1);
    if (tray.includes(tile) && !taken.some((t) => t.tile === tile)) taken.push({ tile, from: entry.from === 'rack' ? 'rack' : 'counter' });
  }
  for (const tile of tray) if (!taken.some((t) => t.tile === tile)) taken.push({ tile, from: 'counter' });
  const r: Round = {
    kinds,
    at,
    tray,
    rack,
    taken,
    peak: int(data.peak, tray.length, tray.length, TRAY),
    sets: gone.length / 3,
    sprinkled: gone.filter((t) => level.sprinkles[t]).length,
    continues: int(data.continues, 0, 0, 1000),
    rolls: int(data.rolls, 0, 0, 100_000),
    seed: int(data.seed, 0, 0, 0xffff_ffff),
  };
  // A round with every tile boxed up would have ended there and then.
  return Number.isInteger(r.sets) && !isWon(r) ? r : null;
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
  const mode = oneOf(data.mode, MODES, 'lane');
  return {
    mode,
    level: int(data.level, 0, 0, MAX_LEVELS),
    day: dayKeyOf(data.day),
    won: data.won === true,
    stars: int(data.stars, 0, 0, 3),
    before: int(data.before, 0, 0, 3),
    peak: int(data.peak, 0, 0, TRAY),
    pay: int(data.pay, 0),
    sprinkles: int(data.sprinkles, 0),
    doubled: data.doubled === true,
    zone: isZone(data.zone) ? data.zone : null,
    zoneCoins: int(data.zoneCoins, 0),
    streak: int(data.streak, 0),
  };
}

const isZone = (v: unknown): v is ZoneId => typeof v === 'string' && (ZONES as readonly string[]).includes(v);

const LOOKS: readonly LookId[] = [...TILE_SETS, ...SEASONS];
const isLook = (v: unknown): v is LookId => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);
const isTip = (v: unknown): v is TipId => typeof v === 'string' && (TIPS as readonly string[]).includes(v);

/** Every field is checked, so a damaged or hand-edited save can never break the game. */
export function restoreState(data: Data): GameState {
  const s = createState(num(data.createdAt, 0));
  // A refund can take back sugar that was already spent.
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
    tiles: oneOf(looks.tiles, TILE_SETS, 'cream'),
    season: oneOf(looks.season, SEASONS, 'spring'),
    bought: [...new Set(list(looks.bought).filter(isLook))],
  };
  s.tips = [...new Set(list(data.tips).filter(isTip))];
  const stats = isRecord(data.stats) ? data.stats : {};
  s.stats = {
    rounds: int(stats.rounds, 0),
    won: int(stats.won, 0),
    dailies: int(stats.dailies, 0),
    taken: int(stats.taken, 0),
    sets: int(stats.sets, 0),
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
  game: 'crumblane',
  version: SAVE_VERSION,
  // migrations[1] will turn a version 1 save into version 2, once there is a version 2.
  migrations: {},
  restore: restoreState,
};
