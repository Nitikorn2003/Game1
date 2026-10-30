/**
 * A scripted player for balancing and tests. It taps, uses skills, buys the upgrade with the
 * best damage per ore, hatches eggs, fights Guardians when it can win and resurfaces when a run
 * stalls. It plays like an attentive human, which makes its timings a target for real players.
 */
import { localDayKey } from '@game1/engine';
import * as C from './content.js';
import * as R from './rules.js';
import { createState, type GameState } from './state.js';

export interface BotOptions {
  tapsPerSecond: number;
  /** Resurface once no new depth was reached for this long (and Relic Dust is worth it). */
  stallSeconds: number;
  stepSeconds: number;
}

export const ATTENTIVE: BotOptions = { tapsPerSecond: 5, stallSeconds: 8 * 60, stepSeconds: 0.1 };

export interface Milestone {
  depth: number;
  seconds: number;
}

export interface BotReport {
  state: GameState;
  /** First time each depth was reached, in seconds since the start. */
  reached: Map<number, number>;
  resurfaces: { seconds: number; depth: number; dust: number }[];
  guardianLosses: number;
  nonFinite: string[];
}

export function newBotGame(seed = 1, now = Date.UTC(2026, 0, 1, 9)): GameState {
  return createState(now, seed, R.blockHp(1));
}

/** Plays `seconds` of continuous, active play. */
export function playActive(state: GameState, seconds: number, options = ATTENTIVE, report?: BotReport): BotReport {
  const out: BotReport = report ?? { state, reached: new Map([[1, 0]]), resurfaces: [], guardianLosses: 0, nonFinite: [] };
  const start = state.lastSeenAt;
  let tapCarry = 0;
  let lastNewDepthAt = state.lastSeenAt;
  let farmingSince: number | null = null;
  const steps = Math.round(seconds / options.stepSeconds);
  const elapsedBase = out.reached.get(-1) ?? 0;
  for (let i = 1; i <= steps; i++) {
    const now = start + i * options.stepSeconds * 1000;
    const c = R.ctx(now, localDayKey(now, 0));
    R.refreshQuests(state, c.day);
    R.step(state, c, options.stepSeconds);
    tapCarry += options.tapsPerSecond * options.stepSeconds;
    while (tapCarry >= 1) {
      tapCarry -= 1;
      R.tap(state, c);
    }
    for (const id of C.SKILL_IDS) R.castSkill(state, c, id);
    if (i % Math.max(1, Math.round(1 / options.stepSeconds)) === 0) {
      housekeeping(state, c, options);
      if (state.farming && !state.guardian) {
        farmingSince ??= now;
        if (canBeatGuardian(state, now, options) || now - farmingSince > 90_000) {
          R.startGuardian(state, c);
          farmingSince = null;
        }
      }
    }
    for (const e of c.events) {
      if (e.type === 'descend' && !out.reached.has(e.depth)) {
        out.reached.set(e.depth, elapsedBase + (now - start) / 1000);
        lastNewDepthAt = now;
      }
      if (e.type === 'descend') lastNewDepthAt = Math.max(lastNewDepthAt, now);
      if (e.type === 'guardian_lost') out.guardianLosses += 1;
    }
    if (now - lastNewDepthAt > options.stallSeconds * 1000 && R.resurfaceDust(state) >= Math.max(5, state.lifetimeDust * 0.5)) {
      const depth = state.maxDepth;
      const dust = R.resurface(state, now);
      out.resurfaces.push({ seconds: elapsedBase + (now - start) / 1000, depth, dust });
      spendDust(state);
      lastNewDepthAt = now;
    }
  }
  out.reached.set(-1, elapsedBase + seconds);
  checkFinite(state, out);
  return out;
}

function canBeatGuardian(state: GameState, now: number, options: BotOptions): boolean {
  const target = R.guardianElement(state.depth);
  const perSecond = R.teamDps(state, now, target) + R.tapDamage(state, now) * options.tapsPerSecond * (1 + R.critChance(state) * (C.CRIT_MULTIPLIER - 1));
  return perSecond * R.guardianSeconds(state) >= R.guardianHp(state.depth) * 1.05;
}

