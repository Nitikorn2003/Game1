import { daysBetween } from '@game1/engine';
import * as Shell from '@game1/shell';
import { botAim, type Aim } from './bot.js';
import * as C from './content.js';
import { LEVELS_PER_ZONE, ZONES, levelsOf, seedOf, zoneOf, type ZoneId } from './levels.js';
import * as O from './round.js';
import { levelOf, type Current, type GameState, type RoundKey, type RoundResult } from './state.js';

/** Rewarded ads a player may watch in a day. */
export const AD_LIMITS: Shell.RewardedLimits<C.AdPlacement> = {
  perPlacement: { more_shots: 5, tool: 6, double_coins: 5, free_coins: 3 },
  total: 15,
};

// ---------------------------------------------------------------------------------------
// The meadow

/** The next level to reach: every level before it has been. */
export function nextLevel(s: GameState): number {
  return s.stars.length + 1;
}

export function levelOpen(s: GameState, n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= nextLevel(s);
}

/** The stars a level was reached with, 0 for one not reached yet. */
export function starsOf(s: GameState, n: number): number {
  return s.stars[n - 1] ?? 0;
}

export function totalStars(s: GameState): number {
  return s.stars.reduce((sum, stars) => sum + stars, 0);
}

export function zoneOpen(s: GameState, zone: ZoneId): boolean {
  return levelOpen(s, levelsOf(zone)[0] ?? 1);
}

/** Every level of the zone reached: its flower has bloomed. */
export function zoneDone(s: GameState, zone: ZoneId): boolean {
  return s.stars.length >= ZONES.indexOf(zone) * LEVELS_PER_ZONE + LEVELS_PER_ZONE;
}

export function zoneStars(s: GameState, zone: ZoneId): number {
  return levelsOf(zone).reduce((sum, n) => sum + starsOf(s, n), 0);
}

// ---------------------------------------------------------------------------------------
// Rounds

export const isSame = (a: RoundKey, b: RoundKey): boolean => a.mode === b.mode && a.level === b.level && a.day === b.day;

function begin(s: GameState, key: RoundKey, seed: number): Current {
  const current: Current = { ...key, round: O.startRound(levelOf(key), seed) };
  s.stats.rounds += 1;
  s.current = current;
  s.result = null;
  return current;
}

/** A try at a level: the round in progress there, or a new one. A round in progress at another level is let go. */
export function startLevel(s: GameState, n: number): Current | null {
  if (!levelOpen(s, n)) return null;
  const key: RoundKey = { mode: 'meadow', level: n, day: null };
  if (s.current && isSame(s.current, key)) return s.current;
  return begin(s, key, seedOf(`level:${String(n)}`, s.stats.rounds));
}

export function dailyDoneToday(s: GameState, today: string): boolean {
  return s.daily.lastDone === today;
}

/** The daily streak as it stands today: it ends when a day was missed. */
export function dailyStreak(s: GameState, today: string): number {
  const last = s.daily.lastDone;
  return last !== null && daysBetween(last, today) <= 1 ? s.daily.streak : 0;
}

/** What today's daily meadow pays: more for each day of the streak it carries on. */
export function dailyPay(s: GameState, today: string): number {
  const streak = dailyStreak(s, today) + (dailyDoneToday(s, today) ? 0 : 1);
  return C.DAILY_COINS + C.STREAK_COINS * Math.min(C.STREAK_DAYS, Math.max(0, streak - 1));
}

/**
 * Today's daily meadow: the round in progress, or a new try. Everyone's first try of a day has
 * the same colours. Once today's is reached there is none until tomorrow.
 */
export function openDaily(s: GameState, today: string): Current | null {
  if (dailyDoneToday(s, today)) return null;
  const key: RoundKey = { mode: 'daily', level: 0, day: today };
  if (s.current && isSame(s.current, key)) return s.current;
  if (s.daily.day !== today) {
    s.daily.day = today;
    s.daily.tries = 0;
  }
  const seed = seedOf(`daily:${today}`, s.daily.tries);
  s.daily.tries += 1;
  return begin(s, key, seed);
}

/** The level of the round in progress. */
export function currentLevel(s: GameState): O.Level | null {
  return s.current ? levelOf(s.current) : null;
}

/** Out of pollen, or a bud at Pip, with goals still to reach: five more pollen, or the round ends. */
export function isStuck(s: GameState): boolean {
  return s.current !== null && O.isStuck(s.current.round, levelOf(s.current));
}

/** What a shot did: how it played out, and the result when it reached the goals. */
export interface Shot {
  shot: O.Shot;
  result: RoundResult | null;
}

function tally(s: GameState, shot: O.Shot): void {
  for (const step of shot.steps) s.stats.buds += step.popped.length + step.fallen.length;
  s.stats.bees += shot.freed;
}

