import { expect, test } from '@playwright/test';
import * as C from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { TODAY, loadSave, makeSave, mouseDrag, openGame, quilt, score, sewn, spools, touchDrag } from './helpers.js';

const EMPTY = '........ '.repeat(8);

/** The top row sewn up to x = 5, and one square in the far corner. */
const SIX = `
  012301..
  ........
  ........
  ........
  ........
  ........
  ........
  .......2`;

/** One hole in every row and column: none of three 3 by 3 patches fits. */
const FULL = `
  .0011223
  0.011223
  00.12233
  001.2233
  2233.100
  22331.00
  331100.2
  3311002.`;

test('a first quilt: pick a patch up, sew it and score', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('play-endless').click();
  await expect(page.getByTestId('hint')).toBeVisible();
  await page.getByTestId('patch-0').tap();
  await expect(page.getByTestId('patch-0')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-square="3,3"]').tap();
  await expect.poll(() => score(page)).toBeGreaterThan(0);
  await expect(page.getByTestId('patch-0')).toBeDisabled();
  await expect(page.getByTestId('hint')).toBeHidden();
  // Whatever its shape, the patch covers the square that was tapped, and scores a point a square.
  expect(await sewn(page, 3, 3)).toBe(true);
  expect(await page.locator('[data-testid=board] > .sq--sewn').count()).toBe(await score(page));
});

test('a patch dragged onto the quilt is sewn where it lands, and a full row becomes a seam', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => (s.quilts.endless = quilt('endless', SIX, [['duo_h', 1], ['dot', 0], ['dot', 3]]))));
  await page.getByTestId('play-endless').click();
  await mouseDrag(page, 0, 'duo_h', 6, 0);
  await expect(page.getByTestId('effect')).toContainText('+12');
  expect(await score(page)).toBe(12);
  for (const x of [0, 3, 6, 7]) expect(await sewn(page, x, 0)).toBe(false);
  expect(await sewn(page, 7, 7)).toBe(true);
});

test('a finger drag carries the patch above the finger and sews it where it shows', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => (s.quilts.endless = quilt('endless', EMPTY, [['square', 2], ['dot', 0], ['dot', 3]]))));
  await page.getByTestId('play-endless').click();
  await touchDrag(page, 0, 'square', 2, 3);
  await expect.poll(() => score(page)).toBe(4);
  for (const [x, y] of [[2, 3], [3, 3], [2, 4], [3, 4]] as const) expect(await sewn(page, x, y)).toBe(true);
  expect(await sewn(page, 2, 5)).toBe(false);
});

test('a patch dropped where it does not fit goes back to the tray', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => (s.quilts.endless = quilt('endless', SIX, [['square', 2], ['dot', 0], null]))));
  await page.getByTestId('play-endless').click();
  await mouseDrag(page, 0, 'square', 4, 0);
  await expect(page.getByTestId('patch-0')).toBeEnabled();
  expect(await score(page)).toBe(0);
});

test('the keyboard can sew too: Enter picks a patch, the arrows move it and Enter sews it', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => (s.quilts.endless = quilt('endless', EMPTY, [['square', 2], ['dot', 0], ['dot', 3]]))));
  await page.getByTestId('play-endless').click();
  await page.getByTestId('patch-1').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('patch-1')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect.poll(() => sewn(page, 5, 2)).toBe(true);
  await expect(page.getByTestId('patch-1')).toBeDisabled();
});

test('a quilt out of room gets a second chance from a test ad, which pays only after its countdown', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => (s.quilts.endless = quilt('endless', FULL, [['block', 0], ['block', 1], ['block', 2]]))));
  await page.getByTestId('play-endless').click();
  await expect(page.getByTestId('stuck')).toBeVisible();
  await page.getByTestId('second-chance').click();
  await expect(page.getByTestId('test-ad')).toContainText('TEST AD');
  await expect(page.getByTestId('test-ad-claim')).toBeDisabled();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('stuck')).toBeHidden();
  for (const x of [1, 4, 7]) expect(await sewn(page, x, 0)).toBe(false);
  // The block now fits in the emptied rows, and it fills the first three columns: three seams.
  await mouseDrag(page, 0, 'block', 0, 0);
  await expect.poll(() => score(page)).toBe(9 + 3 * 30);
  expect(await sewn(page, 0, 5)).toBe(false);
});

