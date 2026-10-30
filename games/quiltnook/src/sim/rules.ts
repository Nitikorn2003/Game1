import { Rng, daysBetween, hashString } from '@game1/engine';
import * as Shell from '@game1/shell';
import * as C from './content.js';
import * as Q from './quilt.js';
import { isBestOf, type Commission, type GameState, type QuiltResult } from './state.js';

/** Rewarded ads a player may watch in a day. */
export const AD_LIMITS: Shell.RewardedLimits<C.AdPlacement> = { perPlacement: { second_chance: 5, free_spools: 3, double_spools: 5 }, total: 10 };

/** The rewarded ads and the shell know a quilt by its slot: 0 for the endless quilt, 1 for the daily one. */
export function modeOfSlot(slot: number): Q.Mode {
  return slot === 1 ? 'daily' : 'endless';
}
export function slotOf(mode: Q.Mode): number {
  return mode === 'daily' ? 1 : 0;
}

// ---------------------------------------------------------------------------------------
// Quilts

export function dailyTarget(day: string): number {
  return C.DAILY_TARGETS[hashString(`quiltnook:daily-target:${day}`) % C.DAILY_TARGETS.length] ?? C.DAILY_TARGETS[0];
}

/** Everyone starts the same quilt on the same day; the patches then follow how each quilt is sewn. */
export function dailySeed(day: string): number {
  return hashString(`quiltnook:daily-patches:${day}`);
}

function nextSeed(s: GameState): number {
  const rng = new Rng(s.rng);
  const seed = rng.int(0x1_0000_0000);
  s.rng = rng.state;
  return seed;
}

/**
 * The quilt to play in a mode: the one in progress, or a new one. A daily quilt left over from
 * another day is finished first; it no longer counts for the daily target.
 */
export function openQuilt(s: GameState, mode: Q.Mode, today: string): Q.Quilt {
  const current = s.quilts[mode];
  if (current && (mode === 'endless' || current.day === today)) return current;
  if (current) finishQuilt(s, mode);
  const quilt = mode === 'daily' ? Q.newQuilt('daily', today, dailySeed(today)) : Q.newQuilt('endless', null, nextSeed(s));
  s.quilts[mode] = quilt;
  s.result = null;
  return quilt;
}

export interface Placed {
  stitch: Q.Stitch;
  /** This patch reached the daily target. */
  dailyDone: boolean;
}

export function place(s: GameState, mode: Q.Mode, slot: number, x: number, y: number, today: string): Placed | null {
  const q = s.quilts[mode];
  if (!q) return null;
  const stitch = Q.place(q, slot, x, y);
  if (!stitch) return null;
  s.spools += stitch.spools;
  s.hintDone = true;
  let dailyDone = false;
  if (q.mode === 'daily' && q.day === today && s.daily.lastDone !== today && q.score >= dailyTarget(today)) {
    completeDaily(s, today);
    dailyDone = true;
  }
  return { stitch, dailyDone };
}

function completeDaily(s: GameState, day: string): void {
  const last = s.daily.lastDone;
  s.daily.streak = last !== null && daysBetween(last, day) === 1 ? s.daily.streak + 1 : 1;
  s.daily.bestStreak = Math.max(s.daily.bestStreak, s.daily.streak);
  s.daily.lastDone = day;
  s.spools += C.DAILY_SPOOLS;
  addProgress(s, 'daily', 1);
}

export function dailyDoneToday(s: GameState, today: string): boolean {
  return s.daily.lastDone === today;
}

/** The daily streak as it stands today: it ends when a day was missed. */
export function dailyStreak(s: GameState, today: string): number {
  const last = s.daily.lastDone;
  return last !== null && daysBetween(last, today) <= 1 ? s.daily.streak : 0;
}

/** Whether the quilt has run out of room: no patch in the tray fits. */
export function stuck(s: GameState, mode: Q.Mode): boolean {
  const q = s.quilts[mode];
  return q !== null && !Q.canMove(q);
}

