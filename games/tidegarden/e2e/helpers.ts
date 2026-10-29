import { exportSave, localDayKey } from '@game1/engine';
import { expect, type Locator, type Page } from '@playwright/test';
import { movable, type Move } from '../src/sim/board.js';
import { TIPS } from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone the tests might run in.
export const START = new Date('2026-10-29T12:00:00Z');
export const TODAY = localDayKey(START.getTime());
export const YESTERDAY = localDayKey(START.getTime() - 86_400_000);

/** Opens the game with a controllable clock that runs normally until a test moves it. */
export async function openGame(page: Page): Promise<void> {
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
}

/** Reads the sand dollars the way the game shows them. */
export async function coins(page: Page): Promise<number> {
  const text = (await page.getByTestId('coins').locator('.res__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9-]/g, ''));
}

/** A player who has reached the first `levels` levels, with three stars on each. */
export function player(levels = 0): GameState {
  const s = createState(START.getTime() - 86_400_000);
  s.stars = new Array<number>(levels).fill(3);
  s.stats.won = levels;
  // The notes on what is new have been read, so they stay out of the way.
  s.tips = [...TIPS];
  return s;
}

/** A save made with the game's own code, to start a test from a later point in the game. */
export function saveOf(s: GameState): string {
  return exportSave(saveFormat, s, START.getTime());
}

export async function loadSave(page: Page, save: string): Promise<void> {
  await page.getByTestId('open-settings').click();
  await page.getByTestId('import-save').click();
  await page.getByTestId('import-text').fill(save);
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('settings-message')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
}

/**
 * Plays the game's own hint moves on the dive in progress until one more would reach the goals,
 * and returns that move with what the game says it will pay. Throws if the dive runs out first.
 */
export function toTheLast(s: GameState): { move: Move; stars: number; pay: number } {
  for (let guard = 0; guard < 200; guard++) {
    const move = R.hintMove(s);
    if (!move) break;
    const ahead = structuredClone(s);
    const moved = R.swap(ahead, move.from, move.to);
    if (!moved) break;
    if (moved.result) return { move, stars: moved.result.stars, pay: moved.result.pay };
    R.swap(s, move.from, move.to);
    if (R.isStuck(s)) break;
  }
  throw new Error('The dive ran out before its goals were reached.');
}

/** Starts a dive with `open` that hint moves reach, trying new boards until one is, and plays it up to its last move. */
export function winnable(s: GameState, open: () => unknown): { move: Move; stars: number; pay: number } {
  for (let tries = 0; tries < 50; tries++) {
    s.current = null;
    if (!open()) throw new Error('The dive could not start.');
    try {
      toTheLast(structuredClone(s));
      return toTheLast(s);
    } catch {
      // Another board.
    }
  }
  throw new Error('No try at the dive could be reached.');
}

/** Leaves the dive in progress out of moves, its goals not reached. */
export function runOut(s: GameState): void {
  const c = s.current;
  if (!c) throw new Error('No dive to run out.');
  c.dive.movesLeft = 1;
  const move = R.hintMove(s);
  if (!move) throw new Error('No move to make.');
  const moved = R.swap(s, move.from, move.to);
  if (moved?.result || !R.isStuck(s)) throw new Error('The dive did not run out.');
}

/** Two pieces side by side, both free to move, that make no match and fire nothing when swapped. */
export function noSwap(s: GameState): Move {
  const b = s.current?.dive.board;
  if (!b) throw new Error('No dive in progress.');
  for (let cell = 0; cell < b.pieces.length - 1; cell++) {
    if ((cell + 1) % b.width === 0 || !movable(b, cell) || !movable(b, cell + 1)) continue;
    if (!R.canSwap(s, cell, cell + 1)) return { from: cell, to: cell + 1 };
  }
  throw new Error('Every swap works.');
}

export function cell(page: Page, at: number): Locator {
  return page.getByTestId(`cell-${String(at)}`);
}

/** The piece on a cell, once the board has come to rest. */
export function piece(page: Page, at: number): Locator {
  return page.locator(`.pc[data-cell="${String(at)}"]`);
}

async function centreOf(page: Page, at: number): Promise<{ x: number; y: number }> {
  const box = await cell(page, at).boundingBox();
  if (!box) throw new Error(`Cell ${String(at)} is not on the screen.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Swipes a piece onto another, the way a finger does. */
export async function swipe(page: Page, move: Move): Promise<void> {
  const start = await centreOf(page, move.from);
  const end = await centreOf(page, move.to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();
}

/** Taps a cell of the board. */
export async function tapCell(page: Page, at: number): Promise<void> {
  const { x, y } = await centreOf(page, at);
  await page.mouse.click(x, y);
}

/** Waits for the board to finish playing out a move. */
export async function rested(page: Page): Promise<void> {
  await expect(page.getByTestId('board')).toHaveAttribute('data-busy', 'false');
}

/** Opens the dive in progress from the home screen. */
export async function dive(page: Page, button: 'play-next' | 'play-daily' = 'play-next'): Promise<void> {
  await page.getByTestId(button).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

/** Plays a test ad through its countdown and claims the reward. */
export async function watchTestAd(page: Page): Promise<void> {
  await expect(page.getByTestId('test-ad')).toContainText('TEST AD');
  await expect(page.getByTestId('test-ad-claim')).toBeDisabled();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('test-ad')).toBeHidden();
}
