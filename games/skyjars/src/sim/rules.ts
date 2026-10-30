import { daysBetween } from '@game1/engine';
import * as Shell from '@game1/shell';
import * as C from './content.js';
import * as J from './jars.js';
import { makeDaily, makeLevel, type Made } from './levels.js';
import { locate } from './sky.js';
import type { GameState, Shelf, ShelfResult } from './state.js';

/** Rewarded ads a player may watch in a day. */
export const AD_LIMITS: Shell.RewardedLimits<C.AdPlacement> = {
  perPlacement: { extra_jar: 5, more_undos: 5, hint: 8, double_stardust: 5, free_stardust: 3 },
  total: 12,
};

/** The rewarded ads and the shell know a shelf by its slot: 0 for the level, 1 for the daily sky. */
export function modeOfSlot(slot: number): C.Mode {
  return slot === 1 ? 'daily' : 'level';
}
export function slotOf(mode: C.Mode): number {
  return mode === 'daily' ? 1 : 0;
}

/** The ad that pays for each tool. */
export const TOOL_ADS: Readonly<Record<C.Tool, C.AdPlacement>> = { moreUndos: 'more_undos', extraJar: 'extra_jar', hint: 'hint' };

// ---------------------------------------------------------------------------------------
// Shelves

function newShelf(mode: C.Mode, level: number, day: string | null, made: Made): Shelf {
  return {
    mode,
    level,
    day,
    capacity: made.puzzle.capacity,
    start: made.puzzle.jars.map((jar) => [...jar]),
    jars: made.puzzle.jars.map((jar) => [...jar]),
    history: [],
    undosLeft: C.UNDOS_PER_SHELF,
    extraJar: false,
    undid: 0,
    hinted: 0,
    hint: null,
  };
}

/** The shelf as a puzzle; pouring into it changes the shelf. */
export function puzzleOf(shelf: Shelf): J.Puzzle {
  return { jars: shelf.jars, capacity: shelf.capacity };
}

export function dailyDoneToday(s: GameState, today: string): boolean {
  return s.daily.lastDone === today;
}

/** The daily streak as it stands today: it ends when a day was missed. */
export function dailyStreak(s: GameState, today: string): number {
  const last = s.daily.lastDone;
  return last !== null && daysBetween(last, today) <= 1 ? s.daily.streak : 0;
}

/**
 * The shelf to play in a mode: the one in progress, or a new one. A daily sky left from another
 * day gives way to today's, and once today's is solved there is none until tomorrow.
 */
export function openShelf(s: GameState, mode: C.Mode, today: string): Shelf | null {
  const current = s.shelves[mode];
  if (mode === 'level') {
    if (current) return current;
    s.shelves.level = newShelf('level', s.level, null, makeLevel(s.level));
    s.result = null;
    return s.shelves.level;
  }
  if (current?.day === today) return current;
  s.shelves.daily = null;
  if (dailyDoneToday(s, today)) return null;
  s.shelves.daily = newShelf('daily', 0, today, makeDaily(today));
  s.result = null;
  return s.shelves.daily;
}

/** What one pour did. */
export interface Poured {
  n: number;
  /** The pour filled its jar with one colour. */
  filled: boolean;
  /** The pour solved the shelf, and this is what it paid. */
  result: ShelfResult | null;
}

export function pour(s: GameState, mode: C.Mode, from: number, to: number): Poured | null {
  const shelf = s.shelves[mode];
  if (!shelf) return null;
  const puzzle = puzzleOf(shelf);
  const n = J.pour(puzzle, from, to);
  if (n === 0) return null;
  shelf.history.push({ from, to, n });
  shelf.hint = null;
  s.stats.pours += 1;
  s.taught = true;
  const filled = J.complete(shelf.jars[to] ?? [], shelf.capacity);
  return { n, filled, result: J.solved(puzzle) ? finishShelf(s, shelf) : null };
}

/** No pour is left and the shelf is not solved. */
export function stuck(s: GameState, mode: C.Mode): boolean {
  const shelf = s.shelves[mode];
  return shelf !== null && J.stuck(puzzleOf(shelf));
}

/** Solved without an undo, a hint or an extra jar. */
export function clean(shelf: Shelf): boolean {
  return shelf.undid === 0 && shelf.hinted === 0 && !shelf.extraJar;
}

/** Counts the daily sky of `day` as done, unless that day or a later one already is. */
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
 * Pays for a solved shelf. A level lights the next star of the atlas, and the last star of a
 * constellation pays a bonus; a daily sky counts for the day it was dealt.
 */