/**
 * Ends a quilt: its score pays spools, and what it did counts for the stats and commissions.
 * A quilt with nothing sewn just goes away.
 */
export function finishQuilt(s: GameState, mode: Q.Mode): QuiltResult | null {
  const q = s.quilts[mode];
  s.quilts[mode] = null;
  if (!q || q.patches === 0) return null;
  const spools = Math.floor(q.score / C.POINTS_PER_SPOOL);
  s.spools += spools;
  const newBest = mode === 'endless' && q.score > s.best;
  if (mode === 'endless') s.best = Math.max(s.best, q.score);
  const st = s.stats;
  st.quilts += 1;
  st.patches += q.patches;
  st.seams += q.seams;
  st.perfect += q.perfect;
  st.doubles += q.doubles;
  st.clears += q.clears;
  st.bestStreak = Math.max(st.bestStreak, q.bestStreak);
  addProgress(s, 'seams', q.seams);
  addProgress(s, 'perfect', q.perfect);
  addProgress(s, 'doubles', q.doubles);
  addProgress(s, 'patches', q.patches);
  addProgress(s, 'score', q.score);
  addProgress(s, 'streak', q.bestStreak);
  s.result = { mode, score: q.score, newBest, spools, doubled: false };
  return s.result;
}

// ---------------------------------------------------------------------------------------
// Tools

/** What Unpick costs right now: its price, and the spools the patch it takes back had earned. */
export function unpickCost(s: GameState, mode: Q.Mode): number | null {
  const q = s.quilts[mode];
  if (!q?.undo) return null;
  return C.TOOL_COSTS.unpick + q.spools - q.undo.spools;
}

export function canUse(s: GameState, mode: Q.Mode, tool: C.Tool): boolean {
  const q = s.quilts[mode];
  if (!q) return false;
  if (tool === 'unpick') {
    const cost = unpickCost(s, mode);
    return cost !== null && s.spools >= cost;
  }
  if (tool === 'snip' && q.board.every((square) => square < 0)) return false;
  return s.spools >= C.TOOL_COSTS[tool];
}

export function unpick(s: GameState, mode: Q.Mode): boolean {
  const q = s.quilts[mode];
  if (!q || !canUse(s, mode, 'unpick')) return false;
  const earned = Q.unpick(q) ?? 0;
  s.spools -= C.TOOL_COSTS.unpick + earned;
  return true;
}

export function newPatches(s: GameState, mode: Q.Mode): boolean {
  const q = s.quilts[mode];
  if (!q || !canUse(s, mode, 'newPatches')) return false;
  Q.newPatches(q);
  s.spools -= C.TOOL_COSTS.newPatches;
  return true;
}

export function snip(s: GameState, mode: Q.Mode, x: number, y: number): boolean {
  const q = s.quilts[mode];
  if (!q || !canUse(s, mode, 'snip') || !Q.snip(q, x, y)) return false;
  s.spools -= C.TOOL_COSTS.snip;
  return true;
}

// ---------------------------------------------------------------------------------------
// Commissions

export function commissionTarget(c: Commission): number {
  return C.COMMISSION_TARGETS[c.kind][c.tier] ?? 0;
}

export function commissionReward(c: Commission): number {
  return C.COMMISSION_REWARDS[c.tier] ?? 0;
}

export function commissionDone(c: Commission): boolean {
  return c.progress >= commissionTarget(c);
}

function addProgress(s: GameState, kind: C.CommissionKind, amount: number): void {
  for (const c of s.commissions) {
    if (c.kind === kind) c.progress = isBestOf(kind) ? Math.max(c.progress, amount) : c.progress + amount;
  }
}

