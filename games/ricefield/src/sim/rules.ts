import { daysBetween } from '@game1/engine';
import * as Shell from '@game1/shell';
import * as C from './content.js';
import {
  ALBUM_IDS,
  albumOf,
  cellCount,
  complete,
  isPictureId,
  pebbleDoneLines,
  PICTURES,
  picturesOf,
  plantedCount,
  puzzleFor,
  startBoard,
  type PictureId,
  type Puzzle,
} from './fields.js';
import { EMPTY, FILLED, hintFor, truthOf, UNKNOWN, type CellState, type Hint, type LineRef } from './nonogram.js';
import type { AlbumId } from './pictures.js';
import type { Field, FieldResult, GameState } from './state.js';

/** Rewarded ads a player may watch in a day. */
export const AD_LIMITS: Shell.RewardedLimits<C.AdPlacement> = {
  perPlacement: { hint: 8, hearts: 5, double_seeds: 5, free_seeds: 3 },
  total: 15,
};

/** The ad that pays for each tool. */
export const TOOL_ADS: Readonly<Record<C.Tool, C.AdPlacement>> = { hint: 'hint', hearts: 'hearts' };

/** A field is known by its picture, or as the daily field. */
export type FieldKey = PictureId | 'daily';

/** The rewarded ads and the shell know a field by its slot: 0 for the daily field, then the album pictures in order. */
export function slotOf(key: FieldKey): number {
  return key === 'daily' ? 0 : PICTURES.findIndex((picture) => picture.id === key) + 1;
}
export function keyOfSlot(slot: number): FieldKey | null {
  return slot === 0 ? 'daily' : (PICTURES[slot - 1]?.id ?? null);
}

// ---------------------------------------------------------------------------------------
// Albums

export function grownIn(s: GameState, album: AlbumId): number {
  return picturesOf(album).filter((id) => s.grown.includes(id)).length;
}

/** The first album is open from the start; each one after it once enough of the album before it has grown. */
export function albumOpen(s: GameState, album: AlbumId): boolean {
  const at = ALBUM_IDS.indexOf(album);
  const before = ALBUM_IDS[at - 1];
  return at === 0 || (before !== undefined && grownIn(s, before) >= C.OPEN_AFTER);
}

export function albumDone(s: GameState, album: AlbumId): boolean {
  return grownIn(s, album) === picturesOf(album).length;
}

/** Pictures the album before still has to grow before `album` opens. */
export function neededToOpen(s: GameState, album: AlbumId): number {
  const before = ALBUM_IDS[ALBUM_IDS.indexOf(album) - 1];
  return before === undefined ? 0 : Math.max(0, C.OPEN_AFTER - grownIn(s, before));
}

// ---------------------------------------------------------------------------------------
// Fields

export function fieldOf(s: GameState, key: FieldKey): Field | null {
  return key === 'daily' ? s.daily.field : (s.fields.find((field) => field.id === key) ?? null);
}

export function puzzleOfField(field: Field): Puzzle {
  return puzzleFor(field.mode, field.id);
}

/** The key the rest of the game knows a field by. */
export function keyOf(field: Field): FieldKey {
  return field.mode === 'daily' || !isPictureId(field.id) ? 'daily' : field.id;
}

function newField(mode: C.Mode, id: string): Field {
  return { mode, id, board: startBoard(puzzleFor(mode, id)), hearts: C.HEARTS, mistakes: 0, wrong: [], freeHints: C.FREE_HINTS, hints: 0, restarts: 0 };
}

/**
 * The field of an album picture: the one in progress, or a new one. None for a picture that
 * has grown, or in an album that is not open yet.
 */
export function openAlbumField(s: GameState, id: PictureId): Field | null {
  if (s.grown.includes(id) || !albumOpen(s, albumOf(id))) return null;
  const at = s.fields.findIndex((field) => field.id === id);
  const field = at >= 0 ? s.fields.splice(at, 1)[0] : undefined;
  if (field) {
    s.fields.push(field);
    return field;
  }
  const started = newField('album', id);
  s.fields.push(started);
  s.fields = s.fields.slice(-C.MAX_OPEN_FIELDS);
  s.result = null;
  return started;
}

/** The album field played last, to go on with. */
export function lastField(s: GameState): Field | null {
  return [...s.fields].reverse().find((field) => isPictureId(field.id) && albumOpen(s, albumOf(field.id))) ?? null;
}

