import { expect, test } from '@playwright/test';
import * as C from '../src/sim/content.js';
import { ALBUM_IDS, picturesOf } from '../src/sim/fields.js';
import { EMPTY, FILLED } from '../src/sim/nonogram.js';
import * as R from '../src/sim/rules.js';
import { YESTERDAY, allButOne, cell, drag, known, loadSave, makeSave, openGame, seeds, tapCell, watchTestAd } from './helpers.js';

/*
 * The first picture, the heart, 5 × 5:
 *
 *   . r . r .     cells  0  1  2  3  4
 *   r r r r r            5  6  7  8  9
 *   r r r r r           10 11 12 13 14
 *   . r r r .           15 16 17 18 19
 *   . . r . .           20 21 22 23 24
 */
const RICE = String(FILLED);
const PEBBLE = String(EMPTY);

test('the first field: plant and pebble, drag along a row, a wrong move, and the heart grows', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('next-card')).toContainText('Next field');
  await expect(page.getByTestId('next-where')).toHaveText('First Sprouts · 5×5');
  await page.getByTestId('play-next').click();
  await expect(page.getByTestId('board')).toHaveAttribute('data-width', '5');
  await expect(page.getByTestId('teach')).toBeVisible();
  await expect(page.getByTestId('planted')).toHaveText('0/16');

  await tapCell(page, 1);
  await expect(cell(page, 1)).toHaveAttribute('data-state', RICE);
  await expect(page.getByTestId('planted')).toHaveText('1/16');

  // A drag plants the stretch of the row it moves along.
  await drag(page, 5, 9);
  for (let at = 5; at <= 9; at++) await expect(cell(page, at)).toHaveAttribute('data-state', RICE);
  await expect(page.getByTestId('clue-row-1')).toHaveClass(/clue--done/);

  // Rice where none belongs costs a heart, and the cell is put right.
  await tapCell(page, 0);
  await expect(page.getByTestId('hearts')).toHaveAttribute('data-hearts', '2');
  await expect(cell(page, 0)).toHaveAttribute('data-state', PEBBLE);
  await expect(cell(page, 0)).toHaveClass(/cell--wrong/);

  // A pebble marks a cell that stays empty.
  await page.getByTestId('tool-pebble').click();
  await tapCell(page, 2);
  await expect(cell(page, 2)).toHaveAttribute('data-state', PEBBLE);
  await expect(page.getByTestId('hearts')).toHaveAttribute('data-hearts', '2');

  // Once all the rice of a row is planted, the rest of it is pebbled.
  await page.getByTestId('tool-plant').click();
  await tapCell(page, 3);
  await expect(cell(page, 4)).toHaveAttribute('data-state', PEBBLE);
  await drag(page, 10, 14);
  await drag(page, 16, 18);
  for (const at of [15, 19, 20, 21, 23, 24]) await expect(cell(page, at)).toHaveAttribute('data-state', PEBBLE);
  await expect(page.getByTestId('planted')).toHaveText('15/16');

  await tapCell(page, 22);
  await expect(page.getByTestId('grown')).toBeVisible();
  await expect(page.getByTestId('board')).toHaveClass(/board--grown/);
  // The note stays to the end of the first field, so the field does not move as it grows.
  await expect(page.getByTestId('teach')).toBeVisible();
  await expect(page.getByTestId('results')).toBeVisible();
  await expect(page.getByTestId('result-name')).toHaveText('Heart');
  await expect(page.getByTestId('result-perfect')).toBeHidden();
  await expect(page.getByTestId('result-tally')).toContainText(`+${String(C.fieldSeeds(25))}`);
  await expect(page.getByTestId('result-seeds')).toContainText(`+${String(C.fieldSeeds(25))} seeds`);
  expect(await seeds(page)).toBe(C.fieldSeeds(25));
  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-field', 'house');
  await expect(page.getByTestId('teach')).toBeHidden();
  // The heart has grown, so it is not played again.
  await page.getByTestId('go-home').click();
  await page.getByTestId('album-first').click();
  await expect(page.getByTestId('picture-heart')).toHaveAccessibleName('Heart');
  await page.getByTestId('picture-heart').click();
  await expect(page.getByTestId('picture')).toBeVisible();
});

