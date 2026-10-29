import { daysBetween } from '@game1/engine';
import * as Shell from '@game1/shell';
import { WILD, type Card } from './cards.js';
import * as C from './content.js';
import type { Made } from './deal.js';
import { makeDaily, makeLevel } from './levels.js';
import type { Deal, DealResult, GameState } from './state.js';
import { apply, canExtra, canPlay, isFree, replay, revealedBy, STREAK_BONUS, STREAK_EVERY, stuck as tableStuck, topCard, won, type Move, type Table } from './table.js';
import { canalFinishedBy } from './trip.js';

/** Rewarded ads a player may watch in a day. */
export const AD_LIMITS: Shell.RewardedLimits<C.AdPlacement> = {
  perPlacement: { more_undos: 5, wild: 5, extra_cards: 5, double_coins: 5, free_coins: 3 },
  total: 15,
};

/** The rewarded ads and the shell know a deal by its slot: 0 for the level, 1 for the daily deal. */
export function modeOfSlot(slot: number): C.Mode {
  return slot === 1 ? 'daily' : 'level';
}
export function slotOf(mode: C.Mode): number {
  return mode === 'daily' ? 1 : 0;
}

/** The ad that pays for each tool. */
export const TOOL_ADS: Readonly<Record<C.Tool, C.AdPlacement>> = { moreUndos: 'more_undos', wild: 'wild', extraCards: 'extra_cards' };

// ---------------------------------------------------------------------------------------
// Deals

function newDeal(mode: C.Mode, level: number, day: string | null, attempt: number, made: Made): Deal {
  return { mode, level, day, attempt, dealt: made.dealt, moves: [], undosLeft: C.FREE_UNDOS, undid: 0, wilds: 0, extras: 0 };
}

/** The deal as it stands after its moves. */
export function tableOf(deal: Deal): Table {
  return replay(deal.dealt, deal.moves).table;
}

export function dailyDoneToday(s: GameState, today: string): boolean {
  return s.daily.lastDone === today;
}

/** The daily streak as it stands today: it ends when a day was missed. */
export function dailyStreak(s: GameState, today: string): number {
  const last = s.daily.lastDone;
  return last !== null && daysBetween(last, today) <= 1 ? s.daily.streak : 0;
}

/** Which level or day a mode's deals belong to. */
function triesKey(mode: C.Mode, level: number, day: string): string {
  return mode === 'level' ? `level:${String(level)}` : `daily:${day}`;
}

/** How many deals of this level or day were lost, so the next deal there is a new one. */
function attemptOf(s: GameState, mode: C.Mode, key: string): number {
  return s.tries[mode].key === key ? s.tries[mode].lost : 0;
}

/**
 * The deal to play in a mode: the one in progress, or a new one. A daily deal left from another
 * day gives way to today's, and once today's is cleared there is none until tomorrow.
 */
export function openDeal(s: GameState, mode: C.Mode, today: string): Deal | null {
  const current = s.deals[mode];
  if (mode === 'level') {
    if (current) return current;
    const attempt = attemptOf(s, mode, triesKey(mode, s.level, today));
    s.deals.level = newDeal('level', s.level, null, attempt, makeLevel(s.level, attempt));
    s.result = null;
    return s.deals.level;
  }
  if (current?.day === today) return current;
  s.deals.daily = null;
  if (dailyDoneToday(s, today)) return null;
  const attempt = attemptOf(s, mode, triesKey(mode, 0, today));
  s.deals.daily = newDeal('daily', 0, today, attempt, makeDaily(today, attempt));
  s.result = null;
  return s.deals.daily;
}

/** What playing a card did. */
export interface Played {
  card: Card;
  /** Spots the card was lying on that are face up now. */
  revealed: number[];
  streak: number;
  /** Coins the streak paid on top, on every fifth card in a row. */
  bonus: number;
  /** The play cleared the deal, and this is what it paid. */
  result: DealResult | null;
}

export function play(s: GameState, mode: C.Mode, spot: number, today: string): Played | null {
  const deal = s.deals[mode];
  if (!deal) return null;
  const table = tableOf(deal);
  if (!canPlay(table, spot)) return null;
  const revealed = revealedBy(table, spot);
  apply(table, { kind: 'play', spot });
  deal.moves.push({ kind: 'play', spot });
  s.taught = true;
  const bonus = table.streak % STREAK_EVERY === 0 ? STREAK_BONUS : 0;
  return { card: deal.dealt.cards[spot] ?? 0, revealed, streak: table.streak, bonus, result: won(table) ? finishDeal(s, deal, table, today) : null };
}

/** Turns the next stock card onto the pile. */
export function draw(s: GameState, mode: C.Mode): Card | null {
  const deal = s.deals[mode];
  if (!deal) return null;
  const table = tableOf(deal);
  if (!apply(table, { kind: 'draw' })) return null;
  deal.moves.push({ kind: 'draw' });
  return topCard(table);
}

