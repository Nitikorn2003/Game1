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
import { isCard, type Card } from './cards.js';
import {
  AD_PLACEMENTS,
  CANALS,
  CARD_BACKS,
  ENTITLEMENTS,
  FREE_UNDOS,
  MAX_EXTRAS,
  MODES,
  SCENES,
  type AdPlacement,
  type CanalId,
  type CardBack,
  type Entitlement,
  type LookId,
  type Mode,
  type Scene,
} from './content.js';
import { isLayoutId, LAYOUTS } from './layouts.js';
import { replay, type Dealt, type Move } from './table.js';

export type { AdPlacement, Entitlement } from './content.js';

/** One deal in progress: as it was dealt, and the moves made on it since. */
export interface Deal {
  mode: Mode;
  /** The level, or 0 for a daily deal. */
  level: number;
  /** The day of a daily deal, null for a level. */
  day: string | null;
  /** Lost deals of this level or day before this one, which made this one a new deal. */
  attempt: number;
  dealt: Dealt;
  moves: Move[];
  undosLeft: number;
  /** Help used on this deal. A deal cleared without any is a clean one. */
  undid: number;
  wilds: number;
  extras: number;
}

/** The last finished deal, shown until the next one starts. */
export interface DealResult {
  mode: Mode;
  level: number;
  won: boolean;
  /** Layout cards cleared, of how many. */
  cleared: number;
  cards: number;
  bestStreak: number;
  clean: boolean;
  /** What a cleared deal paid: its pot, the level's or the daily's pay, and the spare stock cards. */
  pot: number;
  pay: number;
  spare: number;
  spareCoins: number;
  /** All of it together, which a rewarded ad can double once. */
  coins: number;
  doubled: boolean;
  /** The canal this level finished, and the coins that paid. */
  canal: CanalId | null;
  bonus: number;
  /** The daily streak after a daily deal. */
  streak: number;
}

export interface GameState {
  createdAt: number;
  coins: number;
  /** The next level to play: levels are cleared in order, so one more than the levels cleared. */
  level: number;
  deals: Record<Mode, Deal | null>;
  /** Deals lost on the level or the day being played; the next deal there is a new one. */
  tries: Record<Mode, { key: string; lost: number }>;
  result: DealResult | null;
  daily: { lastDone: string | null; streak: number; bestStreak: number };
  looks: { back: CardBack; scene: Scene; bought: LookId[] };
  stats: {
    wins: number;
    losses: number;
    dailies: number;
    /** Layout cards cleared, in every deal. */
    cards: number;
    bestStreak: number;
    clean: number;
    undos: number;
    wilds: number;
    extras: number;
    playSeconds: number;
  };
  /** The first-time note on how to play stays until the first card is played. */
  taught: boolean;
  ads: AdLedger<AdPlacement>;
  shop: ShopRecord<Entitlement>;
  settings: ShellSettings;
}

export const SAVE_VERSION = 1;

export function createState(now: number): GameState {
  return {
    createdAt: now,
    coins: 0,
    level: 1,
    deals: { level: null, daily: null },
    tries: { level: { key: '', lost: 0 }, daily: { key: '', lost: 0 } },
    result: null,
    daily: { lastDone: null, streak: 0, bestStreak: 0 },
    looks: { back: 'lotus', scene: 'morning', bought: [] },
    stats: { wins: 0, losses: 0, dailies: 0, cards: 0, bestStreak: 0, clean: 0, undos: 0, wilds: 0, extras: 0, playSeconds: 0 },
    taught: false,
    ads: createAdLedger(AD_PLACEMENTS),
    shop: createShop(),
    settings: createSettings(),
  };
}

function restoreCards(data: unknown, max: number): Card[] | null {
  const cards = list(data);
  if (!Array.isArray(data) || cards.length > max || !cards.every(isCard)) return null;
  return cards;
}

/** A deal as dealt: a known shape, every card of the deck at most once, and a stock to start the pile. */
function restoreDealt(data: unknown): Dealt | null {
  if (!isRecord(data) || !isLayoutId(data.layout)) return null;
  const spots = LAYOUTS[data.layout].spots.length;
  const cards = restoreCards(data.cards, spots);
  const stock = restoreCards(data.stock, 52);
  const reserve = restoreCards(data.reserve, 52);
  if (!cards || !stock || !reserve || cards.length !== spots || stock.length === 0) return null;
  const all = [...cards, ...stock, ...reserve];
  if (new Set(all).size !== all.length) return null;
  return { layout: data.layout, cards, stock, reserve };
}

function restoreMove(data: unknown): Move | null {
  if (!isRecord(data)) return null;
  switch (data.kind) {
    case 'play':
      return { kind: 'play', spot: int(data.spot, -1, -1, 64) };
    case 'draw':
    case 'wild':
    case 'extra':
      return { kind: data.kind };
    default:
      return null;
  }
}