test('finishing a quilt pays a spool for every hundred points, and an ad doubles them once', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.quilts.endless = quilt('endless', FULL, [['block', 0], ['slab_h', 1], null]);
      s.quilts.endless.score = 1234;
      s.quilts.endless.patches = 40;
      s.quilts.endless.secondChanceUsed = true;
    }),
  );
  await page.getByTestId('play-endless').click();
  await expect(page.getByTestId('second-chance')).toBeHidden();
  await page.getByTestId('finish').click();
  await expect(page.getByTestId('result-score')).toHaveText('1,234 points');
  await expect(page.getByTestId('new-best')).toBeVisible();
  await expect(page.getByTestId('result-spools')).toContainText('+12 spools');
  expect(await spools(page)).toBe(12);
  await page.getByTestId('double').click();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('result-spools')).toContainText('+24 spools');
  await expect(page.getByTestId('double')).toBeHidden();
  expect(await spools(page)).toBe(24);
  await page.getByTestId('result-again').click();
  await expect(page.getByTestId('play')).toBeVisible();
  expect(await score(page)).toBe(0);
  await expect(page.getByTestId('goal')).toContainText('1,234');
});

test('the daily quilt pays its reward once and shows as done at home', async ({ page }) => {
  const target = R.dailyTarget(TODAY);
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.quilts.daily = quilt('daily', SIX, [['duo_h', 1], ['dot', 0], ['dot', 3]]);
      s.quilts.daily.score = target - 5;
      s.quilts.daily.patches = 30;
    }),
  );
  await expect(page.getByTestId('daily-status')).toContainText(target.toLocaleString('en-US'));
  await page.getByTestId('play-daily').click();
  await expect(page.getByTestId('goal')).toContainText(`Goal ${target.toLocaleString('en-US')}`);
  await mouseDrag(page, 0, 'duo_h', 6, 0);
  await expect(page.getByText(`Daily quilt done! +${String(C.DAILY_SPOOLS)} spools`)).toBeVisible();
  await expect(page.getByTestId('goal')).toHaveText('Goal reached!');
  expect(await spools(page)).toBe(C.DAILY_SPOOLS);
  await mouseDrag(page, 1, 'dot', 0, 0);
  await expect.poll(() => sewn(page, 0, 0)).toBe(true);
  expect(await spools(page)).toBe(C.DAILY_SPOOLS);
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('daily-status')).toHaveText('Done for today. A new daily quilt comes tomorrow.');
  await expect(page.getByTestId('daily-streak')).toContainText('1');
});

test('a finished commission is claimed for spools and another one takes its place', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      const first = s.commissions[0];
      if (first) first.progress = R.commissionTarget(first);
    }),
  );
  await expect(page.getByTestId('commission-0')).toContainText('Stitch seams');
  await page.getByTestId('claim-0').click();
  await expect.poll(() => spools(page)).toBe(C.COMMISSION_REWARDS[0]);
  await expect(page.getByTestId('claim-0')).toBeHidden();
  await expect(page.getByTestId('commission-0')).not.toContainText('Stitch seams');
});

