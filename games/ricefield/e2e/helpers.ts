import { exportSave, localDayKey } from '@game1/engine';
import { expect, type Locator, type Page } from '@playwright/test';
import { UNKNOWN } from '../src/sim/nonogram.js';
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

/** Reads the seeds the way the game shows them. */
export async function seeds(page: Page): Promise<number> {
  const text = (await page.getByTestId('seeds').locator('.res__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9-]/g, ''));
}

/** A save made with the game's own code, to start a test from a later point in the game. */
export function makeSave(edit: (state: GameState) => void): string {
  const state = createState(START.getTime() - 86_400_000);
  state.taught = true;
  edit(state);
  return exportSave(saveFormat, state, START.getTime());
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
 * Opens a field and plants all of its picture but one cell, the way a player who never goes
 * wrong would, through the game's rules. Returns the cell still to plant.
 */
export function allButOne(s: GameState, key: R.FieldKey): number {
  const field = key === 'daily' ? R.openDaily(s, TODAY) : R.openAlbumField(s, key);
  if (!field) throw new Error(`No ${key} field to play.`);
  const { shape } = R.puzzleOfField(field);
  const toPlant = field.board.flatMap((state, cell) => (state === UNKNOWN && shape.filled[cell] ? [cell] : []));
  const last = toPlant.pop();
  if (last === undefined) throw new Error(`The ${key} field has nothing to plant.`);
  for (const cell of toPlant) {
    const acted = R.act(s, key, cell, 'plant');
    if (!acted || acted.mistake || acted.result) throw new Error(`Planting the ${key} field went wrong at cell ${String(cell)}.`);
  }
  return last;
}

export function cell(page: Page, at: number): Locator {
  return page.getByTestId(`cell-${String(at)}`);
}

/** Taps a cell of the field, the way a finger does. */
export async function tapCell(page: Page, at: number): Promise<void> {
  await cell(page, at).tap();
}

async function centreOf(page: Page, at: number): Promise<{ x: number; y: number }> {
  const box = await cell(page, at).boundingBox();
  if (!box) throw new Error(`Cell ${String(at)} is not on the screen.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Drags from one cell to another along a row or a column. */
export async function drag(page: Page, from: number, to: number): Promise<void> {
  const start = await centreOf(page, from);
  const end = await centreOf(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

/** How many cells of the field are known: planted or pebbled. */
export async function known(page: Page): Promise<number> {
  return page.locator('.cell--rice, .cell--pebble').count();
}

/** Plays a test ad through its countdown and claims the reward. */
export async function watchTestAd(page: Page): Promise<void> {
  await expect(page.getByTestId('test-ad')).toContainText('TEST AD');
  await expect(page.getByTestId('test-ad-claim')).toBeDisabled();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('test-ad')).toBeHidden();
}
