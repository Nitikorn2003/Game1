import { bool, dayKeyOf, int, isRecord, list, num, oneOf, type Data, type SaveFormat } from '@game1/engine';
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
  CONSTELLATIONS,
  ENTITLEMENTS,
  JAR_STYLES,
  MODES,
  SKIES,
  UNDOS_PER_SHELF,
  type AdPlacement,
  type ConstellationId,
  type Entitlement,
  type JarStyle,
  type LookId,
  type Mode,
  type Sky,
} from './content.js';
import { pour, wellFormed, type Jar, type Move } from './jars.js';
import { MAX_COLOURS } from './levels.js';

export type { AdPlacement, Entitlement } from './content.js';

/** One pour as it was made, so it can be taken back exactly. */
export interface Pour {
  from: number;
  to: number;
  n: number;
}

/** One puzzle in progress. */
export interface Shelf {
  mode: Mode;
  /** The level, or 0 for a daily sky. */
  level: number;
  /** The day of a daily sky, null for a level. */
  day: string | null;
  capacity: number;
  /** The jars as they were dealt, which Restart puts back. */
  start: Jar[];
  jars: Jar[];
  /** Pours since the start or the last restart, newest last. */
  history: Pour[];
  undosLeft: number;
  /** An extra empty jar was added; a shelf can have one. */
  extraJar: boolean;
  /** Help used on this shelf. A shelf solved without any is a clean solve. */
  undid: number;
  hinted: number;
  /** The pour a hint showed, until the next pour, undo or restart. */
  hint: Move | null;
}

/** The last solved shelf, shown until the next one starts. */
export interface ShelfResult {
  mode: Mode;
  level: number;
  /** Pours in the way it was solved: since the last restart, less the ones undone. */
  pours: number;
  clean: boolean;
  /** Stardust for the shelf, which a rewarded ad can double once. */
  stardust: number;
  doubled: boolean;
  /** The star this level lit (counted from 0), null for a daily sky or once the atlas is full. */
  star: number | null;
  /** The constellation whose last star this lit, and the stardust that paid. */
  constellation: ConstellationId | null;
  bonus: number;
  /** The daily streak after a daily sky. */
  streak: number;
}

export interface GameState {
  createdAt: number;
  stardust: number;
  /** The next level to play: levels are solved in order, so one more than the levels solved. */
  level: number;
  shelves: Record<Mode, Shelf | null>;
  result: ShelfResult | null;
  daily: { lastDone: string | null; streak: number; bestStreak: number };
  looks: { jar: JarStyle; sky: Sky; bought: LookId[] };
  stats: {
    levels: number;
    dailies: number;
    pours: number;
    clean: number;
    undos: number;
    hints: number;
    extraJars: number;
    playSeconds: number;
  };
  /** The first-time note on how to pour stays until the first pour. */
  taught: boolean;
  ads: AdLedger<AdPlacement>;
  shop: ShopRecord<Entitlement>;
  settings: ShellSettings;
}

export const SAVE_VERSION = 1;

export function createState(now: number): GameState {
  return {
    createdAt: now,
    stardust: 0,
    level: 1,
    shelves: { level: null, daily: null },
    result: null,
    daily: { lastDone: null, streak: 0, bestStreak: 0 },
    looks: { jar: 'glass', sky: 'twilight', bought: [] },
    stats: { levels: 0, dailies: 0, pours: 0, clean: 0, undos: 0, hints: 0, extraJars: 0, playSeconds: 0 },
    taught: false,
    ads: createAdLedger(AD_PLACEMENTS),
    shop: createShop(),
    settings: createSettings(),
  };
}

/** Jars hold at most this many units, and a shelf has at most this many jars. */
const MAX_CAPACITY = 8;
const MAX_JARS = 20;

function restoreJars(data: unknown, capacity: number): Jar[] | null {
  const jars = list(data);
  if (jars.length < 2 || jars.length > MAX_JARS) return null;
  const restored: Jar[] = [];
  for (const entry of jars) {
    const units = list(entry);
    if (!Array.isArray(entry) || units.length > capacity) return null;
    const jar: Jar = [];
    for (const unit of units) {
      if (typeof unit !== 'number' || !Number.isInteger(unit) || unit < 0 || unit >= MAX_COLOURS) return null;
      jar.push(unit);
    }
    restored.push(jar);
  }
  return restored;
}

function sameUnits(a: readonly Jar[], b: readonly Jar[]): boolean {
  const units = (jars: readonly Jar[]) =>
    jars
      .flat()
      .sort((x, y) => x - y)
      .join(',');
  return units(a) === units(b);
}

function sameJars(a: readonly Jar[], b: readonly Jar[]): boolean {
  return a.length === b.length && a.every((jar, i) => jar.join(',') === b[i]?.join(','));
}

