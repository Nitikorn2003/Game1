import { expect, test } from '@playwright/test';
import { coins, openGame, tap } from './helpers.js';

test('a new player taps for coins and buys an upgrade', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('hint')).toBeVisible();
  await expect(page.getByTestId('upgrade')).toBeDisabled();
  await tap(page, 20);
  await expect.poll(() => coins(page)).toBe(20);
  await expect(page.getByTestId('hint')).toBeHidden();
  await page.getByTestId('upgrade').click();
  await expect.poll(() => coins(page)).toBe(0);
  await expect(page.getByTestId('upgrade-card')).toContainText('Each tap gives 2 coins.');
  await tap(page, 3);
  await expect.poll(() => coins(page)).toBe(6);
});

test('a tap counts once, from a finger, a mouse or the keyboard', async ({ page }) => {
  await openGame(page);
  const button = page.getByTestId('tap');
  await button.tap();
  await expect.poll(() => coins(page)).toBe(1);
  await button.click();
  await expect.poll(() => coins(page)).toBe(2);
  await button.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect.poll(() => coins(page)).toBe(4);
});

test('progress survives a reload', async ({ page }) => {
  await openGame(page);
  await tap(page, 25);
  await page.getByTestId('upgrade').click();
  // The game saves after an upgrade, when the page is hidden or closed, and every few seconds.
  await page.clock.runFor(16_000);
  await page.reload();
  await expect(page.getByTestId('upgrade-card')).toContainText('Each tap gives 2 coins.');
  await expect.poll(() => coins(page)).toBe(5);
});

test('a test ad pays only after its countdown', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await expect(page.getByTestId('test-note')).toBeVisible();
  await page.getByTestId('watch-bonus').click();
  await expect(page.getByTestId('test-ad')).toContainText('TEST AD');
  await expect(page.getByTestId('test-ad-claim')).toBeDisabled();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('test-ad')).toBeHidden();
  await expect.poll(() => coins(page)).toBe(50);

  // Closing the ad early gives nothing.
  await page.getByTestId('watch-bonus').click();
  await page.getByTestId('test-ad-close').click();
  await page.clock.runFor(500);
  expect(await coins(page)).toBe(50);
});

test('a test purchase shows that no money is charged and delivers the coins once', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await page.getByTestId('buy-coins_small').click();
  const dialog = page.getByTestId('test-purchase');
  await expect(dialog).toContainText('No money is charged');
  await expect(dialog).toContainText('$0.99');
  await page.getByTestId('test-purchase-cancel').click();
  await page.clock.runFor(300);
  expect(await coins(page)).toBe(0);

  await page.getByTestId('buy-coins_small').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect.poll(() => coins(page)).toBe(500);
  await page.reload();
  await expect.poll(() => coins(page)).toBe(500);
});

test('the game speaks Thai', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('lang-th').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('upgrade')).toContainText('อัปเกรด');
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await page.getByTestId('open-settings').click();
  await page.getByTestId('open-privacy').click();
  await expect(page.getByTestId('privacy-modal')).toContainText('เราคือใคร');
});
