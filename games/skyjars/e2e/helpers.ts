import { exportSave, localDayKey } from '@game1/engine';
import { expect, type Page } from '@playwright/test';
import type { Mode } from '../src/sim/content.js';
import type { Jar } from '../src/sim/jars.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState, type Shelf } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone the tests might run in.
export const START = new Date('2026-10-29T12:00:00Z');
export const TODAY = localDayKey(START.getTime());
export const YESTERDAY = localDayKey(START.getTime() - 86_400_000);

/** The first level: two jars swapped at the top, and an empty one. */
export const TUTORIAL_SOLUTION = [
  [0, 2],
  [1, 0],
  [2, 1],
] as const;

/** Opens the game with a controllable clock that runs normally until a test moves it. */
export async function openGame(page: Page): Promise<void> {
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
}

/** Reads the stardust the way the game shows it. */
export async function stardust(page: Page): Promise<number> {
  const text = (await page.getByTestId('stardust').locator('.res__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9-]/g, ''));
}

/** A save made with the game's own code, to start a test from a later point in the game. */
export function makeSave(edit: (state: GameState) => void): string {
  const state = createState(START.getTime() - 86_400_000);
  state.taught = true;
  edit(state);
  return exportSave(saveFormat, state, START.getTime());
}

/** Deals the shelf of a mode as given, the way the game would have dealt it. */
export function deal(s: GameState, mode: Mode, jars: Jar[], capacity: number): Shelf {
  const shelf = R.openShelf(s, mode, TODAY);
  if (!shelf) throw new Error(`No ${mode} shelf to deal.`);
  shelf.capacity = capacity;
  shelf.start = jars.map((jar) => [...jar]);
  shelf.jars = jars.map((jar) => [...jar]);
  return shelf;
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

/** The units of a jar on screen, from the bottom. */
export async function units(page: Page, jar: number): Promise<number[]> {
  const text = (await page.getByTestId(`jar-${String(jar)}`).getAttribute('data-units')) ?? '';
  return text === '' ? [] : text.split(',').map(Number);
}

/** Every jar on the shelf, from the bottom. */
export async function shelf(page: Page): Promise<number[][]> {
  const count = await page.getByTestId('shelf').locator('.jarbtn').count();
  const jars: number[][] = [];
  for (let i = 0; i < count; i++) jars.push(await units(page, i));
  return jars;
}

/** Pours by tapping one jar and then another, the way a finger does. */
export async function pour(page: Page, from: number, to: number): Promise<void> {
  await page.getByTestId(`jar-${String(from)}`).tap();
  await expect(page.getByTestId(`jar-${String(from)}`)).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId(`jar-${String(to)}`).tap();
}

/** Plays a test ad through its countdown and claims the reward. */
export async function watchTestAd(page: Page): Promise<void> {
  await expect(page.getByTestId('test-ad')).toContainText('TEST AD');
  await expect(page.getByTestId('test-ad-claim')).toBeDisabled();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('test-ad')).toBeHidden();
}