/** The pours, if pouring them from the start gives the jars as saved; otherwise none, so Undo stays safe. */
function restoreHistory(data: unknown, start: readonly Jar[], jars: readonly Jar[], capacity: number): Pour[] {
  const puzzle = { jars: start.map((jar) => [...jar]), capacity };
  const history: Pour[] = [];
  for (const entry of list(data)) {
    if (!isRecord(entry)) return [];
    const from = int(entry.from, -1, -1, MAX_JARS);
    const to = int(entry.to, -1, -1, MAX_JARS);
    const n = int(entry.n, 0, 0, MAX_CAPACITY);
    if (n === 0 || pour(puzzle, from, to) !== n) return [];
    history.push({ from, to, n });
  }
  return sameJars(puzzle.jars, jars) ? history : [];
}

function restoreHint(data: unknown, jars: number): Move | null {
  const hint = list(data);
  const from = int(hint[0], -1, -1, MAX_JARS);
  const to = int(hint[1], -1, -1, MAX_JARS);
  return hint.length === 2 && from >= 0 && to >= 0 && from < jars && to < jars && from !== to ? [from, to] : null;
}

/** A shelf in progress; a damaged one is dropped rather than half restored. */
function restoreShelf(data: unknown, mode: Mode): Shelf | null {
  if (!isRecord(data)) return null;
  const capacity = int(data.capacity, 0, 0, MAX_CAPACITY);
  const start = restoreJars(data.start, capacity);
  const jars = restoreJars(data.jars, capacity);
  if (capacity < 2 || !start || !jars || start.length !== jars.length) return null;
  if (!wellFormed({ jars, capacity }) || !sameUnits(start, jars)) return null;
  const day = mode === 'daily' ? dayKeyOf(data.day) : null;
  if (mode === 'daily' && day === null) return null;
  const level = mode === 'level' ? int(data.level, 0, 0) : 0;
  if (mode === 'level' && level < 1) return null;
  return {
    mode,
    level,
    day,
    capacity,
    start,
    jars,
    history: restoreHistory(data.history, start, jars, capacity),
    undosLeft: int(data.undosLeft, UNDOS_PER_SHELF, 0, 1000),
    extraJar: bool(data.extraJar, false),
    undid: int(data.undid, 0),
    hinted: int(data.hinted, 0),
    hint: restoreHint(data.hint, jars.length),
  };
}

const isConstellation = (v: unknown): v is ConstellationId => typeof v === 'string' && CONSTELLATIONS.some((c) => c.id === v);

function restoreResult(data: unknown): ShelfResult | null {
  if (!isRecord(data)) return null;
  const star = int(data.star, -1, -1);
  return {
    mode: oneOf(data.mode, MODES, 'level'),
    level: int(data.level, 0),
    pours: int(data.pours, 0),
    clean: bool(data.clean, false),
    stardust: int(data.stardust, 0),
    doubled: bool(data.doubled, false),
    star: star < 0 ? null : star,
    constellation: isConstellation(data.constellation) ? data.constellation : null,
    bonus: int(data.bonus, 0),
    streak: int(data.streak, 0),
  };
}

const LOOKS: readonly LookId[] = [...JAR_STYLES, ...SKIES];
const isLook = (v: unknown): v is LookId => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);

/** Every field is checked, so a damaged or hand-edited save can never break the game. */
export function restoreState(data: Data): GameState {
  const s = createState(num(data.createdAt, 0));
  // A refund can take back stardust that was already spent.
  s.stardust = int(data.stardust, 0, -1_000_000_000);
  s.level = int(data.level, 1, 1);
  const shelves = isRecord(data.shelves) ? data.shelves : {};
  const level = restoreShelf(shelves.level, 'level');
  // The level shelf is always the next level.
  s.shelves = { level: level?.level === s.level ? level : null, daily: restoreShelf(shelves.daily, 'daily') };
  s.result = restoreResult(data.result);
  const daily = isRecord(data.daily) ? data.daily : {};
  s.daily = { lastDone: dayKeyOf(daily.lastDone), streak: int(daily.streak, 0), bestStreak: int(daily.bestStreak, 0) };
  const looks = isRecord(data.looks) ? data.looks : {};
  s.looks = {
    jar: oneOf(looks.jar, JAR_STYLES, 'glass'),
    sky: oneOf(looks.sky, SKIES, 'twilight'),
    bought: [...new Set(list(looks.bought).filter(isLook))],
  };
  const stats = isRecord(data.stats) ? data.stats : {};
  s.stats = {
    levels: int(stats.levels, 0),
    dailies: int(stats.dailies, 0),
    pours: int(stats.pours, 0),
    clean: int(stats.clean, 0),
    undos: int(stats.undos, 0),
    hints: int(stats.hints, 0),
    extraJars: int(stats.extraJars, 0),
    playSeconds: num(stats.playSeconds, 0),
  };
  s.taught = bool(data.taught, false);
  s.ads = restoreAdLedger(data.ads, AD_PLACEMENTS);
  s.shop = restoreShop(data.shop, ENTITLEMENTS);
  s.settings = restoreSettings(data.settings);
  return s;
}

export const saveFormat: SaveFormat<GameState> = {
  game: 'skyjars',
  version: SAVE_VERSION,
  // migrations[1] will turn a version 1 save into version 2, once there is a version 2.
  migrations: {},
  restore: restoreState,
};