/** Nothing left to play or draw: the deal is lost unless help comes. */
export function stuck(s: GameState, mode: C.Mode): boolean {
  const deal = s.deals[mode];
  return deal !== null && tableStuck(tableOf(deal));
}

function undoable(move: Move | undefined): boolean {
  return move?.kind === 'play' || move?.kind === 'draw';
}

/** Whether the last move can be taken back: a play or a draw, not help that was paid for. */
export function canUndo(s: GameState, mode: C.Mode): boolean {
  const deal = s.deals[mode];
  return deal !== null && undoable(deal.moves[deal.moves.length - 1]);
}

/** Takes the last play or draw back, using one of the deal's undos. */
export function undo(s: GameState, mode: C.Mode): boolean {
  const deal = s.deals[mode];
  if (!deal || deal.undosLeft <= 0 || !canUndo(s, mode)) return false;
  deal.moves.pop();
  deal.undosLeft -= 1;
  deal.undid += 1;
  s.stats.undos += 1;
  return true;
}

/** Solved without an undo, a wild or more cards. */
export function clean(deal: Deal): boolean {
  return deal.undid === 0 && deal.wilds === 0 && deal.extras === 0;
}

/** Counts the daily deal of `day` as done, unless that day or a later one already is. */
function completeDaily(s: GameState, day: string): boolean {
  const last = s.daily.lastDone;
  if (last !== null && daysBetween(last, day) <= 0) return false;
  s.daily.streak = last !== null && daysBetween(last, day) === 1 ? s.daily.streak + 1 : 1;
  s.daily.bestStreak = Math.max(s.daily.bestStreak, s.daily.streak);
  s.daily.lastDone = day;
  s.stats.dailies += 1;
  return true;
}

function baseResult(deal: Deal, table: Table): DealResult {
  return {
    mode: deal.mode,
    level: deal.level,
    won: false,
    cleared: table.played,
    cards: deal.dealt.cards.length,
    bestStreak: table.bestStreak,
    clean: clean(deal),
    pot: 0,
    pay: 0,
    spare: 0,
    spareCoins: 0,
    coins: 0,
    doubled: false,
    canal: null,
    bonus: 0,
    streak: 0,
  };
}

/**
 * Pays for a cleared deal: its pot, the level's pay and the spare stock cards. A level takes
 * the boat one stop further, and the last stop of a canal pays a bonus; a daily deal counts
 * for the day it was dealt.
 */
function finishDeal(s: GameState, deal: Deal, table: Table, today: string): DealResult {
  s.deals[deal.mode] = null;
  s.tries[deal.mode] = { key: '', lost: 0 };
  const result = baseResult(deal, table);
  result.won = true;
  result.pot = table.pot;
  result.spare = table.stock.length;
  result.spareCoins = table.stock.length * C.SPARE_COINS;
  s.stats.wins += 1;
  s.stats.cards += table.played;
  s.stats.bestStreak = Math.max(s.stats.bestStreak, table.bestStreak);
  if (result.clean) s.stats.clean += 1;
  if (deal.mode === 'level') {
    result.pay = C.levelCoins(deal.level);
    s.level = deal.level + 1;
    result.canal = canalFinishedBy(deal.level);
    if (result.canal) result.bonus = C.CANAL_COINS;
  } else if (completeDaily(s, deal.day ?? today)) {
    result.pay = C.DAILY_COINS;
    result.streak = s.daily.streak;
  }
  result.coins = result.pot + result.pay + result.spareCoins;
  s.coins += result.coins + result.bonus;
  s.result = result;
  return result;
}

/** Ends a deal that is stuck. It pays nothing, and the next deal of this level or day is a new one. */
export function giveUp(s: GameState, mode: C.Mode, today: string): DealResult | null {
  const deal = s.deals[mode];
  if (!deal || !stuck(s, mode)) return null;
  const table = tableOf(deal);
  s.deals[mode] = null;
  const key = triesKey(mode, deal.level, deal.day ?? today);
  s.tries[mode] = { key, lost: attemptOf(s, mode, key) + 1 };
  s.stats.losses += 1;
  s.stats.cards += table.played;
  s.result = baseResult(deal, table);
  return s.result;
}

// ---------------------------------------------------------------------------------------
// Tools: help with a hard deal, for an ad or for coins

/** Whether a tool would help the deal now; nothing is paid for a tool that would not. */
export function toolOffered(s: GameState, mode: C.Mode, tool: C.Tool): boolean {
  const deal = s.deals[mode];
  if (!deal) return false;
  switch (tool) {
    case 'moreUndos':
      return deal.undosLeft === 0 && canUndo(s, mode);
    case 'wild': {
      const table = tableOf(deal);
      return topCard(table) !== WILD && deal.dealt.cards.some((_, spot) => isFree(table, spot));
    }
    case 'extraCards':
      return deal.extras < C.MAX_EXTRAS && canExtra(tableOf(deal));
  }
}

