import { daysBetween } from '@game1/engine';
import * as Shell from '@game1/shell';
import { botPick } from './bot.js';
import * as C from './content.js';
import { LEVELS_PER_ZONE, ZONES, levelsOf, seedOf, zoneOf, type ZoneId } from './levels.js';
import * as O from './round.js';
import { levelOf, type Current, type GameState, type RoundKey, type RoundResult } from './state.js';

/** Rewarded ads a player may watch in a day. */
export const AD_LIMITS: Shell.RewardedLimits<C.AdPlacement> = {
  perPlacement: { more_room: 5, tool: 6, double_coins: 5, free_coins: 3 },
  total: 15,
};

// ---------------------------------------------------------------------------------------
// The lane

/** The next level to clear: every level before it has been. */
export function nextLevel(s: GameState): number {
  return s.stars.length + 1;
}

export function levelOpen(s: GameState, n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= nextLevel(s);
}

/** The stars a level was cleared with, 0 for one not cleared yet. */
export function starsOf(s: GameState, n: number): number {
  return s.stars[n - 1] ?? 0;
}

export function totalStars(s: GameState): number {
  return s.stars.reduce((sum, stars) => sum + stars, 0);
}

export function zoneOpen(s: GameState, zone: ZoneId): boolean {
  return levelOpen(s, levelsOf(zone)[0] ?? 1);
}

/** Every level of the shop cleared: it is open on the lane. */
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
  const key: RoundKey = { mode: 'lane', level: n, day: null };
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

/** What today's daily special pays, before its sprinkles: more for each day of the streak it carries on. */
export function dailyPay(s: GameState, today: string): number {
  const streak = dailyStreak(s, today) + (dailyDoneToday(s, today) ? 0 : 1);
  return C.DAILY_COINS + C.STREAK_COINS * Math.min(C.STREAK_DAYS, Math.max(0, streak - 1));
}

/**
 * Today's daily special: the round in progress, or a new try. Everyone's first try of a day
 * has the same deal. Once today's is cleared there is none until tomorrow.
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

/** A full tray: room must be made, a tool must free a place, or the round ends. */
export function isStuck(s: GameState): boolean {
  return s.current !== null && O.isStuck(s.current.round);
}

/** Counts the daily special of `day` as cleared, unless that day or a later one already is. */
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
 * Ends the round in progress. A counter cleared pays: a level cleared for the first time a
 * base and more for each star, again only for the stars it did not have, and the last level
 * of a shop a bonus and a tool of each kind; the daily special, more for each day of a
 * streak; and every sprinkled pastry boxed up a little more, every time.
 */
