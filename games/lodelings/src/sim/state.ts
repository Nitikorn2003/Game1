import type { NumberStyle, SaveFormat } from '@game1/engine';
import {
  ACHIEVEMENT_IDS,
  AD_PLACEMENTS,
  EGG_KINDS,
  ENTITLEMENTS,
  GEAR,
  GEAR_IDS,
  MAX_INCUBATORS,
  QUEST_METRICS,
  RELICS,
  RELIC_IDS,
  SKILL_IDS,
  speciesOf,
  type AchievementId,
  type AdPlacement,
  type EggKind,
  type Entitlement,
  type GearId,
  type QuestMetric,
  type RelicId,
  type SkillId,
  type SpeciesId,
} from './content.js';

export interface Owned {
  level: number;
  stars: number;
}

export interface Incubation {
  kind: EggKind;
  startedAt: number;
  readyAt: number;
}

export interface Quest {
  metric: QuestMetric;
  target: number;
  progress: number;
  claimed: boolean;
}

export interface GuardianFight {
  endsAt: number;
  maxHp: number;
  /** A rewarded ad can give one retry with extra time per Guardian attempt. */
  retried: boolean;
}

export interface OfflineReport {
  seconds: number;
  ore: number;
  eggs: EggKind[];
}

export interface Stats {
  taps: number;
  blocks: number;
  guardians: number;
  hatches: number;
  levels: number;
  gear: number;
  skills: number;
  resurfaces: number;
  oreEarned: number;
  playSeconds: number;
}

export type LocaleSetting = 'auto' | 'en' | 'th';

/** A purchase settlement this save received: what the server moved into it, and when. */
export interface Settled {
  id: string;
  amounts: Record<string, number>;
  /** When a save first received it. A save that takes it over from another keeps this time. */
  at: number;
}

export interface GameState {
  createdAt: number;
  /** Last time the simulation ran. The gap to the next start is offline time. */
  lastSeenAt: number;
  rng: number;
  depth: number;
  /** Position within the depth, 0 to 9. On a Guardian depth, 9 is the Guardian. */
  block: number;
  /** HP left on the current block or Guardian. */
  hp: number;
  guardian: GuardianFight | null;
  /** The player lost to this depth's Guardian and is mining its blocks until they try again. */
  farming: boolean;
  maxDepth: number;
  bestDepth: number;
  ore: number;
  gems: number;
  dust: number;
  lifetimeDust: number;
  gear: Record<GearId, number>;
  roster: Record<SpeciesId, Owned>;
  team: SpeciesId[];
  eggs: EggKind[];
  incubators: (Incubation | null)[];
  skills: Record<SkillId, { readyAt: number; activeUntil: number }>;
  frenzyCarry: number;
  blessingUntil: number;
  relics: Record<RelicId, number>;
  guardiansBeaten: number[];
  daily: { claimDay: string | null; claims: number; questDay: string | null; quests: Quest[]; bonusClaimed: boolean };
  achievements: Record<AchievementId, number>;
  stats: Stats;
  ads: { day: string | null; counts: Record<AdPlacement, number>; total: number; lastInterstitialAt: number; lastRewardedAt: number; interstitials: number };
  /**
   * settled: the newest settlements this save received, so a repeat grants nothing and a save
   * that replaces this one can take over its purchases. pending: a settlement id saved before
   * asking the server, so a crash cannot lose purchases.
   */
  shop: { entitlements: Entitlement[]; settled: Settled[]; pending: string | null; starterBought: boolean };
  settings: { sound: boolean; haptics: boolean; numbers: NumberStyle; locale: LocaleSetting };
  tutorial: string[];
  offline: OfflineReport | null;
}

export const SAVE_VERSION = 1;
/** How many settlements a save remembers. A player making this many purchases is very rare. */
export const SETTLED_KEEP = 200;
/** Found eggs stop at EGG_STORAGE, but bought eggs may go past it and must never be dropped. */
const EGG_HARD_LIMIT = 500;

function record<K extends string, V>(keys: readonly K[], value: (key: K) => V): Record<K, V> {
  return Object.fromEntries(keys.map((k) => [k, value(k)])) as Record<K, V>;
}

export function newStats(): Stats {
  return { taps: 0, blocks: 0, guardians: 0, hatches: 0, levels: 0, gear: 0, skills: 0, resurfaces: 0, oreEarned: 0, playSeconds: 0 };
}