function finishShelf(s: GameState, shelf: Shelf): ShelfResult {
  s.shelves[shelf.mode] = null;
  const wasClean = clean(shelf);
  if (wasClean) s.stats.clean += 1;
  const result: ShelfResult = {
    mode: shelf.mode,
    level: shelf.level,
    pours: shelf.history.length,
    clean: wasClean,
    stardust: 0,
    doubled: false,
    star: null,
    constellation: null,
    bonus: 0,
    streak: 0,
  };
  if (shelf.mode === 'level') {
    result.stardust = C.levelStardust(shelf.level) + (wasClean ? C.CLEAN_BONUS : 0);
    s.stats.levels += 1;
    s.level = shelf.level + 1;
    // Level n lights star n - 1.
    const place = locate(shelf.level - 1);
    if (place) {
      result.star = shelf.level - 1;
      const constellation = C.CONSTELLATIONS[place.index];
      if (constellation && place.star === constellation.stars - 1) {
        result.constellation = constellation.id;
        result.bonus = C.CONSTELLATION_STARDUST;
      }
    }
  } else if (shelf.day !== null && completeDaily(s, shelf.day)) {
    result.stardust = C.DAILY_STARDUST + (wasClean ? C.CLEAN_BONUS : 0);
    result.streak = s.daily.streak;
  }
  s.stardust += result.stardust + result.bonus;
  s.result = result;
  return result;
}

/** Takes the last pour back, using one of the shelf's undos. */
export function undo(s: GameState, mode: C.Mode): boolean {
  const shelf = s.shelves[mode];
  const last = shelf?.history[shelf.history.length - 1];
  if (!shelf || !last || shelf.undosLeft <= 0) return false;
  shelf.history.pop();
  J.unpour(puzzleOf(shelf), last.from, last.to, last.n);
  shelf.undosLeft -= 1;
  shelf.undid += 1;
  shelf.hint = null;
  s.stats.undos += 1;
  return true;
}

/** Puts the jars back as they were dealt, with an extra jar if one was added, and the undos back. */
export function restart(s: GameState, mode: C.Mode): boolean {
  const shelf = s.shelves[mode];
  if (!shelf || shelf.history.length === 0) return false;
  shelf.jars = shelf.start.map((jar) => [...jar]);
  shelf.history = [];
  shelf.undosLeft = Math.max(shelf.undosLeft, C.UNDOS_PER_SHELF);
  shelf.hint = null;
  return true;
}

// ---------------------------------------------------------------------------------------
// Tools: help with a hard shelf, for an ad or for stardust

/** Positions each search for a hint may look at. */
export const HINT_BUDGET = 60_000;
const hints = new Map<string, J.Move | null>();

/**
 * The next pour of a way to solve the shelf from where it stands, or null when none was found.
 * The quick search finds one almost always; when it does not, the thorough one makes sure.
 */
export function findHint(shelf: Shelf): J.Move | null {
  const id = `${String(shelf.capacity)}/${shelf.jars.map((jar) => jar.join(',')).join('|')}`;
  const known = hints.get(id);
  if (known !== undefined) return known;
  const puzzle = puzzleOf(shelf);
  const move = (J.solve(puzzle, HINT_BUDGET) ?? J.solve(puzzle, HINT_BUDGET, true))?.moves[0] ?? null;
  if (hints.size >= 64) hints.clear();
  hints.set(id, move);
  return move;
}

/** Whether a tool would help the shelf now; nothing is paid for a tool that would not. */
export function toolOffered(s: GameState, mode: C.Mode, tool: C.Tool): boolean {
  const shelf = s.shelves[mode];
  if (!shelf) return false;
  switch (tool) {
    case 'moreUndos':
      return shelf.undosLeft === 0 && shelf.history.length > 0;
    case 'extraJar':
      return !shelf.extraJar;
    case 'hint':
      return shelf.hint === null && findHint(shelf) !== null;
  }
}

function applyTool(s: GameState, mode: C.Mode, tool: C.Tool): boolean {
  const shelf = s.shelves[mode];
  if (!shelf) return false;
  switch (tool) {
    case 'moreUndos':
      shelf.undosLeft += C.MORE_UNDOS;
      return true;
    case 'extraJar':
      // The start gets it too, so a restart keeps it.
      shelf.jars.push([]);
      shelf.start.push([]);
      shelf.extraJar = true;
      shelf.hint = null;
      s.stats.extraJars += 1;
      return true;
    case 'hint':
      shelf.hint = findHint(shelf);
      shelf.hinted += 1;
      s.stats.hints += 1;
      return shelf.hint !== null;
  }
}

