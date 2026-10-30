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
import { SIZE, EMPTY } from './board.js';
import {
  AD_PLACEMENTS,
  BEST_OF,
  COMMISSION_KINDS,
  ENTITLEMENTS,
  FABRIC_SETS,
  type AdPlacement,
  type CommissionKind,
  type Entitlement,
  type FabricSetId,
} from './content.js';
import { FABRICS, MODES, TRAY, type Mode, type Patch, type Quilt, type Snapshot } from './quilt.js';
import { isShapeId } from './shapes.js';

export type { AdPlacement, Entitlement } from './content.js';

export interface Commission {
  kind: CommissionKind;
  /** 0, 1 or 2: the target and the reward grow with it. */
  tier: number;
  progress: number;
}

/** The last finished quilt, shown until the next one starts. */
export interface QuiltResult {
  mode: Mode;
  score: number;
  newBest: boolean;
  /** Spools for the score, which a rewarded ad can double once. */
  spools: number;
  doubled: boolean;
}

export interface GameState {
  createdAt: number;
  /** Random state for everything but the patches: new quilts' seeds and new commissions. */
  rng: number;
  spools: number;
  quilts: Record<Mode, Quilt | null>;
  result: QuiltResult | null;
  /** Best score of an endless quilt. */
  best: number;
  daily: { lastDone: string | null; streak: number; bestStreak: number };
  fabrics: { chosen: FabricSetId; bought: FabricSetId[] };
  commissions: Commission[];
  commissionsDone: number;
  stats: {
    quilts: number;
    patches: number;
    seams: number;
    perfect: number;
    doubles: number;
    clears: number;
    bestStreak: number;
    playSeconds: number;
  };
  /** The first-time hint stays until the first patch is placed. */
  hintDone: boolean;
  ads: AdLedger<AdPlacement>;
  shop: ShopRecord<Entitlement>;
  settings: ShellSettings;
}

export const SAVE_VERSION = 1;

export function createState(now: number, seed: number): GameState {
  return {
    createdAt: now,
    rng: seed >>> 0,
    spools: 0,
    quilts: { endless: null, daily: null },
    result: null,
    best: 0,
    daily: { lastDone: null, streak: 0, bestStreak: 0 },
    fabrics: { chosen: 'cottage', bought: [] },
    commissions: [
      { kind: 'seams', tier: 0, progress: 0 },
      { kind: 'perfect', tier: 0, progress: 0 },
      { kind: 'score', tier: 0, progress: 0 },
    ],
    commissionsDone: 0,
    stats: { quilts: 0, patches: 0, seams: 0, perfect: 0, doubles: 0, clears: 0, bestStreak: 0, playSeconds: 0 },
    hintDone: false,
    ads: createAdLedger(AD_PLACEMENTS),
    shop: createShop(),
    settings: createSettings(),
  };
}

function restoreBoard(data: unknown): number[] | null {
  const squares = list(data);
  if (squares.length !== SIZE * SIZE) return null;
  return squares.map((square) => int(square, EMPTY, EMPTY, FABRICS - 1));
}

function restoreTray(data: unknown): (Patch | null)[] | null {
  const slots = list(data);
  if (slots.length !== TRAY) return null;
  return slots.map((slot) => (isRecord(slot) && isShapeId(slot.shape) ? { shape: slot.shape, fabric: int(slot.fabric, 0, 0, FABRICS - 1) } : null));
}

function restoreTally(data: Data) {
  return {
    score: int(data.score, 0),
    streak: int(data.streak, 0),
    sinceSeam: int(data.sinceSeam, 0),
    patches: int(data.patches, 0),
    seams: int(data.seams, 0),
    perfect: int(data.perfect, 0),
    doubles: int(data.doubles, 0),
    bestStreak: int(data.bestStreak, 0),
    clears: int(data.clears, 0),
    spools: int(data.spools, 0),
  };
}

function restoreSnapshot(data: unknown): Snapshot | null {
  if (!isRecord(data)) return null;
  const board = restoreBoard(data.board);
  const tray = restoreTray(data.tray);
  if (!board || !tray) return null;
  return { ...restoreTally(data), board, tray, rng: int(data.rng, 0, 0, 0xffffffff) };
}