/** The moves, as far as they can be made on the deal; anything after one that cannot is dropped. */
function restoreMoves(data: unknown, dealt: Dealt): Move[] {
  const moves: Move[] = [];
  for (const entry of list(data)) {
    const move = restoreMove(entry);
    if (!move) break;
    moves.push(move);
  }
  return moves.slice(0, replay(dealt, moves).made);
}

/** A deal in progress; a damaged one is dropped rather than half restored. */
function restoreDeal(data: unknown, mode: Mode): Deal | null {
  if (!isRecord(data)) return null;
  const dealt = restoreDealt(data.dealt);
  if (!dealt) return null;
  const day = mode === 'daily' ? dayKeyOf(data.day) : null;
  if (mode === 'daily' && day === null) return null;
  const level = mode === 'level' ? int(data.level, 0, 0) : 0;
  if (mode === 'level' && level < 1) return null;
  const moves = restoreMoves(data.moves, dealt);
  return {
    mode,
    level,
    day,
    attempt: int(data.attempt, 0),
    dealt,
    moves,
    undosLeft: int(data.undosLeft, FREE_UNDOS, 0, 1000),
    undid: int(data.undid, 0),
    wilds: int(data.wilds, 0),
    extras: Math.min(MAX_EXTRAS, int(data.extras, moves.filter((m) => m.kind === 'extra').length)),
  };
}

const isCanal = (v: unknown): v is CanalId => typeof v === 'string' && (CANALS as readonly string[]).includes(v);

function restoreResult(data: unknown): DealResult | null {
  if (!isRecord(data)) return null;
  return {
    mode: oneOf(data.mode, MODES, 'level'),
    level: int(data.level, 0),
    won: bool(data.won, false),
    cleared: int(data.cleared, 0),
    cards: int(data.cards, 0),
    bestStreak: int(data.bestStreak, 0),
    clean: bool(data.clean, false),
    pot: int(data.pot, 0),
    pay: int(data.pay, 0),
    spare: int(data.spare, 0),
    spareCoins: int(data.spareCoins, 0),
    coins: int(data.coins, 0),
    doubled: bool(data.doubled, false),
    canal: isCanal(data.canal) ? data.canal : null,
    bonus: int(data.bonus, 0),
    streak: int(data.streak, 0),
  };
}

function restoreTries(data: unknown): { key: string; lost: number } {
  const tries = isRecord(data) ? data : {};
  return { key: typeof tries.key === 'string' ? tries.key.slice(0, 32) : '', lost: int(tries.lost, 0, 0, 1_000_000) };
}

const LOOKS: readonly LookId[] = [...CARD_BACKS, ...SCENES];
const isLook = (v: unknown): v is LookId => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);

/** Every field is checked, so a damaged or hand-edited save can never break the game. */
export function restoreState(data: Data): GameState {
  const s = createState(num(data.createdAt, 0));
  // A refund can take back coins that were already spent.
  s.coins = int(data.coins, 0, -1_000_000_000);
  s.level = int(data.level, 1, 1);
  const deals = isRecord(data.deals) ? data.deals : {};
  const level = restoreDeal(deals.level, 'level');
  // The level deal is always the next level.
  s.deals = { level: level?.level === s.level ? level : null, daily: restoreDeal(deals.daily, 'daily') };
  const tries = isRecord(data.tries) ? data.tries : {};
  s.tries = { level: restoreTries(tries.level), daily: restoreTries(tries.daily) };
  s.result = restoreResult(data.result);
  const daily = isRecord(data.daily) ? data.daily : {};
  s.daily = { lastDone: dayKeyOf(daily.lastDone), streak: int(daily.streak, 0), bestStreak: int(daily.bestStreak, 0) };
  const looks = isRecord(data.looks) ? data.looks : {};
  s.looks = {
    back: oneOf(looks.back, CARD_BACKS, 'lotus'),
    scene: oneOf(looks.scene, SCENES, 'morning'),
    bought: [...new Set(list(looks.bought).filter(isLook))],
  };
  const stats = isRecord(data.stats) ? data.stats : {};
  s.stats = {
    wins: int(stats.wins, 0),
    losses: int(stats.losses, 0),
    dailies: int(stats.dailies, 0),
    cards: int(stats.cards, 0),
    bestStreak: int(stats.bestStreak, 0),
    clean: int(stats.clean, 0),
    undos: int(stats.undos, 0),
    wilds: int(stats.wilds, 0),
    extras: int(stats.extras, 0),
    playSeconds: num(stats.playSeconds, 0),
  };
  s.taught = bool(data.taught, false);
  s.ads = restoreAdLedger(data.ads, AD_PLACEMENTS);
  s.shop = restoreShop(data.shop, ENTITLEMENTS);
  s.settings = restoreSettings(data.settings);
  return s;
}

export const saveFormat: SaveFormat<GameState> = {
  game: 'lotuscanal',
  version: SAVE_VERSION,
  // migrations[1] will turn a version 1 save into version 2, once there is a version 2.
  migrations: {},
  restore: restoreState,
};
