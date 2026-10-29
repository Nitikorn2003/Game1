import { expect, test, type Page } from '@playwright/test';
import * as C from '../src/sim/content.js';
import { makeLevel } from '../src/sim/levels.js';
import * as R from '../src/sim/rules.js';
import { YESTERDAY, deal, loadSave, makeSave, openGame, pour, shelf, stardust, units, watchTestAd } from './helpers.js';

const TUTORIAL = [[0, 0, 0, 1], [1, 1, 1, 0], []];

/** Two jars, each topped with the other's colour, and an empty one. */
const MIXED = [[0, 0, 1], [1, 1, 0], []];

/** One pour from solved: the single rose goes onto the other three. */
const NEARLY = [[0, 0, 0], [0], [1, 1, 1, 1]];

/** Pours are left, but none of them leads to a solved shelf. */
const DEAD = [[1, 0], [0, 2, 2], [1, 2], [1, 0]];

/** Both jars full and mixed: not a single pour can be made. */
const STUCK = [[0, 1], [1, 0]];

/** The jar a hint mark sits on. */
async function marked(page: Page, mark: 'hint-from' | 'hint-to'): Promise<number> {
  const id = await page.getByTestId('shelf').locator('.jarbtn', { has: page.getByTestId(mark) }).getAttribute('data-testid');
  return Number(id?.replace('jar-', ''));
}

test('the first level: lift a jar, pour, solve it and light the first star', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('atlas-progress')).toHaveText('0 of 3 stars lit');
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('shelf-title')).toHaveText('Level 1');
  await expect(page.getByTestId('teach')).toBeVisible();
  expect(await shelf(page)).toEqual(TUTORIAL);
  await pour(page, 0, 2);
  await expect.poll(() => shelf(page)).toEqual([[0, 0, 0], [1, 1, 1, 0], [1]]);
  await expect(page.getByTestId('teach')).toBeHidden();
  await pour(page, 1, 0);
  await pour(page, 2, 1);
  await expect(page.getByTestId('solved')).toBeVisible();
  await expect(page.getByTestId('results')).toBeVisible();
  await expect(page.getByTestId('result-pours')).toHaveText('Solved in 3 pours');
  await expect(page.getByTestId('result-clean')).toBeVisible();
  await expect(page.getByTestId('result-stardust')).toHaveText(`+${String(C.levelStardust(1) + C.CLEAN_BONUS)} stardust`);
  await expect(page.getByTestId('result-star')).toHaveText('A new star in The Kettle');
  expect(await stardust(page)).toBe(C.levelStardust(1) + C.CLEAN_BONUS);
  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('shelf-title')).toHaveText('Level 2');
  await page.reload();
  await expect(page.getByTestId('level-name')).toHaveText('Level 2');
  await expect(page.getByTestId('atlas-progress')).toHaveText('1 of 3 stars lit');
});

test('a jar that cannot take the pour is lifted instead, and empty or finished jars cannot be lifted', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => deal(s, 'level', MIXED, 3)));
  await page.getByTestId('play-level').click();
  await page.getByTestId('jar-2').tap();
  await expect(page.getByTestId('jar-2')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('jar-0').tap();
  // The full jar takes nothing, so tapping it lifts it instead.
  await page.getByTestId('jar-1').tap();
  await expect(page.getByTestId('jar-0')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('jar-1')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('jar-2').tap();
  await expect.poll(() => shelf(page)).toEqual([[0, 0, 1], [1, 1], [0]]);
  await pour(page, 0, 1);
  await expect.poll(() => shelf(page)).toEqual([[0, 0], [1, 1, 1], [0]]);
  await page.getByTestId('jar-1').tap();
  await expect(page.getByTestId('jar-1')).toHaveAttribute('aria-pressed', 'false');
  // A second tap on the lifted jar puts it down.
  await page.getByTestId('jar-2').tap();
  await page.getByTestId('jar-2').tap();
  await expect(page.getByTestId('jar-2')).toHaveAttribute('aria-pressed', 'false');
  await pour(page, 2, 0);
  await expect(page.getByTestId('solved')).toBeVisible();
  await expect(page.getByTestId('result-pours')).toHaveText('Solved in 3 pours');
});

test('the keyboard can pour: Enter or Space lifts a jar, Enter on another pours, Escape puts it down', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('play-level').click();
  await page.getByTestId('jar-0').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('jar-0')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('jar-0')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('play')).toBeVisible();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect.poll(() => units(page, 2)).toEqual([1]);
  await expect(page.getByTestId('jar-0')).toHaveAccessibleName('Jar 1, from the bottom: rose heart, rose heart, rose heart');
  await expect(page.getByTestId('jar-2')).toHaveAccessibleName('Jar 3, from the bottom: amber sun');
  // With nothing lifted, Escape goes home.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('home')).toBeVisible();
});

