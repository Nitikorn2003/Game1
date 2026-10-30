import { daysBetween } from '@game1/engine';
import * as Shell from '@game1/shell';
import { hasMove, type Move } from './board.js';
import { botMove } from './bot.js';
import * as C from './content.js';
import * as D from './dive.js';
import { LEVELS_PER_ZONE, ZONES, levelsOf, seedOf, zoneOf, type ZoneId } from './levels.js';
import { levelOf, type Current, type DiveKey, type DiveResult, type GameState } from './state.js';

/** Rewarded ads a player may watch in a day. */
export const AD_LIMITS: Shell.RewardedLimits<C.AdPlacement> = {
  perPlacement: { more_moves: 5, tool: 6, double_coins: 5, free_coins: 3 },
  total: 15,
};

// ---------------------------------------------------------------------------------------
// The reef

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

/** Every level of the zone reached: its creature has come home. */
export function zoneDone(s: GameState, zone: ZoneId): boolean {
  return s.stars.length >= ZONES.indexOf(zone) * LEVELS_PER_ZONE + LEVELS_PER_ZONE;
}

export function zoneStars(s: GameState, zone: ZoneId): number {
  return levelsOf(zone).reduce((sum, n) => sum + starsOf(s, n), 0);
}

// ---------------------------------------------------------------------------------------
// Dives

export const isSame = (a: DiveKey, b: DiveKey): boolean => a.mode === b.mode && a.level === b.level && a.day === b.day;

function begin(s: GameState, key: DiveKey, seed: number): Current {
  const current: Current = { ...key, dive: D.startDive(levelOf(key), seed) };
  s.stats.dives += 1;
  s.current = current;
  s.result = null;
  return current;
}

/** A try at a level: the dive in progress there, or a new one. A dive in progress at another level is let go. */
export function startLevel(s: GameState, n: number): Current | null {
  if (!levelOpen(s, n)) return null;
  const key: DiveKey = { mode: 'reef', level: n, day: null };
  if (s.current && isSame(s.current, key)) return s.current;
  return begin(s, key, seedOf(`level:${String(n)}`, s.stats.dives));
}

export function dailyDoneToday(s: GameState, today: string): boolean {
  return s.daily.lastDone === today;
}

/** The daily streak as it stands today: it ends when a day was missed. */
export function dailyStreak(s: GameState, today: string): number {
  const last = s.daily.lastDone;
  return last !== null && daysBetween(last, today) <= 1 ? s.daily.streak : 0;
}

/** What today's daily dive pays: more for each day of the streak it carries on. */
export function dailyPay(s: GameState, today: string): number {
  const streak = dailyStreak(s, today) + (dailyDoneToday(s, today) ? 0 : 1);
  return C.DAILY_COINS + C.STREAK_COINS * Math.min(C.STREAK_DAYS, Math.max(0, streak - 1));
}

/**
 * Today's daily dive: the one in progress, or a new try. Everyone's first try of a day has the
 * same board. Once today's dive is reached there is none until tomorrow.
 */
export function openDaily(s: GameState, today: string): Current | null {
  if (dailyDoneToday(s, today)) return null;
  const key: DiveKey = { mode: 'daily', level: 0, day: today };
  if (s.current && isSame(s.current, key)) return s.current;
  if (s.daily.day !== today) {
    s.daily.day = today;
    s.daily.tries = 0;
  }
  const seed = seedOf(`daily:${today}`, s.daily.tries);
  s.daily.tries += 1;
  return begin(s, key, seed);
}

/** The level of the dive in progress. */
export function currentLevel(s: GameState): D.Level | null {
  return s.current ? levelOf(s.current) : null;
}

/** Out of moves with goals still to reach: five more moves, or the dive ends. */
export function isStuck(s: GameState): boolean {
  return s.current !== null && D.isStuck(s.current.dive, levelOf(s.current));
}

/** No swap works on the board and it could not be shuffled into one: a tool, or the dive ends. */
export function noMoves(s: GameState): boolean {
  return s.current !== null && !isStuck(s) && !hasMove(s.current.dive.board);
}

/** What a move or a tool did: how it played out, and the result when it reached the goals. */
export interface Moved {
  played: D.Played;
  result: DiveResult | null;
}

function tally(s: GameState, played: D.Played): void {
  for (const step of played.steps) {
    s.stats.cleared += step.cleared?.popped.length ?? 0;
    s.stats.turtles += step.saved.length;
  }
}

/** Counts the daily dive of `day` as reached, unless that day or a later one already is. */
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
 * Ends the dive in progress. One that reached its goals pays: a level reached for the first
 * time a base and more for each star, again only for the stars it did not have, and the last
 * level of a zone a bonus and a tool of each kind; the daily dive, more for each day of a streak.
 */