/** Pays a finished commission and puts a new one, of another kind, in its place. */
export function claimCommission(s: GameState, index: number): number {
  const c = s.commissions[index];
  if (!c || !commissionDone(c)) return 0;
  const reward = commissionReward(c);
  s.spools += reward;
  s.commissionsDone += 1;
  const taken = new Set(s.commissions.map((other) => other.kind));
  const kinds = C.COMMISSION_KINDS.filter((kind) => !taken.has(kind));
  const rng = new Rng(s.rng);
  const kind = rng.pick(kinds);
  s.rng = rng.state;
  s.commissions[index] = { kind, tier: Math.min(2, Math.floor(s.commissionsDone / C.COMMISSIONS_PER_TIER)), progress: 0 };
  return reward;
}

// ---------------------------------------------------------------------------------------
// Fabrics

export function hasEntitlement(s: GameState, id: C.Entitlement): boolean {
  return s.shop.entitlements.includes(id);
}

export function ownsFabric(s: GameState, id: C.FabricSetId): boolean {
  return (
    C.FABRIC_COSTS[id] === 0 ||
    s.fabrics.bought.includes(id) ||
    hasEntitlement(s, 'fabric_chest') ||
    (id === C.SEWING_KIT_SET && hasEntitlement(s, 'sewing_kit'))
  );
}

/** The set the patches are drawn in: the chosen one, unless a refund took it back. */
export function fabricInUse(s: GameState): C.FabricSetId {
  return ownsFabric(s, s.fabrics.chosen) ? s.fabrics.chosen : 'cottage';
}

/** Buys a fabric set with spools, and starts using it. */
export function buyFabric(s: GameState, id: C.FabricSetId): boolean {
  if (ownsFabric(s, id) || s.spools < C.FABRIC_COSTS[id]) return false;
  s.spools -= C.FABRIC_COSTS[id];
  s.fabrics.bought.push(id);
  s.fabrics.chosen = id;
  return true;
}

export function chooseFabric(s: GameState, id: C.FabricSetId): boolean {
  if (!ownsFabric(s, id)) return false;
  s.fabrics.chosen = id;
  return true;
}

/** The Sewing Kit is offered until its fabric set is owned some way. */
export function sewingKitOffered(s: GameState): boolean {
  return !ownsFabric(s, C.SEWING_KIT_SET);
}

// ---------------------------------------------------------------------------------------
// Ads and purchases

export function adsLeft(s: GameState, placement: C.AdPlacement, day: string): number {
  return Shell.adsLeft(s.ads, placement, day, AD_LIMITS);
}

export function adOffered(s: GameState, placement: C.AdPlacement, day: string, mode: Q.Mode): boolean {
  if (adsLeft(s, placement, day) <= 0) return false;
  switch (placement) {
    case 'second_chance': {
      const q = s.quilts[mode];
      return q !== null && !q.secondChanceUsed && !Q.canMove(q);
    }
    case 'free_spools':
      return true;
    case 'double_spools':
      return s.result !== null && !s.result.doubled && s.result.spools > 0;
  }
}

/** Gives the reward of a rewarded ad. Call only after the ad network confirmed it. */
export function grantAdReward(s: GameState, placement: C.AdPlacement, now: number, day: string, mode: Q.Mode): boolean {
  if (!adOffered(s, placement, day, mode)) return false;
  switch (placement) {
    case 'second_chance': {
      const q = s.quilts[mode];
      if (!q || !Q.secondChance(q)) return false;
      break;
    }
    case 'free_spools':
      s.spools += C.FREE_SPOOLS;
      break;
    case 'double_spools':
      if (!s.result) return false;
      s.spools += s.result.spools;
      s.result.doubled = true;
      break;
  }
  Shell.recordRewarded(s.ads, placement, now, day);
  return true;
}

/** Adds what a purchase settled into this save; negative after a refund. */
export function grantPurchase(s: GameState, amounts: Readonly<Record<string, number>>): void {
  s.spools += amounts.spools ?? 0;
}

export function setEntitlements(s: GameState, entitlements: readonly string[]): void {
  s.shop.entitlements = Shell.knownEntitlements(entitlements, C.ENTITLEMENTS);
}

export function adBreaksEarned(s: GameState): boolean {
  return s.stats.quilts >= C.AD_BREAKS_AFTER_QUILTS;
}