test('Undo takes pours back: five are free, and more come from a test ad', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      deal(s, 'level', MIXED, 3).undosLeft = 1;
    }),
  );
  await page.getByTestId('play-level').click();
  const undo = page.getByTestId('tool-undo');
  await expect(undo).toBeDisabled();
  await pour(page, 1, 2);
  await expect(undo).toHaveText('Undo1');
  await undo.click();
  await expect.poll(() => shelf(page)).toEqual(MIXED);
  await pour(page, 1, 2);
  await expect(undo).toHaveText('More undos+');
  await undo.click();
  await expect(page.getByTestId('tool-sheet')).toContainText(`Get ${String(C.MORE_UNDOS)} more`);
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(undo).toHaveText(`Undo${String(C.MORE_UNDOS)}`);
  await undo.click();
  await expect.poll(() => shelf(page)).toEqual(MIXED);
  await expect(undo).toHaveText(`Undo${String(C.MORE_UNDOS - 1)}`);
});

test('Restart wants a second tap, soon after the first, and deals the shelf again', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('play-level').click();
  const restart = page.getByTestId('tool-restart');
  await expect(restart).toBeDisabled();
  await pour(page, 0, 2);
  await restart.click();
  await expect(restart).toHaveText('Tap again');
  await page.clock.runFor(3_500);
  await expect(restart).toHaveText('Restart');
  expect(await shelf(page)).toEqual([[0, 0, 0], [1, 1, 1, 0], [1]]);
  await restart.click();
  await restart.click();
  await expect.poll(() => shelf(page)).toEqual(TUTORIAL);
  await expect(restart).toBeDisabled();
  await expect(page.getByTestId('tool-undo')).toHaveText(`Undo${String(C.UNDOS_PER_SHELF)}`);
});

test('a hint marks a pour on the way to solving, for stardust or a test ad', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 40;
      s.stats.levels = 39;
      s.stardust = 100;
    }),
  );
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('shelf-title')).toHaveText('Level 40');
  await page.getByTestId('tool-hint').click();
  await expect(page.getByTestId('tool-spend')).toHaveText(`Use ${String(C.TOOL_COSTS.hint)} stardust`);
  await page.getByTestId('tool-spend').click();
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(page.getByTestId('hint-note')).toBeVisible();
  await expect(page.getByTestId('tool-hint')).toBeDisabled();
  expect(await stardust(page)).toBe(100 - C.TOOL_COSTS.hint);
  const from = await marked(page, 'hint-from');
  const to = await marked(page, 'hint-to');
  const before = (await units(page, to)).length;
  await pour(page, from, to);
  await expect(page.getByTestId('hint-from')).toBeHidden();
  await expect(page.getByTestId('hint-to')).toBeHidden();
  expect((await units(page, to)).length).toBeGreaterThan(before);
  // The next hint, from a test ad: the stardust stays.
  await page.getByTestId('tool-hint').click();
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('hint-from')).toBeVisible();
  await expect(page.getByTestId('hint-to')).toBeVisible();
  expect(await stardust(page)).toBe(100 - C.TOOL_COSTS.hint);
});

test('a hint that finds no way forward says so and costs nothing', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.stardust = 100;
      deal(s, 'level', DEAD, 3);
    }),
  );
  await page.getByTestId('play-level').click();
  await page.getByTestId('tool-hint').click();
  await expect(page.getByTestId('no-way')).toBeVisible();
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  expect(await stardust(page)).toBe(100);
  // The note is about the jars as they stood.
  await pour(page, 0, 3);
  await expect(page.getByTestId('no-way')).toBeHidden();
});

test('an extra jar for stardust: one a shelf, and Restart keeps it', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 40;
      s.stats.levels = 39;
      s.stardust = 100;
    }),
  );
  await page.getByTestId('play-level').click();
  const jars = page.getByTestId('shelf').locator('.jarbtn');
  const dealt = await jars.count();
  await page.getByTestId('tool-extraJar').click();
  await expect(page.getByTestId('tool-spend')).toHaveText(`Use ${String(C.TOOL_COSTS.extraJar)} stardust`);
  await page.getByTestId('tool-spend').click();
  await expect(jars).toHaveCount(dealt + 1);
  expect(await units(page, dealt)).toEqual([]);
  await expect(page.getByTestId('tool-extraJar')).toBeDisabled();
  expect(await stardust(page)).toBe(100 - C.TOOL_COSTS.extraJar);
  const first = await units(page, 0);
  await pour(page, 0, dealt);
  await page.getByTestId('tool-restart').click();
  await page.getByTestId('tool-restart').click();
  await expect.poll(() => units(page, 0)).toEqual(first);
  await expect(jars).toHaveCount(dealt + 1);
});

