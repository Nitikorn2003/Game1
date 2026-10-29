import * as Shell from '@game1/shell';
import { ENTITLEMENTS, type AdPlacement, type Entitlement, type GameState } from './state.js';

/** Rewarded ads a player may watch in a day. */
export const AD_LIMITS: Shell.RewardedLimits<AdPlacement> = { perPlacement: { bonus: 5 }, total: 5 };
/** No ad breaks before the player has tapped this often. */
export const AD_BREAKS_AFTER_TAPS = 200;

export function coinsPerTap(state: GameState): number {
  return state.tapLevel + 1;
}

export function upgradeCost(state: GameState): number {
  return Math.round(20 * 1.5 ** state.tapLevel);
}

/** What a rewarded ad gives: fifty taps' worth. */
export function bonusCoins(state: GameState): number {
  return 50 * coinsPerTap(state);
}

export function tap(state: GameState): number {
  const coins = coinsPerTap(state);
  state.coins += coins;
  state.stats.taps += 1;
  return coins;
}

export function upgrade(state: GameState): boolean {
  const cost = upgradeCost(state);
  if (state.coins < cost) return false;
  state.coins -= cost;
  state.tapLevel += 1;
  return true;
}

export function hasEntitlement(state: GameState, id: Entitlement): boolean {
  return state.shop.entitlements.includes(id);
}

export function adsLeft(state: GameState, placement: AdPlacement, day: string): number {
  return Shell.adsLeft(state.ads, placement, day, AD_LIMITS);
}

export function adOffered(state: GameState, placement: AdPlacement, day: string): boolean {
  return adsLeft(state, placement, day) > 0;
}

/** Gives the reward of a rewarded ad. Call only after the ad network confirmed it. */
export function grantAdReward(state: GameState, placement: AdPlacement, now: number, day: string): boolean {
  if (!adOffered(state, placement, day)) return false;
  Shell.recordRewarded(state.ads, placement, now, day);
  state.coins += bonusCoins(state);
  return true;
}

/** Adds what a purchase settled into this save; negative after a refund. */
export function grantPurchase(state: GameState, amounts: Readonly<Record<string, number>>): void {
  state.coins += amounts.coins ?? 0;
}

export function setEntitlements(state: GameState, entitlements: readonly string[]): void {
  state.shop.entitlements = Shell.knownEntitlements(entitlements, ENTITLEMENTS);
}