test('Unpick takes the last patch back, and Snip cuts out one square, for spools', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.spools = 50;
      s.quilts.endless = quilt('endless', SIX, [['square', 2], ['dot', 0], ['dot', 3]]);
    }),
  );
  await page.getByTestId('play-endless').click();
  await expect(page.getByTestId('tool-unpick')).toBeDisabled();
  await mouseDrag(page, 0, 'square', 0, 4);
  await expect.poll(() => sewn(page, 0, 4)).toBe(true);
  await page.getByTestId('tool-unpick').click();
  await expect.poll(() => sewn(page, 0, 4)).toBe(false);
  await expect(page.getByTestId('patch-0')).toBeEnabled();
  expect(await spools(page)).toBe(50 - C.TOOL_COSTS.unpick);

  await page.getByTestId('tool-snip').click();
  await expect(page.getByTestId('snip-hint')).toBeVisible();
  await page.locator('[data-square="2,0"]').click();
  await expect.poll(() => sewn(page, 2, 0)).toBe(false);
  await expect(page.getByTestId('snip-hint')).toBeHidden();
  expect(await spools(page)).toBe(50 - C.TOOL_COSTS.unpick - C.TOOL_COSTS.snip);
});

test('a fabric set bought with spools is used for the patches at once', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.spools = 200;
      s.quilts.endless = quilt('endless', EMPTY, [['dot', 0], null, null]);
    }),
  );
  await page.getByTestId('open-fabrics').click();
  await expect(page.getByTestId('buy-fabric-sunset')).toBeDisabled();
  await page.getByTestId('buy-fabric-meadow').click();
  await expect(page.getByTestId('fabric-meadow')).toContainText('In use');
  expect(await spools(page)).toBe(200 - C.FABRIC_COSTS.meadow);
  await page.keyboard.press('Escape');
  await page.getByTestId('play-endless').click();
  // Meadow's first fabric is a leafy green.
  await expect(page.getByTestId('patch-0').locator('.sq')).toHaveCSS('background-color', 'rgb(92, 159, 87)');
});

test('a test purchase shows that no money is charged and delivers the spools once', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await expect(page.getByTestId('test-note')).toBeVisible();
  await page.getByTestId('buy-spools_small').click();
  const dialog = page.getByTestId('test-purchase');
  await expect(dialog).toContainText('No money is charged');
  await expect(dialog).toContainText('$0.99');
  await page.getByTestId('test-purchase-cancel').click();
  await page.clock.runFor(300);
  expect(await spools(page)).toBe(0);

  await page.getByTestId('buy-spools_small').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect.poll(() => spools(page)).toBe(60);
  await page.reload();
  await expect.poll(() => spools(page)).toBe(60);
});

test('free spools from a test ad, with the daily limit shown', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await expect(page.getByTestId('offer-free')).toContainText(`${String(R.AD_LIMITS.perPlacement.free_spools)} left today`);
  await page.getByTestId('watch-free').click();
  await page.getByTestId('test-ad-close').click();
  await page.clock.runFor(500);
  expect(await spools(page)).toBe(0);
  await page.getByTestId('watch-free').click();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect.poll(() => spools(page)).toBe(C.FREE_SPOOLS);
  await expect(page.getByTestId('offer-free')).toContainText(`${String(R.AD_LIMITS.perPlacement.free_spools - 1)} left today`);
});

test('a quilt keeps its place: Escape goes home, and it is still there after a reload', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => (s.quilts.endless = quilt('endless', EMPTY, [['square', 2], ['dot', 0], ['dot', 3]]))));
  await page.getByTestId('play-endless').click();
  await mouseDrag(page, 0, 'square', 1, 1);
  await expect.poll(() => sewn(page, 1, 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.getByTestId('play-endless')).toContainText('Continue');
  await page.reload();
  await page.getByTestId('play-endless').click();
  expect(await sewn(page, 2, 2)).toBe(true);
  expect(await score(page)).toBe(4);
});

test('the sewing screen fits a small phone without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openGame(page);
  await page.getByTestId('play-endless').click();
  for (const id of ['board', 'tray', 'tool-snip', 'hint']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0), id).toBeLessThanOrEqual(640);
    expect((box?.x ?? 0) + (box?.width ?? 0), id).toBeLessThanOrEqual(360);
  }
});

test('the game speaks Thai', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('lang-th').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mode-endless')).toContainText('ผ้าห่มไม่รู้จบ');
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await page.getByTestId('open-settings').click();
  await page.getByTestId('open-privacy').click();
  await expect(page.getByTestId('privacy-modal')).toContainText('เราคือใคร');
});