export function createState(now: number, seed: number, firstHp: number): GameState {
  return {
    createdAt: now,
    lastSeenAt: now,
    rng: seed >>> 0,
    depth: 1,
    block: 0,
    hp: firstHp,
    guardian: null,
    farming: false,
    maxDepth: 1,
    bestDepth: 1,
    ore: 0,
    gems: 0,
    dust: 0,
    lifetimeDust: 0,
    gear: record(GEAR_IDS, () => 0),
    roster: {},
    team: [],
    eggs: [],
    incubators: [{ kind: 'starter', startedAt: now, readyAt: now + 10_000 }],
    skills: record(SKILL_IDS, () => ({ readyAt: 0, activeUntil: 0 })),
    frenzyCarry: 0,
    blessingUntil: 0,
    relics: record(RELIC_IDS, () => 0),
    guardiansBeaten: [],
    daily: { claimDay: null, claims: 0, questDay: null, quests: [], bonusClaimed: false },
    achievements: record(ACHIEVEMENT_IDS, () => 0),
    stats: newStats(),
    ads: { day: null, counts: record(AD_PLACEMENTS, () => 0), total: 0, lastInterstitialAt: 0, lastRewardedAt: 0, interstitials: 0 },
    shop: { entitlements: [], settled: [], pending: null, starterBought: false },
    settings: { sound: true, haptics: true, numbers: 'short', locale: 'auto' },
    tutorial: [],
    offline: null,
  };
}

// Restoring: every field is checked and repaired, so a damaged or hand-edited save can never
// put NaN, negative currency or unknown ids into a running game.

type Data = Record<string, unknown>;

const isRecord = (v: unknown): v is Data => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number, min = 0, max = Number.MAX_VALUE): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : fallback;
}