test('the first hint of a field is free; more come from a test ad or for seeds, and show on the field', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => (s.seeds = C.TOOL_COSTS.hint + 5)),
  );
  await page.getByTestId('play-next').click();
  const hint = page.getByTestId('hint');
  await expect(hint).toHaveAccessibleName('Hint, free for this field');
  await hint.click();
  // It fills in a whole row of the heart, the line the numbers tell the most about.
  await expect(page.getByTestId('planted')).toHaveText('5/16');
  await expect(page.locator('.flash--hint')).toHaveCount(1);
  await expect(hint).toHaveAccessibleName('Hint');

  await hint.click();
  await expect(page.getByTestId('tool-sheet')).toBeVisible();
  let before = await known(page);
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  // The sheet goes, so that the hint shows on the field.
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect.poll(() => known(page)).toBeGreaterThan(before);

  before = await known(page);
  await hint.click();
  await page.getByTestId('tool-spend').click();
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect.poll(() => known(page)).toBeGreaterThan(before);
  expect(await seeds(page)).toBe(5);

  // Too few seeds for another.
  await hint.click();
  await expect(page.getByTestId('tool-spend')).toBeDisabled();
  await expect(page.getByTestId('tool-sheet')).toContainText('You have 5 seeds.');
});

test('out of hearts the field wilts: hearts come back from a test ad or for seeds, or the field starts over for free', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => (s.seeds = C.TOOL_COSTS.hearts + 5)),
  );
  await page.getByTestId('play-next').click();
  const hearts = page.getByTestId('hearts');
  const sheet = page.getByTestId('tool-sheet');

  // Rice on three of the heart's empty cells.
  for (const at of [0, 2, 4]) await tapCell(page, at);
  await expect(hearts).toHaveAttribute('data-hearts', '0');
  await expect(page.getByTestId('wilted')).toBeVisible();
  await expect(page.getByTestId('hint')).toBeDisabled();
  await expect(sheet).toContainText('Out of hearts');
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  await expect(sheet).toBeHidden();
  await expect(hearts).toHaveAttribute('data-hearts', String(C.HEARTS));
  await expect(page.getByTestId('wilted')).toBeHidden();

  for (const at of [15, 19, 20]) await tapCell(page, at);
  await expect(sheet).toBeVisible();
  await page.getByTestId('tool-spend').click();
  await expect(sheet).toBeHidden();
  await expect(hearts).toHaveAttribute('data-hearts', String(C.HEARTS));
  expect(await seeds(page)).toBe(5);

  for (const at of [21, 23, 24]) await tapCell(page, at);
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('tool-spend')).toBeDisabled();
  await page.getByTestId('tool-restart').click();
  await expect(sheet).toBeHidden();
  await expect(hearts).toHaveAttribute('data-hearts', String(C.HEARTS));
  expect(await known(page)).toBe(0);
});

test('a perfect field pays half as much again, and a test ad doubles the seeds once', async ({ page }) => {
  await openGame(page);
  let last = 0;
  await loadSave(
    page,
    makeSave((s) => {
      last = allButOne(s, 'heart');
    }),
  );
  await expect(page.getByTestId('next-card')).toContainText('Continue');
  await page.getByTestId('play-next').click();
  await tapCell(page, last);
  await expect(page.getByTestId('results')).toBeVisible();
  const pay = C.fieldSeeds(25) + C.perfectBonus(C.fieldSeeds(25));
  await expect(page.getByTestId('result-perfect')).toBeVisible();
  await expect(page.getByTestId('result-seeds')).toContainText(`+${String(pay)} seeds`);
  expect(await seeds(page)).toBe(pay);
  await page.getByTestId('double').click();
  await watchTestAd(page);
  await expect(page.getByTestId('result-seeds')).toContainText(`+${String(2 * pay)} seeds`);
  await expect(page.getByTestId('double')).toBeHidden();
  expect(await seeds(page)).toBe(2 * pay);
});

