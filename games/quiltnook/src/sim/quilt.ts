import { Rng } from '@game1/engine';
import * as B from './board.js';
import { SHAPES, SHAPE_IDS, SHAPE_WEIGHTS, type ShapeId } from './shapes.js';

/** Fabrics in play: every fabric set has four. */
export const FABRICS = 4;
/** Patches in the tray at a time. */
export const TRAY = 3;

/** Points for each square sewn, and for each seam before it is multiplied. */
export const SQUARE_POINTS = 1;
export const SEAM_POINTS = 10;
/** A perfect seam (one fabric all along) counts double and gives a spool. */
export const PERFECT_FACTOR = 2;
export const PERFECT_SPOOLS = 1;
/** Emptying the whole quilt. */
export const CLEAR_QUILT_POINTS = 300;
export const CLEAR_QUILT_SPOOLS = 3;
/** A streak survives this many patches without a seam in between. */
export const STREAK_GRACE = 2;
export const STREAK_STEP = 0.5;
export const STREAK_MAX_FACTOR = 4;

export type Mode = 'endless' | 'daily';
export const MODES = ['endless', 'daily'] as const;

export interface Patch {
  shape: ShapeId;
  fabric: number;
}

interface Tally {
  score: number;
  /** Seams stitched in a row, counting placements with up to STREAK_GRACE misses between. */
  streak: number;
  /** Patches placed since the last seam. */
  sinceSeam: number;
  /** Patches placed. */
  patches: number;
  seams: number;
  perfect: number;
  /** Placements that stitched two or more seams at once. */
  doubles: number;
  bestStreak: number;
  clears: number;
  /** Spools earned while playing (perfect seams, an emptied quilt), already given to the player. */
  spools: number;
}

/** What Unpick puts back: the quilt just before the last patch was placed. */
export interface Snapshot extends Tally {
  board: B.Board;
  tray: (Patch | null)[];
  rng: number;
}

/** One quilt in progress. */
export interface Quilt extends Tally {
  mode: Mode;
  /** The day of a daily quilt, null for an endless one. */
  day: string | null;
  /** The random state that deals the patches, kept so a reload deals the same ones. */
  rng: number;
  board: B.Board;
  tray: (Patch | null)[];
  secondChanceUsed: boolean;
  undo: Snapshot | null;
}

/** What placing one patch did. */
export interface Stitch {
  sewn: number[];
  seams: B.Seam[];
  /** Squares the seams took out. */
  unpicked: B.Unpicked[];
  points: number;
  /** The streak after this patch, 0 when it broke. */
  streak: number;
  perfect: number;
  /** The quilt was emptied. */
  cleared: boolean;
  spools: number;
  /** A new tray was dealt. */
  dealt: boolean;
}

function tally(q: Tally): Tally {
  return {
    score: q.score,
    streak: q.streak,
    sinceSeam: q.sinceSeam,
    patches: q.patches,
    seams: q.seams,
    perfect: q.perfect,
    doubles: q.doubles,
    bestStreak: q.bestStreak,
    clears: q.clears,
    spools: q.spools,
  };
}

function newTally(): Tally {
  return { score: 0, streak: 0, sinceSeam: 0, patches: 0, seams: 0, perfect: 0, doubles: 0, bestStreak: 0, clears: 0, spools: 0 };
}

export function newQuilt(mode: Mode, day: string | null, seed: number): Quilt {
  const q: Quilt = { mode, day, rng: seed >>> 0, board: B.emptyBoard(), tray: [], secondChanceUsed: false, undo: null, ...newTally() };
  deal(q);
  return q;
}

export function cellsOf(shape: ShapeId): number {
  return SHAPES[shape].cells.length;
}

/** The biggest shapes first, for a tray that would otherwise have nothing that fits. */
const BY_SIZE = [...SHAPE_IDS].sort((a, b) => cellsOf(b) - cellsOf(a));

/**
 * Draws for each tray slot. The first that fits the quilt as it is becomes the patch, so a
 * crowded quilt gets smaller patches. Every slot uses all its draws, so the random state moves
 * on the same way whatever the quilt looks like.
 */
export const DRAWS = 2;

/**
 * Fills the tray with new patches. At least one of them always fits: if none of the random
 * ones does, the last becomes the biggest shape that fits. One always does, because a full
 * quilt has no squares left that are not in a full seam.
 */
