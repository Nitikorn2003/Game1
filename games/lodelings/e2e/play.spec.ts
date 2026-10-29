import { expect, test } from '@playwright/test';
import { loadSave, makeSave, openGame, shownNumber, tapRock } from './helpers.js';

test('a new player taps, hatches the starter egg and levels up the new Lodeling', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('hint')).toContainText('Tap the rock');
  await tapRock(page, 30);
  expect(await shownNumber(page, 'ore')).toBeGreaterThan(0);

  await page.clock.runFor(10_000);
  await page.getByTestId('tab-eggs').click();
  await page.getByTestId('hatch-0').click();
  await expect(page.getByTestId('hatch-headline')).toHaveText('New Lodeling!');
  const name = (await page.getByTestId('hatch-name').textContent()) ?? '';
  await page.getByTestId('hatch-ok').click();

  await page.getByTestId('tab-upgrades').click();
  const row = page.locator('[data-testid^="level-row-"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(name);
  await tapRock(page, 40);
  const level = row.locator('[data-testid^="level-"]').last();
  await expect(level).toBeEnabled();
  await level.click();
  await expect(row).toContainText('Lv 2');
});

test('progress survives a reload', async ({ page }) => {
  await openGame(page);
  await tapRock(page, 40);
  await page.getByTestId('gear-pick').click();
  await expect(page.getByTestId('gear-row-pick')).toContainText('Lv 1');
  const ore = await shownNumber(page, 'ore');
  // The game saves when the page is hidden or closed, and every few seconds.
  await page.clock.runFor(16_000);
  await page.reload();
  await expect(page.getByTestId('gear-row-pick')).toContainText('Lv 1');
  expect(await shownNumber(page, 'ore')).toBeGreaterThanOrEqual(ore);
});

test('the team keeps mining while the game is closed', async ({ page }) => {
  await openGame(page);
  await page.clock.runFor(11_000);
  await page.getByTestId('tab-eggs').click();
  await page.getByTestId('hatch-0').click();
  await page.getByTestId('hatch-ok').click();
  await page.clock.fastForward('02:00:00');
  const modal = page.getByTestId('offline-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Welcome back!');
  await expect(modal).toContainText('2h 00m');
  const before = await shownNumber(page, 'ore');
  await page.getByTestId('offline-collect').click();
  await expect(modal).toBeHidden();
  expect(await shownNumber(page, 'ore')).toBeGreaterThan(before);
});

test('a test ad pays only after its countdown', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('tab-shop').click();
  await expect(page.getByTestId('test-note')).toBeVisible();
  const gems = await shownNumber(page, 'gems');
  await page.getByTestId('watch-gem_crate').click();
  await expect(page.getByTestId('test-ad')).toContainText('TEST AD');
  await expect(page.getByTestId('test-ad-claim')).toBeDisabled();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('test-ad')).toBeHidden();
  await expect.poll(() => shownNumber(page, 'gems')).toBe(gems + 8);

  // Closing the ad early gives nothing.
  await page.getByTestId('watch-gem_crate').click();
  await page.getByTestId('test-ad-close').click();
  await page.clock.runFor(500);
  expect(await shownNumber(page, 'gems')).toBe(gems + 8);
});

test('a test purchase shows that no money is charged and delivers gems once', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('tab-shop').click();
  const gems = await shownNumber(page, 'gems');
  await page.getByTestId('buy-gems_small').click();
  const dialog = page.getByTestId('test-purchase');
  await expect(dialog).toContainText('No money is charged');
  await expect(dialog).toContainText('$0.99');
  await page.getByTestId('test-purchase-cancel').click();
  await page.clock.runFor(300);
  expect(await shownNumber(page, 'gems')).toBe(gems);

  await page.getByTestId('buy-gems_small').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect.poll(() => shownNumber(page, 'gems')).toBe(gems + 100);
  await page.reload();
  await expect.poll(() => shownNumber(page, 'gems')).toBe(gems + 100);
});

test('typing in a screen keeps the cursor there, and Escape closes the screen', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('import-save').click();
  await page.getByTestId('import-text').click();
  await page.keyboard.type('L1:abc');
  await expect(page.getByTestId('import-text')).toHaveValue('L1:abc');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('import-text')).toBeHidden();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the game speaks Thai', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('lang-th').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tab-upgrades')).toContainText('อัปเกรด');
  await expect(page.getByTestId('depth')).toContainText('ชั้น 1');
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
});

test('a Guardian fight can be lost, farmed and won', async ({ page }) => {
  await openGame(page);
  // Start at the last rock before the depth 5 Guardian, with a weak team.
  await loadSave(
    page,
    makeSave((s) => {
      s.depth = 5;
      s.block = 8;
      s.hp = 1;
      s.maxDepth = 5;
      s.bestDepth = 5;
      s.roster = { mossling: { level: 1, stars: 0 } };
      s.team = ['mossling'];
      s.incubators = [null];
    }),
  );
  await tapRock(page, 1);
  await expect(page.getByTestId('guardian-timer')).toBeVisible();
  await page.clock.runFor(31_000);
  await expect(page.getByTestId('farming')).toBeVisible();
  await expect(page.getByTestId('retry-ad')).toBeVisible();

  // Come back much stronger and win.
  await loadSave(
    page,
    makeSave((s) => {
      s.depth = 5;
      s.block = 8;
      s.hp = 1;
      s.maxDepth = 5;
      s.bestDepth = 5;
      s.roster = { mossling: { level: 60, stars: 0 } };
      s.team = ['mossling'];
      s.incubators = [null];
    }),
  );
  await tapRock(page, 1);
  await expect(page.getByTestId('guardian-timer')).toBeVisible();
  await page.clock.runFor(1_500);
  await expect(page.getByText(/defeated!/)).toBeVisible();
  await expect(page.getByTestId('depth')).not.toContainText('Depth 5');
});