function finish(s: GameState, c: Current, won: boolean): DiveResult {
  const level = levelOf(c);
  const d = c.dive;
  const result: DiveResult = {
    mode: c.mode,
    level: c.level,
    day: c.day,
    won,
    stars: 0,
    before: 0,
    movesLeft: d.movesLeft,
    pay: 0,
    doubled: false,
    zone: null,
    zoneCoins: 0,
    streak: 0,
  };
  s.current = null;
  if (won) {
    s.stats.won += 1;
    result.stars = D.starsFor(d, level);
    if (c.mode === 'reef') {
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

function moved(s: GameState, c: Current, played: D.Played): Moved {
  tally(s, played);
  return { played, result: played.won ? finish(s, c, true) : null };
}

/** Whether swapping two pieces would be taken as a move. */
export function canSwap(s: GameState, from: number, to: number): boolean {
  return s.current !== null && D.canSwap(s.current.dive, from, to);
}

/** Swaps two pieces, which takes a move. Null when the swap does nothing, or no dive is in progress. */
export function swap(s: GameState, from: number, to: number): Moved | null {
  const c = s.current;
  if (!c) return null;
  const played = D.swap(c.dive, levelOf(c), from, to);
  if (!played) return null;
  s.stats.moves += 1;
  return moved(s, c, played);
}

/** The swap to show a player who has not moved for a while. */
export function hintMove(s: GameState): Move | null {
  return s.current ? botMove(s.current.dive, levelOf(s.current)) : null;
}

// ---------------------------------------------------------------------------------------
// Tools: from the bag, which an ad or sand dollars fill

export type ToolUse = { tool: 'claw'; cell: number } | { tool: 'tide'; row: number } | { tool: 'crab'; from: number; to: number };

/** Whether a tool would do something there; nothing is taken from the bag for a tool that would not. */
export function toolWorks(s: GameState, use: ToolUse): boolean {
  const c = s.current;
  if (!c || isStuck(s)) return false;
  switch (use.tool) {
    case 'claw':
      return D.clawWorks(c.dive, use.cell);
    case 'tide':
      return D.tideWorks(c.dive, use.row);
    case 'crab':
      return D.freeSwapWorks(c.dive, use.from, use.to);
  }
}

/** Uses a tool from the bag; it takes no move. */
export function playTool(s: GameState, use: ToolUse): Moved | null {
  const c = s.current;
  if (!c || s.tools[use.tool] <= 0 || !toolWorks(s, use)) return null;
  const level = levelOf(c);
  const played =
    use.tool === 'claw' ? D.claw(c.dive, level, use.cell) : use.tool === 'tide' ? D.tide(c.dive, level, use.row) : D.freeSwap(c.dive, level, use.from, use.to);
  if (!played) return null;
  s.tools[use.tool] -= 1;
  s.stats.toolsUsed += 1;
  return moved(s, c, played);
}

/** Buys one of a tool for the bag with sand dollars. */
export function buyTool(s: GameState, tool: C.Tool): boolean {
  if (s.coins < C.TOOL_COSTS[tool] || s.tools[tool] >= C.MAX_TOOLS) return false;
  s.coins -= C.TOOL_COSTS[tool];
  s.tools[tool] += 1;
  return true;
}

function addMoves(s: GameState): boolean {
  const c = s.current;
  if (!c || !D.addMoves(c.dive, levelOf(c))) return false;
  s.stats.continues += 1;
  return true;
}

/** Five more moves for a dive that ran out, with sand dollars. */
export function buyMoreMoves(s: GameState): boolean {
  if (!isStuck(s) || s.coins < C.MORE_MOVES_COST) return false;
  s.coins -= C.MORE_MOVES_COST;
  return addMoves(s);
}

/** Ends the dive in progress without reaching its goals. */
export function giveUp(s: GameState): DiveResult | null {
  return s.current ? finish(s, s.current, false) : null;
}

// ---------------------------------------------------------------------------------------
// Notes on what is new

/** The note a level brings: the first level of each new thing has one. */
export function tipOf(level: number): C.TipId | null {
  return C.TIPS.find((tip) => C.TIP_LEVELS[tip] === level) ?? null;
}

/** The note to show on a dive, until it has been seen. */
export function tipFor(s: GameState, key: DiveKey): C.TipId | null {
  const tip = key.mode === 'reef' ? tipOf(key.level) : null;
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

export const LOOKS: readonly C.LookId[] = [...C.WATERS, ...C.BUDDIES];

export function isBuddy(id: C.LookId): id is C.Buddy {
  return (C.BUDDIES as readonly string[]).includes(id);
}

export function ownsLook(s: GameState, id: C.LookId): boolean {
  return (
    C.LOOK_COSTS[id] === 0 ||
    s.looks.bought.includes(id) ||
    hasEntitlement(s, 'reef_collection') ||
    (id === C.DIVER_KIT_BUDDY && hasEntitlement(s, 'diver_kit'))
  );
}

/** The water and the buddy drawn: the chosen ones, unless a refund took them back. */
export function waterInUse(s: GameState): C.Water {
  return ownsLook(s, s.looks.water) ? s.looks.water : 'sunlit';
}
export function buddyInUse(s: GameState): C.Buddy {
  return ownsLook(s, s.looks.buddy) ? s.looks.buddy : 'clownfish';
}

export function chooseLook(s: GameState, id: C.LookId): boolean {
  if (!ownsLook(s, id)) return false;
  if (isBuddy(id)) s.looks.buddy = id;
  else s.looks.water = id;
  return true;
}

/** Buys a look with sand dollars, and starts using it. */
export function buyLook(s: GameState, id: C.LookId): boolean {
  if (ownsLook(s, id) || s.coins < C.LOOK_COSTS[id]) return false;
  s.coins -= C.LOOK_COSTS[id];
  s.looks.bought.push(id);
  return chooseLook(s, id);
}

/** The Diver's Kit is offered until its buddy is owned some way, the Reef Collection until every look is. */
export function diverKitOffered(s: GameState): boolean {
  return !ownsLook(s, C.DIVER_KIT_BUDDY);
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
    case 'more_moves':
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
    case 'more_moves':
      if (!addMoves(s)) return false;
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

/** Adds what a purchase settled into this save; negative after a refund, which never takes a bag below empty. */
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