test('the daily field pays once, keeps the streak going and shows as grown at home', async ({ page }) => {
  await openGame(page);
  let last = 0;
  await loadSave(
    page,
    makeSave((s) => {
      s.daily = { field: null, lastDone: YESTERDAY, streak: 2, bestStreak: 2 };
      last = allButOne(s, 'daily');
    }),
  );
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 2');
  await page.getByTestId('play-daily').click();
  await expect(page.getByTestId('field-title')).toHaveText('Daily field');
  await tapCell(page, last);
  await expect(page.getByTestId('results')).toBeVisible();
  await expect(page.getByTestId('result-name')).toHaveText('Today’s pattern');
  await expect(page.getByTestId('result-streak')).toHaveText('Daily streak: 3');
  await expect(page.getByTestId('result-seeds')).toContainText(`+${String(C.DAILY_SEEDS + C.perfectBonus(C.DAILY_SEEDS))} seeds`);
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('mode-daily')).toHaveClass(/mode--done/);
  await expect(page.getByTestId('daily-status')).toHaveText('Grown for today. A new daily field comes tomorrow.');
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 3');
  await expect(page.getByTestId('play-daily')).toBeHidden();
});

test('a field keeps its place: home and back, and after a reload', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('play-next').click();
  await drag(page, 5, 9);
  await tapCell(page, 0);
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('next-card')).toContainText('Continue');
  await page.reload();
  await expect(page.getByTestId('next-card')).toContainText('Continue');
  await page.getByTestId('play-next').click();
  for (let at = 5; at <= 9; at++) await expect(cell(page, at)).toHaveAttribute('data-state', RICE);
  await expect(cell(page, 0)).toHaveAttribute('data-state', PEBBLE);
  await expect(page.getByTestId('hearts')).toHaveAttribute('data-hearts', '2');
  await expect(page.getByTestId('planted')).toHaveText('5/16');
});

test('a new album opens once eight pictures of the one before have grown, and a full album pays more', async ({ page }) => {
  await openGame(page);
  const first = picturesOf('first');
  let last = 0;
  await loadSave(
    page,
    makeSave((s) => {
      s.grown = first.slice(0, C.OPEN_AFTER - 1);
      last = allButOne(s, first[C.OPEN_AFTER - 1] ?? 'umbrella');
    }),
  );
  await expect(page.getByTestId('album-water')).toHaveAccessibleName('Water’s Edge: not open yet');
  await page.getByTestId('play-next').click();
  await tapCell(page, last);
  await expect(page.getByTestId('result-opened')).toHaveText('A new album is open: Water’s Edge');
  await page.getByTestId('result-album-open').click();
  await expect(page.getByTestId('album')).toContainText('First Sprouts');
  await expect(page.getByTestId('album-progress')).toContainText(`${String(C.OPEN_AFTER)} of 12 grown`);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('album-water')).toHaveAccessibleName('Water’s Edge: 0 of 12 grown');
  await page.getByTestId('album-water').click();
  await expect(page.getByTestId('album-progress')).toContainText('0 of 12 grown');
  await page.getByTestId('picture-frog').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-field', 'frog');

  await page.getByTestId('go-home').click();
  await loadSave(
    page,
    makeSave((s) => {
      s.grown = first.slice(0, -1);
      last = allButOne(s, 'leaf');
    }),
  );
  await page.getByTestId('play-next').click();
  await tapCell(page, last);
  await expect(page.getByTestId('result-album')).toContainText(`Album full: First Sprouts+${String(C.ALBUM_SEEDS)}`);
  const leaf = C.fieldSeeds(64);
  await expect(page.getByTestId('result-seeds')).toContainText(`+${String(leaf + C.perfectBonus(leaf) + C.ALBUM_SEEDS)} seeds`);
  // The next field is the first of the next album.
  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-field', 'frog');
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('album-first')).toHaveAccessibleName('First Sprouts: 12 of 12 grown');
});