/** Counts the daily meadow of `day` as reached, unless that day or a later one already is. */
function completeDaily(s: GameState, day: string): boolean {
  const last = s.daily.lastDone;
  if (last !== null && daysBetween(last, day) <= 0) return false;
  s.daily.streak = last !== null && daysBetween(last, day) === 1 ? s.daily.streak + 1 : 1;
  s.daily.bestStreak = Math.max(s.daily.bestStreak, s.daily.streak);
  s.daily.lastDone = day;
  s.stats.dailies += 1;
  return true;
}

/**
 * Ends the round in progress. One that reached its goals pays: a level reached for the first
 * time a base and more for each star, again only for the stars it did not have, and the last
 * level of a zone a bonus and a tool of each kind; the daily meadow, more for each day of a streak.
 */
function finish(s: GameState, c: Current, won: boolean): RoundResult {
  const level = levelOf(c);
  const r = c.round;
  const result: RoundResult = {
    mode: c.mode,
    level: c.level,
    day: c.day,
    won,
    stars: 0,
    before: 0,
    shotsLeft: r.shotsLeft,
    pay: 0,
    doubled: false,
    zone: null,
    zoneCoins: 0,
    streak: 0,
  };
  s.current = null;
  if (won) {
    s.stats.won += 1;
    result.stars = O.starsFor(r, level);
    if (c.mode === 'meadow') {
      const tip = tipOf(c.level);
      if (tip) seeTip(s, tip);
      result.before = starsOf(s, c.level);
      if (c.level === nextLevel(s)) {
        s.stars.push(result.stars);
        result.pay = C.LEVEL_COINS + C.STAR_COINS * result.stars;
        const zone = zoneOf(c.level);
        if (zone && c.level % LEVELS_PER_ZONE === 0) {
          result.zone = zone;
          result.zoneCoins = C.ZONE_COINS;
          for (const tool of C.TOOLS) s.tools[tool] = Math.min(C.MAX_TOOLS, s.tools[tool] + 1);
        }
      } else {
        s.stars[c.level - 1] = Math.max(result.before, result.stars);
        result.pay = C.STAR_COINS * Math.max(0, result.stars - result.before);
      }
    } else if (c.day !== null && completeDaily(s, c.day)) {
      result.streak = s.daily.streak;
      result.pay = C.DAILY_COINS + C.STREAK_COINS * Math.min(C.STREAK_DAYS, s.daily.streak - 1);
    }
    s.coins += result.pay + result.zoneCoins;
  }
  s.result = result;
  return result;
}

/** Whether a tool can be shot now: a round going on, and one in the pouch. */
export function canShoot(s: GameState, tool: C.Tool | null = null): boolean {
  return s.current !== null && !isStuck(s) && (tool === null || s.tools[tool] > 0);
}

/**
 * Shoots at an angle: the pollen in hand, or the jar's bomb, or with `tool` a tool from the
 * pouch, which takes no pollen. Null when nothing can be shot.
 */
export function shoot(s: GameState, angle: number, tool: C.Tool | null = null): Shot | null {
  const c = s.current;
  if (!c || !canShoot(s, tool)) return null;
  const shot = O.shoot(c.round, levelOf(c), angle, tool);
  if (!shot) return null;
  if (tool) {
    s.tools[tool] -= 1;
    s.stats.toolsUsed += 1;
  }
  if (shot.kind === 'pollen') s.stats.shots += 1;
  tally(s, shot);
  return { shot, result: shot.won ? finish(s, c, true) : null };
}

/** Swaps the pollen in hand for the next. */
export function swapPollen(s: GameState): boolean {
  return s.current !== null && !isStuck(s) && O.swapQueue(s.current.round);
}

/** The shot to show a player who has not shot for a while. */
export function hintAim(s: GameState): Aim | null {
  return s.current && !isStuck(s) ? botAim(s.current.round, levelOf(s.current)) : null;
}

/** Buys one of a tool for the pouch with honey. */
export function buyTool(s: GameState, tool: C.Tool): boolean {
  if (s.coins < C.TOOL_COSTS[tool] || s.tools[tool] >= C.MAX_TOOLS) return false;
  s.coins -= C.TOOL_COSTS[tool];
  s.tools[tool] += 1;
  return true;
}

function addShots(s: GameState): boolean {
  const c = s.current;
  if (!c || !O.addShots(c.round, levelOf(c))) return false;
  s.stats.continues += 1;
  // A bee in the buds blown away flies free too, which can reach the goals.
  if (O.isWon(c.round, levelOf(c))) finish(s, c, true);
  return true;
}

/** Five more pollen for a round that ran out, with honey. */
export function buyMoreShots(s: GameState): boolean {
  if (!isStuck(s) || s.coins < C.MORE_SHOTS_COST) return false;
  s.coins -= C.MORE_SHOTS_COST;
  return addShots(s);
}

/** Ends the round in progress without reaching its goals. */
export function giveUp(s: GameState): RoundResult | null {
  return s.current ? finish(s, s.current, false) : null;
}

// ---------------------------------------------------------------------------------------
// Notes on what is new

/** The note a level brings: the first level of each new thing has one. */
export function tipOf(level: number): C.TipId | null {
  return C.TIPS.find((tip) => C.TIP_LEVELS[tip] === level) ?? null;
}