test('a shelf with no pours left says so, and an extra jar from a test ad gets it going', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => deal(s, 'level', STUCK, 2)));
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('stuck')).toContainText('No pours left.');
  await page.getByTestId('tool-extraJar').click();
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('stuck')).toBeHidden();
  await pour(page, 0, 2);
  await pour(page, 1, 0);
  await pour(page, 2, 1);
  await expect(page.getByTestId('results')).toBeVisible();
  // Help means it is not a clean solve.
  await expect(page.getByTestId('result-clean')).toBeHidden();
  await expect(page.getByTestId('result-stardust')).toHaveText(`+${String(C.levelStardust(1))} stardust`);
});

test('the last star of a constellation pays a bonus, and an ad doubles the stardust once', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 3;
      s.stats.levels = 2;
      deal(s, 'level', NEARLY, 4);
    }),
  );
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('shelf-title')).toHaveText('Level 3');
  await pour(page, 1, 0);
  await expect(page.getByTestId('results')).toBeVisible();
  const paid = C.levelStardust(3) + C.CLEAN_BONUS;
  await expect(page.getByTestId('result-pours')).toHaveText('Solved in one pour');
  await expect(page.getByTestId('result-stardust')).toHaveText(`+${String(paid)} stardust`);
  await expect(page.getByTestId('result-constellation')).toHaveText(`The Kettle is complete! +${String(C.CONSTELLATION_STARDUST)} stardust`);
  expect(await stardust(page)).toBe(paid + C.CONSTELLATION_STARDUST);
  await page.getByTestId('double').click();
  await watchTestAd(page);
  await expect(page.getByTestId('result-stardust')).toHaveText(`+${String(2 * paid)} stardust`);
  await expect(page.getByTestId('double')).toBeHidden();
  expect(await stardust(page)).toBe(2 * paid + C.CONSTELLATION_STARDUST);
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('atlas-card')).toContainText('The Paper Boat');
  await expect(page.getByTestId('atlas-progress')).toHaveText('0 of 4 stars lit');
  await page.getByTestId('open-atlas').click();
  await expect(page.getByTestId('constellation-kettle')).toContainText('Complete');
});

test('the daily sky pays once, keeps the streak going and shows as solved at home', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.daily = { lastDone: YESTERDAY, streak: 4, bestStreak: 4 };
      deal(s, 'daily', NEARLY, 4);
    }),
  );
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 4');
  await page.getByTestId('play-daily').click();
  await expect(page.getByTestId('shelf-title')).toHaveText('Daily sky');
  await pour(page, 1, 0);
  await expect(page.getByTestId('results')).toContainText('Daily sky solved');
  await expect(page.getByTestId('result-stardust')).toHaveText(`+${String(C.DAILY_STARDUST + C.CLEAN_BONUS)} stardust`);
  await expect(page.getByTestId('result-streak')).toHaveText('Daily streak: 5');
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('daily-status')).toHaveText('Solved for today. A new daily sky comes tomorrow.');
  await expect(page.getByTestId('play-daily')).toBeHidden();
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 5');
  expect(await stardust(page)).toBe(C.DAILY_STARDUST + C.CLEAN_BONUS);
});

test('a shelf keeps its place: home and back, and after a reload, with its undos', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('play-level').click();
  await pour(page, 0, 2);
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('play-level')).toContainText('Continue');
  await page.reload();
  await page.getByTestId('play-level').click();
  expect(await shelf(page)).toEqual([[0, 0, 0], [1, 1, 1, 0], [1]]);
  await page.getByTestId('tool-undo').click();
  await expect.poll(() => shelf(page)).toEqual(TUTORIAL);
});

test('ad breaks wait for the first levels and a few minutes of play, and come between shelves', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 5;
      s.stats.levels = 4;
      deal(s, 'level', NEARLY, 4);
    }),
  );
  // As if the phone had been put down a while: timers due in the meantime fire once.
  await page.clock.fastForward(6 * 60_000);
  await page.getByTestId('play-level').click();
  await pour(page, 1, 0);
  await page.getByTestId('result-next').click();
  // Five levels solved: too early for one.
  await expect(page.getByTestId('shelf-title')).toHaveText('Level 6');
  await page.clock.runFor(1_000);
  await expect(page.getByTestId('test-interstitial')).toBeHidden();

  await page.getByTestId('go-home').click();
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 6;
      s.stats.levels = 5;
      deal(s, 'level', NEARLY, 4);
    }),
  );
  await page.getByTestId('play-level').click();
  await pour(page, 1, 0);
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('test-interstitial')).toContainText('Ad break');
  await page.getByTestId('test-ad-close').click();
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a test purchase shows that no money is charged and delivers the stardust once', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await expect(page.getByTestId('test-note')).toBeVisible();
  await page.getByTestId('buy-stardust_small').click();
  const dialog = page.getByTestId('test-purchase');
  await expect(dialog).toContainText('No money is charged');
  await expect(dialog).toContainText('$0.99');
  await page.getByTestId('test-purchase-cancel').click();
  await page.clock.runFor(300);
  expect(await stardust(page)).toBe(0);

  await page.getByTestId('buy-stardust_small').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect.poll(() => stardust(page)).toBe(100);
  await page.reload();
  await expect.poll(() => stardust(page)).toBe(100);
});