test('ad breaks wait for three grown fields and a few minutes of play, and come after a field has grown', async ({ page }) => {
  await openGame(page);
  let last = 0;
  await loadSave(
    page,
    makeSave((s) => {
      s.grown = ['heart'];
      s.stats.grown = 1;
      last = allButOne(s, 'house');
    }),
  );
  // As if the phone had been put down a while: timers due in the meantime fire once.
  await page.clock.fastForward(6 * 60_000);
  await page.getByTestId('play-next').click();
  await tapCell(page, last);
  await page.getByTestId('result-next').click();
  // Two fields grown: too early for one.
  await expect(page.getByTestId('play')).toHaveAttribute('data-field', 'tree');
  await page.clock.runFor(1_000);
  await expect(page.getByTestId('test-interstitial')).toBeHidden();

  await page.getByTestId('go-home').click();
  await loadSave(
    page,
    makeSave((s) => {
      s.grown = ['heart', 'house'];
      s.stats.grown = C.AD_BREAKS_AFTER_WINS - 1;
      last = allButOne(s, 'tree');
    }),
  );
  await page.getByTestId('play-next').click();
  await tapCell(page, last);
  // Not while the picture grows and its results show: only once they close.
  await expect(page.getByTestId('results')).toBeVisible();
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('test-interstitial')).toContainText('Ad break');
  await page.getByTestId('test-ad-close').click();
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a test purchase shows that no money is charged and delivers once; the Farmer’s Kit brings its marker', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await expect(page.getByTestId('test-note')).toBeVisible();
  await page.getByTestId('buy-seeds_small').click();
  const dialog = page.getByTestId('test-purchase');
  await expect(dialog).toContainText('No money is charged');
  await expect(dialog).toContainText('$0.99');
  await page.getByTestId('test-purchase-cancel').click();
  await page.clock.runFor(300);
  expect(await seeds(page)).toBe(0);

  await page.getByTestId('buy-seeds_small').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect.poll(() => seeds(page)).toBe(500);
  await page.reload();
  await expect.poll(() => seeds(page)).toBe(500);

  await page.getByTestId('open-shop').click();
  await page.getByTestId('buy-farmer_kit').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect(page.getByTestId('offer-farmer_kit')).toContainText('Owned');
  await expect.poll(() => seeds(page)).toBe(1500);
  await page.keyboard.press('Escape');
  await page.getByTestId('open-looks').click();
  await page.getByTestId(`use-${C.FARMER_KIT_MARKER}`).click();
  await expect(page.getByTestId(`look-${C.FARMER_KIT_MARKER}`)).toContainText('In use');
  await expect(page.locator('.app')).toHaveAttribute('data-marker', C.FARMER_KIT_MARKER);
  expect(await seeds(page)).toBe(1500);
});

test('free seeds from a test ad, with the daily limit shown', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('seeds').click();
  const offer = page.getByTestId('offer-free');
  await expect(offer).toContainText(`${String(R.AD_LIMITS.perPlacement.free_seeds)} left today`);
  // Closing the ad early gives nothing.
  await page.getByTestId('watch-free').click();
  await page.getByTestId('test-ad-close').click();
  await page.clock.runFor(500);
  expect(await seeds(page)).toBe(0);
  await page.getByTestId('watch-free').click();
  await watchTestAd(page);
  await expect.poll(() => seeds(page)).toBe(C.FREE_SEEDS);
  await expect(offer).toContainText(`${String(R.AD_LIMITS.perPlacement.free_seeds - 1)} left today`);
});

test('No Ad Breaks: help that comes from a video comes without one', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await page.getByTestId('buy-remove_ads').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect(page.getByTestId('offer-remove_ads')).toContainText('Owned');
  await expect(page.getByTestId('watch-free')).toHaveText('Claim');
  await page.keyboard.press('Escape');
  await page.getByTestId('play-next').click();
  await page.getByTestId('hint').click();
  await expect(page.getByTestId('planted')).toHaveText('5/16');
  const before = await known(page);
  await page.getByTestId('hint').click();
  await expect(page.getByTestId('tool-watch')).toHaveText('Get it free');
  await page.getByTestId('tool-watch').click();
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect.poll(() => known(page)).toBeGreaterThan(before);
  await expect(page.getByTestId('test-ad')).toBeHidden();
  expect(await seeds(page)).toBe(0);
});