function finish(s: GameState, c: Current, won: boolean): RoundResult {
  const r = c.round;
  const result: RoundResult = {
    mode: c.mode,
    level: c.level,
    day: c.day,
    won,
    stars: 0,
    before: 0,
    peak: r.peak,
    pay: 0,
    sprinkles: 0,
    doubled: false,
    zone: null,
    zoneCoins: 0,
    streak: 0,
  };
  s.current = null;
  if (won) {
    s.stats.won += 1;
    result.stars = O.starsFor(r);
    if (c.mode === 'lane') {
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
    result.sprinkles = C.SPRINKLE_COINS * r.sprinkled;
    result.pay += result.sprinkles;
    s.coins += result.pay + result.zoneCoins;
  }
  s.result = result;
  return result;
}

/** What a take did: how it played out, and the result when it cleared the counter. */
export interface Took {
  take: O.Take;
  result: RoundResult | null;
}

/** Takes a tile from the counter, or back from the rack, onto the tray. Null when it cannot be taken. */
export function take(s: GameState, tile: number): Took | null {
  const c = s.current;
  if (!c) return null;
  const done = O.take(c.round, levelOf(c), tile);
  if (!done) return null;
  s.stats.taken += 1;
  if (done.set) s.stats.sets += 1;
  return { take: done, result: done.won ? finish(s, c, true) : null };
}

/** Whether a tool would do anything now: a round going on, and something for the tool to work on. */
export function toolWorks(s: GameState, tool: C.Tool): boolean {
  const c = s.current;
  if (!c) return false;
  const r = c.round;
  switch (tool) {
    case 'spatula':
      return r.taken.length > 0;
    case 'rollingpin':
      return !O.isStuck(r) && r.at.some((p) => p === 'counter' || p === 'rack');
    case 'whisk':
      return !O.isWon(r);
  }
}

/** Whether a tool can be used now: it would do something, and there is one in the pocket. */
export function canUse(s: GameState, tool: C.Tool): boolean {
  return toolWorks(s, tool) && s.tools[tool] > 0;
}

/** What a tool did, for the screens. */
export interface ToolUse {
  tool: C.Tool;
  undo: O.Undo | null;
  whisk: O.Whisk | null;
  result: RoundResult | null;
}

/** Uses a tool from the pocket. Null when it can do nothing now, or the pocket has none. */
export function applyTool(s: GameState, tool: C.Tool): ToolUse | null {
  const c = s.current;
  if (!c || !canUse(s, tool)) return null;
  const level = levelOf(c);
  const use: ToolUse = { tool, undo: null, whisk: null, result: null };
  if (tool === 'spatula') {
    use.undo = O.spatula(c.round);
    if (!use.undo) return null;
  } else if (tool === 'whisk') {
    use.whisk = O.whisk(c.round, level);
    if (!use.whisk) return null;
    s.stats.sets += 1;
  } else if (!O.rollingPin(c.round, level)) return null;
  s.tools[tool] -= 1;
  s.stats.toolsUsed += 1;
  if (use.whisk?.won) use.result = finish(s, c, true);
  return use;
}

/** The tile to show a player who has not taken one for a while. */
export function hintTile(s: GameState): number | null {
  return s.current && !isStuck(s) ? botPick(s.current.round, levelOf(s.current)) : null;
}

/** Buys one of a tool for the pocket with sugar. */
export function buyTool(s: GameState, tool: C.Tool): boolean {
  if (s.coins < C.TOOL_COSTS[tool] || s.tools[tool] >= C.MAX_TOOLS) return false;
  s.coins -= C.TOOL_COSTS[tool];
  s.tools[tool] += 1;
  return true;
}

/** Room can be made: the tray is full, and the cooling rack has space for three. */
export function canMakeRoom(s: GameState): boolean {
  return s.current !== null && O.canMakeRoom(s.current.round);
}

function makeRoom(s: GameState): boolean {
  const c = s.current;
  if (!c || !O.makeRoom(c.round)) return false;
  s.stats.continues += 1;
  return true;
}

/** Makes room on a full tray with sugar. */
export function buyRoom(s: GameState): boolean {
  if (!canMakeRoom(s) || s.coins < C.MORE_ROOM_COST) return false;
  s.coins -= C.MORE_ROOM_COST;
  return makeRoom(s);
}

/** Ends the round in progress without clearing the counter. */
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
  const tip = key.mode === 'lane' ? tipOf(key.level) : null;
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

export const LOOKS: readonly C.LookId[] = [...C.TILE_SETS, ...C.SEASONS];

export function isSeason(id: C.LookId): id is C.Season {
  return (C.SEASONS as readonly string[]).includes(id);
}

export function ownsLook(s: GameState, id: C.LookId): boolean {
  return (
    C.LOOK_COSTS[id] === 0 ||
    s.looks.bought.includes(id) ||
    hasEntitlement(s, 'lane_collection') ||
    (id === C.BAKER_KIT_TILES && hasEntitlement(s, 'baker_kit'))
  );
}

/** The tiles and the season drawn: the chosen ones, unless a refund took them back. */
export function tilesInUse(s: GameState): C.TileSet {
  return ownsLook(s, s.looks.tiles) ? s.looks.tiles : 'cream';
}
export function seasonInUse(s: GameState): C.Season {
  return ownsLook(s, s.looks.season) ? s.looks.season : 'spring';
}

export function chooseLook(s: GameState, id: C.LookId): boolean {
  if (!ownsLook(s, id)) return false;
  if (isSeason(id)) s.looks.season = id;
  else s.looks.tiles = id;
  return true;
}

/** Buys a look with sugar, and starts using it. */
export function buyLook(s: GameState, id: C.LookId): boolean {
  if (ownsLook(s, id) || s.coins < C.LOOK_COSTS[id]) return false;
  s.coins -= C.LOOK_COSTS[id];
  s.looks.bought.push(id);
  return chooseLook(s, id);
}

/** The Baker's Kit is offered until its tiles are owned some way, the Lane Collection until every look is. */
export function bakerKitOffered(s: GameState): boolean {
  return !ownsLook(s, C.BAKER_KIT_TILES);
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
    case 'more_room':
      return canMakeRoom(s);
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
    case 'more_room':
      if (!makeRoom(s)) return false;
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

/** Adds what a purchase settled into this save; negative after a refund, which never takes a pocket below empty. */
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