test('free stardust from a test ad, with the daily limit shown', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('stardust').click();
  const offer = page.getByTestId('offer-free');
  await expect(offer).toContainText(`${String(R.AD_LIMITS.perPlacement.free_stardust)} left today`);
  await page.getByTestId('watch-free').click();
  await page.getByTestId('test-ad-close').click();
  await page.clock.runFor(500);
  expect(await stardust(page)).toBe(0);
  await page.getByTestId('watch-free').click();
  await watchTestAd(page);
  await expect.poll(() => stardust(page)).toBe(C.FREE_STARDUST);
  await expect(offer).toContainText(`${String(R.AD_LIMITS.perPlacement.free_stardust - 1)} left today`);
});

test('No Ad Breaks: help that comes from a video comes without one', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 40;
      s.stats.levels = 39;
    }),
  );
  await page.getByTestId('open-shop').click();
  await page.getByTestId('buy-remove_ads').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect(page.getByTestId('offer-remove_ads')).toContainText('Owned');
  await page.keyboard.press('Escape');
  await page.getByTestId('play-level').click();
  await page.getByTestId('tool-hint').click();
  await expect(page.getByTestId('tool-watch')).toHaveText('Get it free');
  await page.getByTestId('tool-watch').click();
  await expect(page.getByTestId('hint-from')).toBeVisible();
  await expect(page.getByTestId('test-ad')).toBeHidden();
  expect(await stardust(page)).toBe(0);
});

test('a jar style bought with stardust is used at once, and stays after a reload', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => (s.stardust = 300)));
  await page.getByTestId('open-looks').click();
  await expect(page.getByTestId('buy-look-crystal')).toBeDisabled();
  await page.getByTestId('buy-look-lantern').click();
  await expect(page.getByTestId('look-lantern')).toContainText('In use');
  expect(await stardust(page)).toBe(300 - C.LOOK_COSTS.lantern);
  await page.getByTestId('use-glass').click();
  await expect(page.getByTestId('look-glass')).toContainText('In use');
  await page.getByTestId('use-lantern').click();
  await page.keyboard.press('Escape');
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('jar-0').locator('.jar')).toHaveClass(/jar--lantern/);
  await page.reload();
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('jar-0').locator('.jar')).toHaveClass(/jar--lantern/);
});

// The most jars a shelf gets, and the tallest jars.
for (const level of [201, 204]) {
  test(`the shelf of level ${String(level)}, with its extra jar, fits a small phone without scrolling`, async ({ page }) => {
    const jars = makeLevel(level).puzzle.jars.length + 1;
    await page.setViewportSize({ width: 360, height: 640 });
    await openGame(page);
    await loadSave(
      page,
      makeSave((s) => {
        s.level = level;
        s.stats.levels = level - 1;
        s.stardust = 100;
      }),
    );
    await page.getByTestId('play-level').click();
    await page.getByTestId('tool-extraJar').click();
    await page.getByTestId('tool-spend').click();
    await expect(page.getByTestId('shelf').locator('.jarbtn')).toHaveCount(jars);
    const ids = [...Array.from({ length: jars }, (_, i) => `jar-${String(i)}`), 'tool-undo', 'tool-hint', 'go-home', 'stardust'];
    for (const id of ids) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      expect((box?.y ?? 0) + (box?.height ?? 0), id).toBeLessThanOrEqual(640);
      expect((box?.x ?? 0) + (box?.width ?? 0), id).toBeLessThanOrEqual(360);
      expect(box?.x ?? -1, id).toBeGreaterThanOrEqual(0);
    }
  });
}

test('the game speaks Thai', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('lang-th').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('level-name')).toHaveText('ด่าน 1');
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('teach')).toContainText('แตะโหล');
  await page.getByTestId('go-home').click();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('open-privacy').click();
  await expect(page.getByTestId('privacy-modal')).toContainText('เราคือใคร');
});