test('looks bought with seeds are used at once, and stay after a reload', async ({ page }) => {
  await openGame(page);
  await loadSave(
    page,
    makeSave((s) => (s.seeds = 700)),
  );
  await page.getByTestId('open-looks').click();
  await expect(page.getByTestId('buy-look-misty')).toBeDisabled();
  await page.getByTestId('buy-look-golden').click();
  await expect(page.getByTestId('look-golden')).toContainText('In use');
  expect(await seeds(page)).toBe(700 - C.LOOK_COSTS.golden);
  const app = page.locator('.app');
  await expect(app).toHaveAttribute('data-scene', 'golden');
  await page.getByTestId('use-terraces').click();
  await expect(app).toHaveAttribute('data-scene', 'terraces');
  await page.getByTestId('use-golden').click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(app).toHaveAttribute('data-scene', 'golden');
  await page.getByTestId('play-next').click();
  await expect(app).toHaveAttribute('data-scene', 'golden');
});

for (const album of ALBUM_IDS) {
  test(`every ${album} field fits a small phone, with cells big enough to tap`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openGame(page);
    const before = ALBUM_IDS.slice(0, ALBUM_IDS.indexOf(album));
    await loadSave(
      page,
      makeSave((s) => {
        s.grown = before.flatMap((id) => picturesOf(id));
      }),
    );
    for (const id of picturesOf(album)) {
      await page.getByTestId(`album-${album}`).click();
      await page.getByTestId(`picture-${id}`).click();
      await expect(page.getByTestId('play')).toHaveAttribute('data-field', id);
      const boxes = await Promise.all(['board', 'go-home', 'seeds', 'hearts', 'planted', 'tool-plant', 'tool-pebble', 'hint'].map((testId) => page.getByTestId(testId).boundingBox()));
      for (const box of boxes) {
        expect(box, id).not.toBeNull();
        if (!box) continue;
        expect(box.x, id).toBeGreaterThanOrEqual(0);
        expect(box.y, id).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, id).toBeLessThanOrEqual(360);
        expect(box.y + box.height, id).toBeLessThanOrEqual(640);
      }
      // The field stays clear of the buttons below it.
      const board = boxes[0];
      const dock = await page.locator('.dock').boundingBox();
      expect((board?.y ?? 0) + (board?.height ?? 0), id).toBeLessThanOrEqual(dock?.y ?? 0);
      expect((await cell(page, 0).boundingBox())?.width ?? 0, id).toBeGreaterThanOrEqual(20);
      await page.getByTestId('go-home').click();
    }
  });
}

test('the keyboard plays too: the arrow keys move between cells, Enter or Space acts on one, and Escape goes home', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('play-next').click();
  await cell(page, 0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cell(page, 1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cell(page, 1)).toHaveAttribute('data-state', RICE);
  await page.keyboard.press('ArrowDown');
  await expect(cell(page, 6)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(cell(page, 6)).toHaveAttribute('data-state', RICE);
  await page.getByTestId('tool-pebble').click();
  await cell(page, 2).focus();
  await page.keyboard.press('Enter');
  await expect(cell(page, 2)).toHaveAttribute('data-state', PEBBLE);
  await expect(page.getByTestId('hearts')).toHaveAttribute('data-hearts', String(C.HEARTS));
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('home')).toBeVisible();
});

test('the game speaks Thai', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('lang-th').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.getByTestId('play-next')).toHaveText('ปลูก');
  await expect(page.getByTestId('next-where')).toHaveText('ต้นกล้าแรก · 5×5');
  await page.getByTestId('play-next').click();
  await expect(page.getByTestId('tool-pebble')).toHaveText('วางกรวด');
  await expect(page.getByTestId('teach')).toContainText('ตัวเลขคือจำนวนช่องข้าว');
  await page.getByTestId('go-home').click();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('open-privacy').click();
  await expect(page.getByTestId('privacy-modal')).toContainText('เราคือใคร');
});
