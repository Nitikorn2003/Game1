import { expect, type Page } from '@playwright/test';

export const START = new Date('2026-10-29T03:00:00Z');

/** Opens the game with a controllable clock that runs normally until a test moves it. */
export async function openGame(page: Page): Promise<void> {
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByTestId('tap')).toBeVisible();
}

/** Reads the coins the way the game shows them (no suffixes below a thousand). */
export async function coins(page: Page): Promise<number> {
  const text = (await page.getByTestId('coins').locator('.res__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9.]/g, ''));
}

export async function tap(page: Page, times: number): Promise<void> {
  const button = page.getByTestId('tap');
  for (let i = 0; i < times; i++) {
    await button.dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerType: 'touch' });
    await page.clock.runFor(50);
  }
}