function applyTool(s: GameState, mode: C.Mode, tool: C.Tool): boolean {
  const deal = s.deals[mode];
  if (!deal) return false;
  switch (tool) {
    case 'moreUndos':
      deal.undosLeft += C.MORE_UNDOS;
      return true;
    case 'wild':
      deal.moves.push({ kind: 'wild' });
      deal.wilds += 1;
      s.stats.wilds += 1;
      return true;
    case 'extraCards':
      deal.moves.push({ kind: 'extra' });
      deal.extras += 1;
      s.stats.extras += 1;
      return true;
  }
}

/** Pays for a tool with coins. */
export function buyTool(s: GameState, mode: C.Mode, tool: C.Tool): boolean {
  if (!toolOffered(s, mode, tool) || s.coins < C.TOOL_COSTS[tool]) return false;
  s.coins -= C.TOOL_COSTS[tool];
  return applyTool(s, mode, tool);
}

// ---------------------------------------------------------------------------------------
// Looks

export function hasEntitlement(s: GameState, id: C.Entitlement): boolean {
  return s.shop.entitlements.includes(id);
}

export const LOOKS: readonly C.LookId[] = [...C.CARD_BACKS, ...C.SCENES];

export function isCardBack(id: C.LookId): id is C.CardBack {
  return (C.CARD_BACKS as readonly string[]).includes(id);
}

export function ownsLook(s: GameState, id: C.LookId): boolean {
  return (
    C.LOOK_COSTS[id] === 0 ||
    s.looks.bought.includes(id) ||
    hasEntitlement(s, 'canal_collection') ||
    (id === C.MARKET_KIT_BACK && hasEntitlement(s, 'market_kit'))
  );
}

/** The card backs and the scene drawn: the chosen ones, unless a refund took them back. */
export function backInUse(s: GameState): C.CardBack {
  return ownsLook(s, s.looks.back) ? s.looks.back : 'lotus';
}
export function sceneInUse(s: GameState): C.Scene {
  return ownsLook(s, s.looks.scene) ? s.looks.scene : 'morning';
}

export function chooseLook(s: GameState, id: C.LookId): boolean {
  if (!ownsLook(s, id)) return false;
  if (isCardBack(id)) s.looks.back = id;
  else s.looks.scene = id;
  return true;
}

/** Buys a look with coins, and starts using it. */
export function buyLook(s: GameState, id: C.LookId): boolean {
  if (ownsLook(s, id) || s.coins < C.LOOK_COSTS[id]) return false;
  s.coins -= C.LOOK_COSTS[id];
  s.looks.bought.push(id);
  return chooseLook(s, id);
}

/** The Market Kit is offered until its card backs are owned some way, the Canal Collection until every look is. */
export function marketKitOffered(s: GameState): boolean {
  return !ownsLook(s, C.MARKET_KIT_BACK);
}
export function collectionOffered(s: GameState): boolean {
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
    case 'more_undos':
      return toolOffered(s, mode, 'moreUndos');
    case 'wild':
      return toolOffered(s, mode, 'wild');
    case 'extra_cards':
      return toolOffered(s, mode, 'extraCards');
    case 'double_coins':
      return s.result !== null && s.result.won && !s.result.doubled && s.result.coins > 0;
    case 'free_coins':
      return true;
  }
}

/** Gives the reward of a rewarded ad. Call only after the ad network confirmed it. */
export function grantAdReward(s: GameState, placement: C.AdPlacement, now: number, day: string, mode: C.Mode): boolean {
  if (!adOffered(s, placement, day, mode)) return false;
  switch (placement) {
    case 'more_undos':
      applyTool(s, mode, 'moreUndos');
      break;
    case 'wild':
      applyTool(s, mode, 'wild');
      break;
    case 'extra_cards':
      applyTool(s, mode, 'extraCards');
      break;
    case 'double_coins':
      if (!s.result) return false;
      s.coins += s.result.coins;
      s.result.doubled = true;
      break;
    case 'free_coins':
      s.coins += C.FREE_COINS;
      break;
  }
  Shell.recordRewarded(s.ads, placement, now, day);
  return true;
}

/** Adds what a purchase settled into this save; negative after a refund. */
export function grantPurchase(s: GameState, amounts: Readonly<Record<string, number>>): void {
  s.coins += amounts.coins ?? 0;
}

export function setEntitlements(s: GameState, entitlements: readonly string[]): void {
  s.shop.entitlements = Shell.knownEntitlements(entitlements, C.ENTITLEMENTS);
}

export function adBreaksEarned(s: GameState): boolean {
  return s.stats.wins >= C.AD_BREAKS_AFTER_WINS;
}
