import { exportSave } from '@game1/engine';
import { expect, type Page } from '@playwright/test';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

export const START = new Date('2026-10-29T03:00:00Z');

/** Opens the game with a controllable clock that runs normally until a test moves it. */
export async function openGame(page: Page): Promise<void> {
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByTestId('rock')).toBeVisible();
}

/** Reads a number the way the game shows it (no suffixes in the early game). */
export async function shownNumber(page: Page, testId: string): Promise<number> {
  const text = (await page.getByTestId(testId).locator('.res__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9.]/g, ''));
}

export async function tapRock(page: Page, times: number): Promise<void> {
  const rock = page.getByTestId('rock');
  for (let i = 0; i < times; i++) {
    await rock.dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerType: 'touch' });
    // Stay under the 25 taps a second limit.
    await page.clock.runFor(50);
  }
}

/** A save made with the game's own code, to start a test from a later point in the game. */
export function makeSave(edit: (state: GameState) => void, now = START.getTime()): string {
  const state = createState(now, 7, R.blockHp(1));
  edit(state);
  return exportSave(saveFormat(R.blockHp), state, now);
}

export async function loadSave(page: Page, save: string): Promise<void> {
  await page.getByTestId('open-settings').click();
  await page.getByTestId('import-save').click();
  await page.getByTestId('import-text').fill(save);
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('settings-message')).toBeVisible();
  await page.keyboard.press('Escape');
}