/** Pays for a tool with stardust. */
export function buyTool(s: GameState, mode: C.Mode, tool: C.Tool): boolean {
  if (!toolOffered(s, mode, tool) || s.stardust < C.TOOL_COSTS[tool]) return false;
  s.stardust -= C.TOOL_COSTS[tool];
  return applyTool(s, mode, tool);
}

// ---------------------------------------------------------------------------------------
// Looks

export function hasEntitlement(s: GameState, id: C.Entitlement): boolean {
  return s.shop.entitlements.includes(id);
}

export const LOOKS: readonly C.LookId[] = [...C.JAR_STYLES, ...C.SKIES];

export function isJarStyle(id: C.LookId): id is C.JarStyle {
  return (C.JAR_STYLES as readonly string[]).includes(id);
}

export function ownsLook(s: GameState, id: C.LookId): boolean {
  return (
    C.LOOK_COSTS[id] === 0 ||
    s.looks.bought.includes(id) ||
    hasEntitlement(s, 'sky_collection') ||
    (id === C.NIGHT_KIT_JARS && hasEntitlement(s, 'night_kit'))
  );
}

/** The jars and sky drawn: the chosen ones, unless a refund took them back. */
export function jarInUse(s: GameState): C.JarStyle {
  return ownsLook(s, s.looks.jar) ? s.looks.jar : 'glass';
}
export function skyInUse(s: GameState): C.Sky {
  return ownsLook(s, s.looks.sky) ? s.looks.sky : 'twilight';
}

export function chooseLook(s: GameState, id: C.LookId): boolean {
  if (!ownsLook(s, id)) return false;
  if (isJarStyle(id)) s.looks.jar = id;
  else s.looks.sky = id;
  return true;
}

/** Buys a look with stardust, and starts using it. */
export function buyLook(s: GameState, id: C.LookId): boolean {
  if (ownsLook(s, id) || s.stardust < C.LOOK_COSTS[id]) return false;
  s.stardust -= C.LOOK_COSTS[id];
  s.looks.bought.push(id);
  return chooseLook(s, id);
}

/** The Night Kit is offered until its jars are owned some way, the Sky Collection until every look is. */
export function nightKitOffered(s: GameState): boolean {
  return !ownsLook(s, C.NIGHT_KIT_JARS);
}
export function skyCollectionOffered(s: GameState): boolean {
  return LOOKS.some((id) => !ownsLook(s, id));
}

// ---------------------------------------------------------------------------------------
// Ads and purchases

export function adsLeft(s: GameState, placement: C.AdPlacement, day: string): number {
  return Shell.adsLeft(s.ads, placement, day, AD_LIMITS);
}

export function adOffered(s: GameState, placement: C.AdPlacement, day: string, mode: C.Mode): boolean {
  if (adsLeft(s, placement, day) <= 0) return false;
  switch (placement) {
    case 'extra_jar':
      return toolOffered(s, mode, 'extraJar');
    case 'more_undos':
      return toolOffered(s, mode, 'moreUndos');
    case 'hint':
      return toolOffered(s, mode, 'hint');
    case 'double_stardust':
      return s.result !== null && !s.result.doubled && s.result.stardust > 0;
    case 'free_stardust':
      return true;
  }
}

/** Gives the reward of a rewarded ad. Call only after the ad network confirmed it. */
export function grantAdReward(s: GameState, placement: C.AdPlacement, now: number, day: string, mode: C.Mode): boolean {
  if (!adOffered(s, placement, day, mode)) return false;
  switch (placement) {
    case 'extra_jar':
      applyTool(s, mode, 'extraJar');
      break;
    case 'more_undos':
      applyTool(s, mode, 'moreUndos');
      break;
    case 'hint':
      applyTool(s, mode, 'hint');
      break;
    case 'double_stardust':
      if (!s.result) return false;
      s.stardust += s.result.stardust;
      s.result.doubled = true;
      break;
    case 'free_stardust':
      s.stardust += C.FREE_STARDUST;
      break;
  }
  Shell.recordRewarded(s.ads, placement, now, day);
  return true;
}

/** Adds what a purchase settled into this save; negative after a refund. */
export function grantPurchase(s: GameState, amounts: Readonly<Record<string, number>>): void {
  s.stardust += amounts.stardust ?? 0;
}

export function setEntitlements(s: GameState, entitlements: readonly string[]): void {
  s.shop.entitlements = Shell.knownEntitlements(entitlements, C.ENTITLEMENTS);
}

export function adBreaksEarned(s: GameState): boolean {
  return s.stats.levels >= C.AD_BREAKS_AFTER_LEVELS;
}