function housekeeping(state: GameState, c: R.Ctx, options: BotOptions): void {
  for (let slot = 0; slot < state.incubators.length; slot++) if (R.eggReady(state, slot, c.now)) R.hatch(state, c, slot);
  arrangeTeam(state);
  R.claimDaily(state, c);
  state.daily.quests.forEach((_, i) => R.claimQuest(state, i));
  R.claimQuestBonus(state, c.now);
  for (const id of C.ACHIEVEMENT_IDS) R.claimAchievement(state, id);
  if (R.nextIncubatorPrice(state) !== null) R.buyIncubator(state, c.now);
  else if (state.gems >= 200 && state.eggs.length < 3) R.buyEgg(state, 'geode', c.now);
  for (let guard = 0; guard < 50 && buyBest(state, c.now, options); guard++);
}

function arrangeTeam(state: GameState): void {
  const ranked = Object.entries(state.roster)
    .map(([id, owned]) => ({ id, dps: R.memberDps(id, owned.level, owned.stars) }))
    .sort((a, b) => b.dps - a.dps)
    .slice(0, R.teamSlots(state))
    .map((m) => m.id);
  state.team = ranked;
}

type Option = { gain: number; cost: number; buy: () => number };

/** Buys the single best upgrade by damage gained per ore. Returns false when nothing is affordable. */
function buyBest(state: GameState, now: number, options: BotOptions): boolean {
  const taps = options.tapsPerSecond;
  const critFactor = 1 + R.critChance(state) * (C.CRIT_MULTIPLIER - 1);
  const team = R.teamDps(state, now, null);
  const tapNow = R.tapDamage(state, now);
  const total = team + tapNow * taps * critFactor;
  const opts: Option[] = [];
  for (const id of state.team) {
    const owned = state.roster[id];
    if (!owned) continue;
    const scale = team > 0 ? team / state.team.reduce((sum, m) => sum + R.memberDps(m, state.roster[m]?.level ?? 0, state.roster[m]?.stars ?? 0), 0) : 1;
    const gain = (R.memberDps(id, owned.level + 1, owned.stars) - R.memberDps(id, owned.level, owned.stars)) * scale;
    opts.push({ gain, cost: R.levelCost(state, id, 1), buy: () => R.levelUp(state, id, 1) });
  }
  const pickGain = (R.pickDamage(state.gear.pick + 1) - R.pickDamage(state.gear.pick)) * (tapNow / Math.max(R.pickDamage(state.gear.pick), 1e-9)) * taps * critFactor;
  opts.push({ gain: pickGain * 0.6, cost: R.gearCost(state, 'pick', 1), buy: () => R.buyGear(state, 'pick', 1) });
  opts.push({ gain: tapNow * taps * 0.01 * (C.CRIT_MULTIPLIER - 1), cost: R.gearCost(state, 'lamp', 1), buy: () => R.buyGear(state, 'lamp', 1) });
  opts.push({ gain: 0.02 * team * taps * critFactor * 0.6, cost: R.gearCost(state, 'echo', 1), buy: () => R.buyGear(state, 'echo', 1) });
  opts.push({ gain: (0.15 / (1 + 0.15 * state.gear.cart)) * total * 0.5, cost: R.gearCost(state, 'cart', 1), buy: () => R.buyGear(state, 'cart', 1) });
  let best: Option | null = null;
  for (const o of opts) {
    if (!(o.cost < Infinity) || o.gain <= 0) continue;
    if (!best || o.gain / o.cost > best.gain / best.cost) best = o;
  }
  if (!best || best.cost > state.ore) return false;
  return best.buy() > 0;
}

function spendDust(state: GameState): void {
  const order: C.RelicId[] = ['heart', 'pick', 'map', 'hourglass', 'bane', 'fortune', 'hearth'];
  for (let guard = 0; guard < 500; guard++) {
    let cheapest: C.RelicId | null = null;
    for (const id of order) {
      const cost = R.relicCost(state, id);
      if (cost <= state.dust && (cheapest === null || cost < R.relicCost(state, cheapest))) cheapest = id;
    }
    if (cheapest === null || !R.buyRelic(state, cheapest)) return;
  }
}

function checkFinite(state: GameState, out: BotReport): void {
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'number' && !Number.isFinite(value)) out.nonFinite.push(path);
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
  };
  walk(state, 'state');
}