export function deal(q: Quilt): void {
  const rng = new Rng(q.rng);
  q.tray = Array.from({ length: TRAY }, () => {
    const draws = Array.from({ length: DRAWS }, () => ({ shape: rng.weighted(SHAPE_WEIGHTS), fabric: rng.int(FABRICS) }));
    return draws.find((patch) => B.fitsAnywhere(q.board, SHAPES[patch.shape])) ?? draws[0] ?? null;
  });
  q.rng = rng.state;
  if (!q.tray.some((patch) => patch && B.fitsAnywhere(q.board, SHAPES[patch.shape]))) {
    const last = q.tray[TRAY - 1];
    const shape = BY_SIZE.find((id) => B.fitsAnywhere(q.board, SHAPES[id])) ?? 'dot';
    q.tray[TRAY - 1] = { shape, fabric: last?.fabric ?? 0 };
  }
}

/** Whether any patch in the tray fits anywhere. */
export function canMove(q: Quilt): boolean {
  return q.tray.some((patch) => patch !== null && B.fitsAnywhere(q.board, SHAPES[patch.shape]));
}

export function canPlace(q: Quilt, slot: number, x: number, y: number): boolean {
  const patch = q.tray[slot];
  return patch != null && B.fits(q.board, SHAPES[patch.shape], x, y);
}

export function streakFactor(streak: number): number {
  return Math.min(STREAK_MAX_FACTOR, 1 + STREAK_STEP * Math.max(0, streak - 1));
}

/** The points for stitching these seams at once with this streak. */
export function seamPoints(seams: readonly B.Seam[], streak: number): number {
  const base = seams.reduce((sum, seam) => sum + SEAM_POINTS * (seam.fabric === null ? 1 : PERFECT_FACTOR), 0);
  return Math.round(base * seams.length * streakFactor(streak));
}

/** Places a patch from the tray; null when it does not fit there. */
export function place(q: Quilt, slot: number, x: number, y: number): Stitch | null {
  const patch = q.tray[slot];
  if (!patch || !canPlace(q, slot, x, y)) return null;
  q.undo = { ...tally(q), board: [...q.board], tray: q.tray.map((p) => (p ? { ...p } : null)), rng: q.rng };
  const sewn = B.sew(q.board, SHAPES[patch.shape], x, y, patch.fabric);
  const seams = B.fullSeams(q.board);
  const unpicked = B.unpickSeams(q.board, seams);
  q.patches += 1;
  let points = sewn.length * SQUARE_POINTS;
  let spools = 0;
  if (seams.length > 0) {
    q.streak = q.streak > 0 && q.sinceSeam <= STREAK_GRACE ? q.streak + 1 : 1;
    q.sinceSeam = 0;
    points += seamPoints(seams, q.streak);
  } else {
    q.sinceSeam += 1;
    if (q.sinceSeam > STREAK_GRACE) q.streak = 0;
  }
  const perfect = seams.filter((seam) => seam.fabric !== null).length;
  spools += perfect * PERFECT_SPOOLS;
  const cleared = seams.length > 0 && B.filledCount(q.board) === 0;
  if (cleared) {
    points += CLEAR_QUILT_POINTS;
    spools += CLEAR_QUILT_SPOOLS;
    q.clears += 1;
  }
  q.score += points;
  q.seams += seams.length;
  q.perfect += perfect;
  if (seams.length >= 2) q.doubles += 1;
  q.bestStreak = Math.max(q.bestStreak, q.streak);
  q.spools += spools;
  q.tray[slot] = null;
  const dealt = q.tray.every((p) => p === null);
  if (dealt) deal(q);
  return { sewn, seams, unpicked, points, streak: q.streak, perfect, cleared, spools, dealt };
}

/** Takes back the last patch. Returns the spools it had earned, which the player gives back. */
export function unpick(q: Quilt): number | null {
  const snap = q.undo;
  if (!snap) return null;
  const earned = q.spools - snap.spools;
  Object.assign(q, tally(snap));
  q.board = snap.board;
  q.tray = snap.tray;
  q.rng = snap.rng;
  q.undo = null;
  return earned;
}

/** Deals a whole new tray. */
export function newPatches(q: Quilt): void {
  q.undo = null;
  deal(q);
}

/** Snips one sewn square out of the quilt. */
export function snip(q: Quilt, x: number, y: number): boolean {
  const i = B.indexOf(x, y);
  if (x < 0 || y < 0 || x >= B.SIZE || y >= B.SIZE || q.board[i] === B.EMPTY) return false;
  q.board[i] = B.EMPTY;
  q.undo = null;
  return true;
}

/** Lines the second chance takes out. */
export const SECOND_CHANCE_LINES = 3;

/** Once a quilt: takes out its three fullest lines, and deals new patches if none fits yet. */
export function secondChance(q: Quilt): B.Unpicked[] | null {
  if (q.secondChanceUsed) return null;
  q.secondChanceUsed = true;
  q.undo = null;
  const unpicked = B.unpickSeams(q.board, B.fullestLines(q.board).slice(0, SECOND_CHANCE_LINES));
  if (!canMove(q)) deal(q);
  return unpicked;
}