/** A quilt in progress; a damaged one is dropped rather than half restored. */
function restoreQuilt(data: unknown, mode: Mode): Quilt | null {
  if (!isRecord(data)) return null;
  const board = restoreBoard(data.board);
  const tray = restoreTray(data.tray);
  if (!board || !tray) return null;
  const day = mode === 'daily' ? dayKeyOf(data.day) : null;
  if (mode === 'daily' && day === null) return null;
  return {
    mode,
    day,
    rng: int(data.rng, 0, 0, 0xffffffff),
    board,
    tray,
    secondChanceUsed: bool(data.secondChanceUsed, false),
    undo: restoreSnapshot(data.undo),
    ...restoreTally(data),
  };
}

function restoreResult(data: unknown): QuiltResult | null {
  if (!isRecord(data)) return null;
  return {
    mode: oneOf(data.mode, MODES, 'endless'),
    score: int(data.score, 0),
    newBest: bool(data.newBest, false),
    spools: int(data.spools, 0),
    doubled: bool(data.doubled, false),
  };
}

function restoreCommission(data: unknown): Commission | null {
  if (!isRecord(data)) return null;
  const kind = oneOf(data.kind, COMMISSION_KINDS, 'seams');
  if (data.kind !== kind) return null;
  return { kind, tier: int(data.tier, 0, 0, 2), progress: int(data.progress, 0) };
}

const isFabricSet = (v: unknown): v is FabricSetId => typeof v === 'string' && (FABRIC_SETS as readonly string[]).includes(v);

/** Every field is checked, so a damaged or hand-edited save can never break the game. */
export function restoreState(data: Data): GameState {
  const s = createState(num(data.createdAt, 0), int(data.rng, 1, 0, 0xffffffff));
  // A refund can take back spools that were already spent.
  s.spools = int(data.spools, 0, -1_000_000_000);
  const quilts = isRecord(data.quilts) ? data.quilts : {};
  s.quilts = { endless: restoreQuilt(quilts.endless, 'endless'), daily: restoreQuilt(quilts.daily, 'daily') };
  s.result = restoreResult(data.result);
  s.best = int(data.best, 0);
  const daily = isRecord(data.daily) ? data.daily : {};
  s.daily = { lastDone: dayKeyOf(daily.lastDone), streak: int(daily.streak, 0), bestStreak: int(daily.bestStreak, 0) };
  const fabrics = isRecord(data.fabrics) ? data.fabrics : {};
  const bought = [...new Set(list(fabrics.bought).filter(isFabricSet))];
  s.fabrics = { chosen: isFabricSet(fabrics.chosen) ? fabrics.chosen : 'cottage', bought };
  const commissions = list(data.commissions)
    .map(restoreCommission)
    .filter((c): c is Commission => c !== null);
  // Each kind at most once; a damaged list falls back to the starting commissions.
  if (commissions.length === s.commissions.length && new Set(commissions.map((c) => c.kind)).size === commissions.length) s.commissions = commissions;
  s.commissionsDone = int(data.commissionsDone, 0);
  const stats = isRecord(data.stats) ? data.stats : {};
  s.stats = {
    quilts: int(stats.quilts, 0),
    patches: int(stats.patches, 0),
    seams: int(stats.seams, 0),
    perfect: int(stats.perfect, 0),
    doubles: int(stats.doubles, 0),
    clears: int(stats.clears, 0),
    bestStreak: int(stats.bestStreak, 0),
    playSeconds: num(stats.playSeconds, 0),
  };
  s.hintDone = bool(data.hintDone, false);
  s.ads = restoreAdLedger(data.ads, AD_PLACEMENTS);
  s.shop = restoreShop(data.shop, ENTITLEMENTS);
  s.settings = restoreSettings(data.settings);
  return s;
}

/** Whether a commission of this kind asks for one quilt that reaches the target. */
export function isBestOf(kind: CommissionKind): boolean {
  return BEST_OF.includes(kind);
}

export const saveFormat: SaveFormat<GameState> = {
  game: 'quiltnook',
  version: SAVE_VERSION,
  // migrations[1] will turn a version 1 save into version 2, once there is a version 2.
  migrations: {},
  restore: restoreState,
};
