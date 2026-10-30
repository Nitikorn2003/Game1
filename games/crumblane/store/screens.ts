/**
 * The Google Play screenshots: real moments of the game, from saves made with its own code.
 * `npx tsx tools/store-assets.ts games/crumblane screens` writes them to store/out/.
 */
import { exportSave, localDayKey } from '@game1/engine';
import type { Page } from '@playwright/test';
import type { StoreScreen } from '../../../tools/store-assets.js';
import { dealOrder, toTheLast } from '../e2e/helpers.js';
import { TIPS } from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone a screenshot might be taken in.
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const TODAY = localDayKey(NOW);
const YESTERDAY = localDayKey(NOW - 86_400_000);

/** A player a week in: the first shops of the lane open, sugar and tools saved up, and a daily streak going. */
function aWeekIn(cleared: number): GameState {
  const s = createState(NOW - 7 * 86_400_000);
  s.stars = Array.from({ length: cleared }, (_, i) => [3, 3, 2, 3, 1, 3, 2, 3, 3, 2, 3, 2][i % 12] ?? 3);
  s.coins = 1840;
  s.tools = { spatula: 3, rollingpin: 2, whisk: 2 };
  s.daily = { day: YESTERDAY, tries: 1, lastDone: YESTERDAY, streak: 4, bestStreak: 6 };
  s.looks = { tiles: 'cream', season: 'spring', bought: ['willow', 'rain'] };
  s.tips = [...TIPS];
  s.stats = { rounds: 71, won: cleared + 4, dailies: 5, taken: 5200, sets: 1730, continues: 4, toolsUsed: 12, playSeconds: 4 * 3600 };
  return s;
}

/** Starts level `n` and takes its first `taken` tiles along the way its deal was made. */
function partway(s: GameState, n: number, taken: number): GameState {
  if (!R.startLevel(s, n)) throw new Error(`Level ${String(n)} is not open.`);
  for (const tile of dealOrder(s).slice(0, taken)) R.take(s, tile);
  return s;
}

/** Takes tiles along the deal until the next one would finish a set of three on the tray, and returns that one. */
function nextSet(s: GameState): number {
  for (const tile of dealOrder(s)) {
    const ahead = structuredClone(s);
    if (R.take(ahead, tile)?.take.set) return tile;
    if (!R.take(s, tile)) break;
  }
  throw new Error('No set left to finish.');
}

/** Opens the game and loads the save, then closes the settings again. */
async function openWith(page: Page, url: string, state: GameState): Promise<void> {
  await page.clock.install({ time: NOW });
  await page.goto(url);
  await page.getByTestId('home').waitFor();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('import-save').click();
  await page.getByTestId('import-text').fill(exportSave(saveFormat, state, NOW));
  await page.getByTestId('import-confirm').click();
  await page.getByTestId('settings-message').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  // A phone shows no keyboard focus ring on the settings button.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

/** Goes from the home screen to the counter of the round in progress. */
async function round(page: Page, button: 'play-next' | 'play-daily'): Promise<void> {
  await page.getByTestId(button).click();
  await page.getByTestId('table').waitFor();
  await page.waitForTimeout(500);
}

/**
 * Taps, then holds the game still `ms` into what the tap set moving: the game's timers stopped
 * on Playwright's clock, so the table stays on that step, and every animation paused there.
 */
async function tapAndHold(page: Page, testId: string, ms: number): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 500);
  await page.getByTestId(testId).click();
  await page.waitForTimeout(50);
  await page.evaluate((at) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = at;
    }
  }, ms);
}

export const SCREENS: readonly StoreScreen[] = [
  {
    name: 'counter',
    show: async (page, url) => {
      // The Croissant Café: the third of a kind flies to the tray to join the other two.
      const s = partway(aWeekIn(16), 17, 0);
      const tile = nextSet(s);
      await openWith(page, url, s);
      await round(page, 'play-next');
      await tapAndHold(page, `tile-${String(tile)}`, 130);
    },
  },
  {
    name: 'specials',
    show: async (page, url) => {
      // The Chocolate Shop in gingham tiles and autumn leaves: paper bags and ribbon boxes.
      const s = aWeekIn(72);
      s.looks = { tiles: 'gingham', season: 'autumn', bought: ['gingham', 'autumn'] };
      partway(s, 73, 2);
      await openWith(page, url, s);
      await round(page, 'play-next');
    },
  },
  {
    name: 'cleared',
    show: async (page, url) => {
      // The last tile of the Croissant Café, and the café opens on the lane.
      const s = aWeekIn(23);
      if (!R.startLevel(s, 24)) throw new Error('Level 24 is not open.');
      const last = toTheLast(s);
      await openWith(page, url, s);
      await round(page, 'play-next');
      await page.getByTestId(`tile-${String(last)}`).click();
      await page.getByTestId('results').waitFor({ timeout: 15_000 });
      // Until its opening animation ends, a pop-up is still partly see-through, and its stars come in one by one.
      await page.waitForTimeout(1_400);
    },
  },
  {
    name: 'whisk',
    show: async (page, url) => {
      // The Cupcake Parlour in willow tiles and summer rain: the whisk whips up a set above the tray.
      const s = aWeekIn(40);
      s.looks = { tiles: 'willow', season: 'rain', bought: ['willow', 'rain'] };
      partway(s, 41, 4);
      await openWith(page, url, s);
      await round(page, 'play-next');
      await tapAndHold(page, 'tool-whisk', 260);
    },
  },
  {
    name: 'lane',
    show: async (page, url) => {
      await openWith(page, url, aWeekIn(50));
    },
  },
  {
    name: 'daily',
    show: async (page, url) => {
      // Today's daily special, a few pastries in, in mint tiles under winter snow.
      const s = aWeekIn(50);
      s.looks = { tiles: 'mint', season: 'snow', bought: ['willow', 'rain', 'mint', 'snow'] };
      if (!R.openDaily(s, TODAY)) throw new Error('No daily special today.');
      for (const tile of dealOrder(s).slice(0, 5)) R.take(s, tile);
      await openWith(page, url, s);
      await round(page, 'play-daily');
    },
  },
];