/** The picture to play after `after`: the next one not grown yet in an album that is open, from the first if none is given. */
export function nextPicture(s: GameState, after?: PictureId): PictureId | null {
  const start = after === undefined ? 0 : PICTURES.findIndex((picture) => picture.id === after) + 1;
  for (let k = 0; k < PICTURES.length; k++) {
    const picture = PICTURES[(start + k) % PICTURES.length];
    if (picture && !s.grown.includes(picture.id) && albumOpen(s, picture.album)) return picture.id;
  }
  return null;
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
 * Today's daily field: the one in progress, or a new one. A daily field left from another day
 * gives way to today's, and once today's has grown there is none until tomorrow.
 */
export function openDaily(s: GameState, today: string): Field | null {
  if (s.daily.field?.id === today) return s.daily.field;
  s.daily.field = null;
  if (dailyDoneToday(s, today)) return null;
  s.daily.field = newField('daily', today);
  s.result = null;
  return s.daily.field;
}

/** Whether anything was done on a field since it started. */
export function touched(field: Field): boolean {
  const start = startBoard(puzzleOfField(field));
  return field.mistakes > 0 || field.hints > 0 || field.board.some((state, cell) => state !== start[cell]);
}

/** The share of the picture planted so far, from 0 to 1. */
export function progressOf(field: Field): number {
  const puzzle = puzzleOfField(field);
  const planted = field.board.filter((state, cell) => state === FILLED && puzzle.shape.filled[cell]).length;
  return planted / Math.max(1, plantedCount(puzzle));
}

/** Planting rice, or putting a pebble where there is none. */
export type Action = 'plant' | 'pebble';

/** What a move on a cell did. */
export interface Acted {
  cell: number;
  /** The cell as it is now: after a wrong move, the other way, as it was put right. */
  state: CellState;
  mistake: boolean;
  /** Cells pebbled because their rows or columns had nothing left to plant. */
  pebbled: number[];
  /** The rows and columns this move finished. */
  lines: LineRef[];
  /** The move took the field's last heart. */
  wilted: boolean;
  /** The move grew the field, and this is what it paid. */
  result: FieldResult | null;
}

/**
 * Plants a cell or pebbles it. A wrong move costs a heart, and the cell is put right; with no
 * hearts left the field waits for more, or to be started over.
 */
export function act(s: GameState, key: FieldKey, cell: number, action: Action): Acted | null {
  const field = fieldOf(s, key);
  if (!field || field.hearts <= 0 || field.board[cell] !== UNKNOWN) return null;
  const puzzle = puzzleOfField(field);
  const state = truthOf(puzzle.shape, cell);
  const mistake = state !== (action === 'plant' ? FILLED : EMPTY);
  field.board[cell] = state;
  if (mistake) {
    field.mistakes += 1;
    field.hearts -= 1;
    field.wrong.push(cell);
    s.stats.mistakes += 1;
  }
  const { pebbled, lines } = pebbleDoneLines(puzzle, field.board, [cell]);
  const result = complete(puzzle, field.board) ? growField(s, field, puzzle) : null;
  return { cell, state, mistake, pebbled, lines, wilted: mistake && field.hearts === 0 && result === null, result };
}

/** Counts the daily field of `day` as done, unless that day or a later one already is. */
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
 * Pays for a grown field: a seed for every four cells, half as much again for a perfect one,
 * and a bonus for finishing an album. A daily field counts for the day it was made.
 */
function growField(s: GameState, field: Field, puzzle: Puzzle): FieldResult {
  const perfect = field.mistakes === 0 && field.hints === 0;
  const result: FieldResult = {
    mode: field.mode,
    id: field.id,
    perfect,
    mistakes: field.mistakes,
    hints: field.hints,
    pay: 0,
    bonus: 0,
    seeds: 0,
    doubled: false,
    album: null,
    albumSeeds: 0,
    opened: null,
    streak: 0,
  };
  s.stats.grown += 1;
  if (perfect) s.stats.perfect += 1;
  s.stats.cells += plantedCount(puzzle);
  s.taught = true;
  if (field.mode === 'album' && isPictureId(field.id)) {
    const album = albumOf(field.id);
    const wasOpen = ALBUM_IDS.filter((id) => albumOpen(s, id));
    s.fields = s.fields.filter((f) => f !== field);
    s.grown.push(field.id);
    result.pay = C.fieldSeeds(cellCount(puzzle));
    if (albumDone(s, album)) {
      result.album = album;
      result.albumSeeds = C.ALBUM_SEEDS;
    }
    result.opened = ALBUM_IDS.find((id) => !wasOpen.includes(id) && albumOpen(s, id)) ?? null;
  } else {
    s.daily.field = null;
    if (completeDaily(s, field.id)) {
      result.pay = C.DAILY_SEEDS;
      result.streak = s.daily.streak;
    }
  }
  result.bonus = perfect ? C.perfectBonus(result.pay) : 0;
  result.seeds = result.pay + result.bonus;
  s.seeds += result.seeds + result.albumSeeds;
  s.result = result;
  return result;
}

/** Starts the field over from its first cells, with all its hearts. Wrong moves and hints made stay counted. */
export function restart(s: GameState, key: FieldKey): boolean {
  const field = fieldOf(s, key);
  if (!field) return false;
  field.board = startBoard(puzzleOfField(field));
  field.hearts = C.HEARTS;
  field.wrong = [];
  field.restarts += 1;
  s.stats.restarts += 1;
  return true;
}

// ---------------------------------------------------------------------------------------
// Hints

/** What a hint filled in. */
export interface Hinted {
  /** The line it worked out, and its cells it filled in. */
  line: LineRef;
  cells: { cell: number; state: CellState }[];
  pebbled: number[];
  lines: LineRef[];
  result: FieldResult | null;
}

/** The line where the clues now tell the most; line logic always finds one on these fields. */
function hintOf(puzzle: Puzzle, board: readonly CellState[]): Hint | null {
  const hint = hintFor(puzzle.clues, puzzle.shape, board);
  if (hint) return hint;
  // Only a fallback: shows one cell of the picture.
  const cell = board.findIndex((state, i) => state === UNKNOWN && puzzle.shape.filled[i]);
  return cell < 0 ? null : { line: { axis: 'row', index: Math.floor(cell / puzzle.shape.width) }, cells: [{ cell, state: FILLED }] };
}

function applyHint(s: GameState, field: Field): Hinted | null {
  const puzzle = puzzleOfField(field);
  const hint = hintOf(puzzle, field.board);
  if (!hint) return null;
  for (const { cell, state } of hint.cells) field.board[cell] = state;
  field.hints += 1;
  s.stats.hints += 1;
  const { pebbled, lines } = pebbleDoneLines(
    puzzle,
    field.board,
    hint.cells.map(({ cell }) => cell),
  );
  const result = complete(puzzle, field.board) ? growField(s, field, puzzle) : null;
  return { line: hint.line, cells: hint.cells, pebbled, lines, result };
}

/** Uses the field's free hint. */
export function freeHint(s: GameState, key: FieldKey): Hinted | null {
  const field = fieldOf(s, key);
  if (!field || field.freeHints <= 0 || field.hearts <= 0) return null;
  const hinted = applyHint(s, field);
  if (hinted) field.freeHints -= 1;
  return hinted;
}

// ---------------------------------------------------------------------------------------
// Tools: a hint once the free one is used, and hearts for a field that ran out, for an ad or for seeds

/** Whether a tool would help the field now; nothing is paid for a tool that would not. */
export function toolOffered(s: GameState, key: FieldKey, tool: C.Tool): boolean {
  const field = fieldOf(s, key);
  if (!field) return false;
  switch (tool) {
    case 'hint':
      return field.hearts > 0 && field.freeHints === 0;
    case 'hearts':
      return field.hearts === 0;
  }
}

/** What a tool did: the hint it gave, or hearts filled up. */
export type Helped = { tool: 'hint'; hinted: Hinted } | { tool: 'hearts' };

function applyTool(s: GameState, key: FieldKey, tool: C.Tool): Helped | null {
  const field = fieldOf(s, key);
  if (!field) return null;
  if (tool === 'hearts') {
    field.hearts = C.HEARTS;
    return { tool };
  }
  const hinted = applyHint(s, field);
  return hinted ? { tool, hinted } : null;
}

/** Pays for a tool with seeds. */
export function buyTool(s: GameState, key: FieldKey, tool: C.Tool): Helped | null {
  if (!toolOffered(s, key, tool) || s.seeds < C.TOOL_COSTS[tool]) return null;
  const helped = applyTool(s, key, tool);
  if (helped) s.seeds -= C.TOOL_COSTS[tool];
  return helped;
}

// ---------------------------------------------------------------------------------------
// Looks

export function hasEntitlement(s: GameState, id: C.Entitlement): boolean {
  return s.shop.entitlements.includes(id);
}

export const LOOKS: readonly C.LookId[] = [...C.SCENES, ...C.MARKERS];

export function isMarker(id: C.LookId): id is C.Marker {
  return (C.MARKERS as readonly string[]).includes(id);
}

export function ownsLook(s: GameState, id: C.LookId): boolean {
  return (
    C.LOOK_COSTS[id] === 0 ||
    s.looks.bought.includes(id) ||
    hasEntitlement(s, 'field_collection') ||
    (id === C.FARMER_KIT_MARKER && hasEntitlement(s, 'farmer_kit'))
  );
}

/** The scene and the marker drawn: the chosen ones, unless a refund took them back. */
export function sceneInUse(s: GameState): C.Scene {
  return ownsLook(s, s.looks.scene) ? s.looks.scene : 'terraces';
}
export function markerInUse(s: GameState): C.Marker {
  return ownsLook(s, s.looks.marker) ? s.looks.marker : 'pebble';
}

export function chooseLook(s: GameState, id: C.LookId): boolean {
  if (!ownsLook(s, id)) return false;
  if (isMarker(id)) s.looks.marker = id;
  else s.looks.scene = id;
  return true;
}

/** Buys a look with seeds, and starts using it. */
export function buyLook(s: GameState, id: C.LookId): boolean {
  if (ownsLook(s, id) || s.seeds < C.LOOK_COSTS[id]) return false;
  s.seeds -= C.LOOK_COSTS[id];
  s.looks.bought.push(id);
  return chooseLook(s, id);
}

/** The Farmer's Kit is offered until its marker is owned some way, the Field Collection until every look is. */
export function farmerKitOffered(s: GameState): boolean {
  return !ownsLook(s, C.FARMER_KIT_MARKER);
}
export function collectionOffered(s: GameState): boolean {
  return LOOKS.some((id) => !ownsLook(s, id));
}

// ---------------------------------------------------------------------------------------
// Ads and purchases

export function adsLeft(s: GameState, placement: C.AdPlacement, day: string): number {
  return Shell.adsLeft(s.ads, placement, day, AD_LIMITS);
}

export function adOffered(s: GameState, placement: C.AdPlacement, day: string, key: FieldKey | null): boolean {
  if (adsLeft(s, placement, day) <= 0) return false;
  switch (placement) {
    case 'hint':
      return key !== null && toolOffered(s, key, 'hint');
    case 'hearts':
      return key !== null && toolOffered(s, key, 'hearts');
    case 'double_seeds':
      return s.result !== null && !s.result.doubled && s.result.seeds > 0;
    case 'free_seeds':
      return true;
  }
}

/** What a rewarded ad gave; a hint ad also says what the hint filled in. */
export interface Rewarded {
  placement: C.AdPlacement;
  hinted: Hinted | null;
}

/** Gives the reward of a rewarded ad. Call only after the ad network confirmed it. */
export function grantAdReward(s: GameState, placement: C.AdPlacement, now: number, day: string, key: FieldKey | null): Rewarded | null {
  if (!adOffered(s, placement, day, key)) return null;
  let hinted: Hinted | null = null;
  switch (placement) {
    case 'hint':
    case 'hearts': {
      const helped = key === null ? null : applyTool(s, key, placement);
      if (!helped) return null;
      if (helped.tool === 'hint') hinted = helped.hinted;
      break;
    }
    case 'double_seeds':
      if (!s.result) return null;
      s.seeds += s.result.seeds;
      s.result.doubled = true;
      break;
    case 'free_seeds':
      s.seeds += C.FREE_SEEDS;
      break;
  }
  Shell.recordRewarded(s.ads, placement, now, day);
  return { placement, hinted };
}

/** Adds what a purchase settled into this save; negative after a refund. */
export function grantPurchase(s: GameState, amounts: Readonly<Record<string, number>>): void {
  s.seeds += amounts.seeds ?? 0;
}

export function setEntitlements(s: GameState, entitlements: readonly string[]): void {
  s.shop.entitlements = Shell.knownEntitlements(entitlements, C.ENTITLEMENTS);
}

export function adBreaksEarned(s: GameState): boolean {
  return s.stats.grown >= C.AD_BREAKS_AFTER_WINS;
}
