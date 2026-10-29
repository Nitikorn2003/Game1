import { dayKeyOf, int, isRecord, num, recordOf } from '@game1/engine';

/** What a save remembers about the ads it showed today, as `state.ads`. */
export interface AdLedger<P extends string = string> {
  /** The day the counts are for; they start again at zero on a new day. */
  day: string | null;
  /** Rewarded ads watched today, per placement. */
  counts: Record<P, number>;
  /** Rewarded ads watched today, all placements together. */
  total: number;
  lastInterstitialAt: number;
  lastRewardedAt: number;
  /** Ad breaks shown today. */
  interstitials: number;
}

/** How many rewarded ads a player may watch in a day. */
export interface RewardedLimits<P extends string> {
  perPlacement: Readonly<Record<P, number>>;
  /** All placements together. */
  total: number;
}

/** When an ad break may come. Games add their own progress rule (Session.adBreaksEarned). */
export interface InterstitialRules {
  /** None in the first minutes of a session. */
  minSessionMs: number;
  /** Time between two ad breaks. */
  minGapMs: number;
  /** None soon after the player chose to watch a rewarded ad. */
  afterRewardedMs: number;
  maxPerDay: number;
}

export const INTERSTITIAL_DEFAULTS: InterstitialRules = {
  minSessionMs: 5 * 60_000,
  minGapMs: 5 * 60_000,
  afterRewardedMs: 2 * 60_000,
  maxPerDay: 10,
};

export function createAdLedger<P extends string>(placements: readonly P[]): AdLedger<P> {
  return { day: null, counts: recordOf(placements, () => 0), total: 0, lastInterstitialAt: 0, lastRewardedAt: 0, interstitials: 0 };
}

export function restoreAdLedger<P extends string>(data: unknown, placements: readonly P[]): AdLedger<P> {
  const ads = isRecord(data) ? data : {};
  const counts = isRecord(ads.counts) ? ads.counts : {};
  return {
    day: dayKeyOf(ads.day),
    counts: recordOf(placements, (p) => int(counts[p], 0)),
    total: int(ads.total, 0),
    lastInterstitialAt: num(ads.lastInterstitialAt, 0),
    lastRewardedAt: num(ads.lastRewardedAt, 0),
    interstitials: int(ads.interstitials, 0),
  };
}

function rollDay(ledger: AdLedger, day: string): void {
  if (ledger.day === day) return;
  ledger.day = day;
  ledger.total = 0;
  ledger.interstitials = 0;
  for (const p of Object.keys(ledger.counts)) ledger.counts[p] = 0;
}

/** Rewarded ads left today for this placement. */
export function adsLeft<P extends string>(ledger: AdLedger<P>, placement: P, day: string, limits: RewardedLimits<P>): number {
  const fresh = ledger.day !== day;
  const used = fresh ? 0 : ledger.counts[placement];
  const total = fresh ? 0 : ledger.total;
  return Math.max(0, Math.min(limits.perPlacement[placement] - used, limits.total - total));
}

/** Counts a rewarded ad the network confirmed. */
export function recordRewarded<P extends string>(ledger: AdLedger<P>, placement: P, now: number, day: string): void {
  rollDay(ledger, day);
  ledger.counts[placement] += 1;
  ledger.total += 1;
  ledger.lastRewardedAt = now;
}

/** Whether the timing allows an ad break now. The session also checks No Ad Breaks and the game's progress rule. */
export function interstitialTimely(ledger: AdLedger, now: number, day: string, sessionStartedAt: number, rules: InterstitialRules = INTERSTITIAL_DEFAULTS): boolean {
  if (now - sessionStartedAt < rules.minSessionMs) return false;
  if (now - ledger.lastInterstitialAt < rules.minGapMs) return false;
  if (now - ledger.lastRewardedAt < rules.afterRewardedMs) return false;
  const shownToday = ledger.day === day ? ledger.interstitials : 0;
  return shownToday < rules.maxPerDay;
}

export function recordInterstitial(ledger: AdLedger, now: number, day: string): void {
  rollDay(ledger, day);
  ledger.interstitials += 1;
  ledger.lastInterstitialAt = now;
}