/** The note to show on a round, until it has been seen. */
export function tipFor(s: GameState, key: RoundKey): C.TipId | null {
  const tip = key.mode === 'meadow' ? tipOf(key.level) : null;
  return tip && !s.tips.includes(tip) ? tip : null;
}

export function seeTip(s: GameState, tip: C.TipId): boolean {
  if (s.tips.includes(tip)) return false;
  s.tips.push(tip);
  return true;
}

// ---------------------------------------------------------------------------------------
// Looks

export function hasEntitlement(s: GameState, id: C.Entitlement): boolean {
  return s.shop.entitlements.includes(id);
}

export const LOOKS: readonly C.LookId[] = [...C.SKIES, ...C.HATS];

export function isHat(id: C.LookId): id is C.Hat {
  return (C.HATS as readonly string[]).includes(id);
}

export function ownsLook(s: GameState, id: C.LookId): boolean {
  return (
    C.LOOK_COSTS[id] === 0 ||
    s.looks.bought.includes(id) ||
    hasEntitlement(s, 'meadow_collection') ||
    (id === C.KEEPER_KIT_HAT && hasEntitlement(s, 'keeper_kit'))
  );
}

/** The sky and the hat drawn: the chosen ones, unless a refund took them back. */
export function skyInUse(s: GameState): C.Sky {
  return ownsLook(s, s.looks.sky) ? s.looks.sky : 'morning';
}
export function hatInUse(s: GameState): C.Hat {
  return ownsLook(s, s.looks.hat) ? s.looks.hat : 'leaf';
}

export function chooseLook(s: GameState, id: C.LookId): boolean {
  if (!ownsLook(s, id)) return false;
  if (isHat(id)) s.looks.hat = id;
  else s.looks.sky = id;
  return true;
}

/** Buys a look with honey, and starts using it. */
export function buyLook(s: GameState, id: C.LookId): boolean {
  if (ownsLook(s, id) || s.coins < C.LOOK_COSTS[id]) return false;
  s.coins -= C.LOOK_COSTS[id];
  s.looks.bought.push(id);
  return chooseLook(s, id);
}

/** The Keeper's Kit is offered until its hat is owned some way, the Meadow Collection until every look is. */
export function keeperKitOffered(s: GameState): boolean {
  return !ownsLook(s, C.KEEPER_KIT_HAT);
}
export function collectionOffered(s: GameState): boolean {
  return LOOKS.some((id) => !ownsLook(s, id));
}

// ---------------------------------------------------------------------------------------
// Ads and purchases

/** A tool ad knows its tool by its slot: its place in the list of tools. */
export function slotOfTool(tool: C.Tool): number {
  return C.TOOLS.indexOf(tool);
}
export function toolOfSlot(slot: number): C.Tool | null {
  return C.TOOLS[slot] ?? null;
}

export function adsLeft(s: GameState, placement: C.AdPlacement, day: string): number {
  return Shell.adsLeft(s.ads, placement, day, AD_LIMITS);
}

export function adOffered(s: GameState, placement: C.AdPlacement, day: string, slot: number): boolean {
  if (adsLeft(s, placement, day) <= 0) return false;
  switch (placement) {
    case 'more_shots':
      return isStuck(s);
    case 'tool': {
      const tool = toolOfSlot(slot);
      return tool !== null && s.current !== null && s.tools[tool] < C.MAX_TOOLS;
    }
    case 'double_coins':
      return s.result !== null && s.result.won && !s.result.doubled && s.result.pay > 0;
    case 'free_coins':
      return true;
  }
}

/** Gives the reward of a rewarded ad. Call only after the ad network confirmed it. */
export function grantAdReward(s: GameState, placement: C.AdPlacement, now: number, day: string, slot: number): boolean {
  if (!adOffered(s, placement, day, slot)) return false;
  switch (placement) {
    case 'more_shots':
      if (!addShots(s)) return false;
      break;
    case 'tool': {
      const tool = toolOfSlot(slot);
      if (!tool) return false;
      s.tools[tool] += 1;
      break;
    }
    case 'double_coins':
      if (!s.result) return false;
      s.coins += s.result.pay;
      s.result.doubled = true;
      break;
    case 'free_coins':
      s.coins += C.FREE_COINS;
      break;
  }
  Shell.recordRewarded(s.ads, placement, now, day);
  return true;
}

/** Adds what a purchase settled into this save; negative after a refund, which never takes a pouch below empty. */
export function grantPurchase(s: GameState, amounts: Readonly<Record<string, number>>): void {
  s.coins += amounts.coins ?? 0;
  for (const tool of C.TOOLS) s.tools[tool] = Math.max(0, Math.min(C.MAX_TOOLS, s.tools[tool] + (amounts[tool] ?? 0)));
}

export function setEntitlements(s: GameState, entitlements: readonly string[]): void {
  s.shop.entitlements = Shell.knownEntitlements(entitlements, C.ENTITLEMENTS);
}

export function adBreaksEarned(s: GameState): boolean {
  return s.stats.won >= C.AD_BREAKS_AFTER_WINS;
}