function int(v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.floor(num(v, fallback, min, max));
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function dayKey(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function restoreState(data: Data, firstHp: (depth: number) => number): GameState {
  const createdAt = num(data.createdAt, 0);
  const base = createState(createdAt, int(data.rng, 1, 0, 0xffffffff), 1);
  const s = base;
  s.lastSeenAt = num(data.lastSeenAt, createdAt);
  s.depth = int(data.depth, 1, 1, 1_000_000);
  s.block = int(data.block, 0, 0, 9);
  s.maxDepth = Math.max(s.depth, int(data.maxDepth, s.depth, 1, 1_000_000));
  s.bestDepth = Math.max(s.maxDepth, int(data.bestDepth, s.maxDepth, 1, 1_000_000));
  s.farming = bool(data.farming, false);
  const guardian = isRecord(data.guardian) ? data.guardian : null;
  s.guardian =
    guardian && typeof guardian.endsAt === 'number' && typeof guardian.maxHp === 'number' && guardian.maxHp > 0
      ? { endsAt: num(guardian.endsAt, 0), maxHp: num(guardian.maxHp, 1, 1), retried: bool(guardian.retried, false) }
      : null;
  const fullHp = s.guardian ? s.guardian.maxHp : firstHp(s.depth);
  s.hp = num(data.hp, fullHp, 0, fullHp);
  if (s.hp <= 0) s.hp = fullHp;
  s.ore = num(data.ore, 0);
  s.gems = int(data.gems, 0, -1_000_000_000);
  s.dust = int(data.dust, 0);
  s.lifetimeDust = Math.max(s.dust, int(data.lifetimeDust, 0));

  const gear = isRecord(data.gear) ? data.gear : {};
  for (const id of GEAR_IDS) s.gear[id] = int(gear[id], 0, 0, Math.min(GEAR[id].max, 100_000));

  const roster = isRecord(data.roster) ? data.roster : {};
  for (const [id, owned] of Object.entries(roster)) {
    if (!speciesOf(id) || !isRecord(owned)) continue;
    s.roster[id] = { level: int(owned.level, 1, 1, 100_000), stars: int(owned.stars, 0, 0, 5) };
  }
  s.team = [...new Set(list(data.team).filter((id): id is string => typeof id === 'string' && id in s.roster))].slice(0, 5);

  s.eggs = list(data.eggs)
    .filter((e): e is EggKind => typeof e === 'string' && (EGG_KINDS as readonly string[]).includes(e))
    .slice(0, EGG_HARD_LIMIT);
  const incubators = list(data.incubators).slice(0, MAX_INCUBATORS);
  s.incubators = (incubators.length > 0 ? incubators : [null]).map((slot) => {
    if (!isRecord(slot)) return null;
    const kind = oneOf(slot.kind, EGG_KINDS, 'pebble');
    const startedAt = num(slot.startedAt, createdAt);
    return { kind, startedAt, readyAt: Math.max(startedAt, num(slot.readyAt, startedAt)) };
  });

  const skills = isRecord(data.skills) ? data.skills : {};
  for (const id of SKILL_IDS) {
    const skill = isRecord(skills[id]) ? skills[id] : {};
    s.skills[id] = { readyAt: num(skill.readyAt, 0), activeUntil: num(skill.activeUntil, 0) };
  }
  s.frenzyCarry = num(data.frenzyCarry, 0, 0, 1);
  s.blessingUntil = num(data.blessingUntil, 0);

  const relics = isRecord(data.relics) ? data.relics : {};
  for (const id of RELIC_IDS) s.relics[id] = int(relics[id], 0, 0, Math.min(RELICS[id].max, 10_000));
  s.guardiansBeaten = [...new Set(list(data.guardiansBeaten).filter((d): d is number => Number.isInteger(d) && (d as number) > 0))];

  const daily = isRecord(data.daily) ? data.daily : {};
  s.daily = {
    claimDay: dayKey(daily.claimDay),
    claims: int(daily.claims, 0),
    questDay: dayKey(daily.questDay),
    quests: list(daily.quests)
      .filter(isRecord)
      .slice(0, 5)
      .map((q) => ({
        metric: oneOf(q.metric, QUEST_METRICS, 'taps'),
        target: int(q.target, 1, 1),
        progress: int(q.progress, 0),
        claimed: bool(q.claimed, false),
      })),
    bonusClaimed: bool(daily.bonusClaimed, false),
  };

  const achievements = isRecord(data.achievements) ? data.achievements : {};
  for (const id of ACHIEVEMENT_IDS) s.achievements[id] = int(achievements[id], 0, 0, 20);

  const stats = isRecord(data.stats) ? data.stats : {};
  for (const key of Object.keys(s.stats) as (keyof Stats)[]) s.stats[key] = num(stats[key], 0);

  const ads = isRecord(data.ads) ? data.ads : {};
  const counts = isRecord(ads.counts) ? ads.counts : {};
  s.ads = {
    day: dayKey(ads.day),
    counts: record(AD_PLACEMENTS, (p) => int(counts[p], 0)),
    total: int(ads.total, 0),
    lastInterstitialAt: num(ads.lastInterstitialAt, 0),
    lastRewardedAt: num(ads.lastRewardedAt, 0),
    interstitials: int(ads.interstitials, 0),
  };

  const shop = isRecord(data.shop) ? data.shop : {};
  s.shop = {
    entitlements: [
      ...new Set(list(shop.entitlements).filter((e): e is Entitlement => typeof e === 'string' && (ENTITLEMENTS as readonly string[]).includes(e))),
    ],
    settled: restoreSettled(list(shop.settled)),
    pending: typeof shop.pending === 'string' && shop.pending.length <= 64 ? shop.pending : null,
    starterBought: bool(shop.starterBought, false),
  };

  const settings = isRecord(data.settings) ? data.settings : {};
  s.settings = {
    sound: bool(settings.sound, true),
    haptics: bool(settings.haptics, true),
    numbers: oneOf(settings.numbers, ['short', 'scientific'] as const, 'short'),
    locale: oneOf(settings.locale, ['auto', 'en', 'th'] as const, 'auto'),
  };
  s.tutorial = [...new Set(list(data.tutorial).filter((t): t is string => typeof t === 'string'))].slice(0, 64);

  const offline = isRecord(data.offline) ? data.offline : null;
  s.offline = offline
    ? {
        seconds: num(offline.seconds, 0),
        ore: num(offline.ore, 0),
        eggs: list(offline.eggs).filter((e): e is EggKind => typeof e === 'string' && (EGG_KINDS as readonly string[]).includes(e)),
      }
    : null;
  return s;
}

const SETTLEMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

function restoreSettled(entries: unknown[]): Settled[] {
  const seen = new Set<string>();
  const out: Settled[] = [];
  for (const entry of entries) {
    // Early test saves listed only the ids.
    const e: Data = typeof entry === 'string' ? { id: entry } : isRecord(entry) ? entry : {};
    if (typeof e.id !== 'string' || !SETTLEMENT_ID.test(e.id) || seen.has(e.id)) continue;
    seen.add(e.id);
    const amounts: Record<string, number> = {};
    if (isRecord(e.amounts)) {
      for (const [currency, amount] of Object.entries(e.amounts)) {
        if (currency.length <= 32 && Number.isSafeInteger(amount) && amount !== 0) amounts[currency] = amount as number;
      }
    }
    out.push({ id: e.id, amounts, at: num(e.at, 0) });
  }
  return out.slice(-SETTLED_KEEP);
}

export function saveFormat(firstHp: (depth: number) => number): SaveFormat<GameState> {
  return {
    game: 'lodelings',
    version: SAVE_VERSION,
    migrations: {},
    restore: (data) => restoreState(data, firstHp),
  };
}
