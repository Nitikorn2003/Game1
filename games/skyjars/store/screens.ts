/**
 * The Google Play screenshots: real moments of the game, from saves made with its own code.
 * `npx tsx tools/store-assets.ts games/skyjars screens` writes them to store/out/.
 */
import { exportSave, localDayKey } from '@game1/engine';
import type { Page } from '@playwright/test';
import type { StoreScreen } from '../../../tools/store-assets.js';
import type { Mode } from '../src/sim/content.js';
import * as J from '../src/sim/jars.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone a screenshot might be taken in.
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const TODAY = localDayKey(NOW);
const YESTERDAY = localDayKey(NOW - 86_400_000);

/** A player some days in: 57 levels solved, a daily streak going, and a few looks bought. */
function aFewDaysIn(): GameState {
  const s = createState(NOW - 6 * 86_400_000);
  s.taught = true;
  s.level = 58;
  s.stardust = 640;
  s.daily = { lastDone: YESTERDAY, streak: 5, bestStreak: 7 };
  s.looks = { jar: 'glass', sky: 'twilight', bought: ['shell', 'moonrise', 'aurora'] };
  s.stats = { levels: 57, dailies: 6, pours: 2140, clean: 31, undos: 118, hints: 9, extraJars: 4, playSeconds: 5 * 3600 };
  return s;
}

/**
 * Deals the shelf of a mode and makes pours of a way to solve it, through the game's rules,
 * until `share` of them are made. Returns the next pour on that way.
 */
function partway(s: GameState, mode: Mode, share: number): J.Move {
  const shelf = R.openShelf(s, mode, TODAY);
  if (!shelf) throw new Error(`No ${mode} shelf to deal.`);
  const solution = J.solve(R.puzzleOf(shelf), 200_000);
  if (!solution) throw new Error(`The ${mode} shelf has no known way to solve it.`);
  const made = Math.min(solution.moves.length - 1, Math.round(solution.moves.length * share));
  for (const [from, to] of solution.moves.slice(0, made)) {
    if (!R.pour(s, mode, from, to)) throw new Error(`The pour ${String(from)} → ${String(to)} was refused.`);
  }
  const next = solution.moves[made];
  if (!next) throw new Error('No pour is left to make.');
  return next;
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

/** Until its opening animation ends, a pop-up is still partly see-through. */
const settled = (page: Page) => page.waitForTimeout(500);

export const SCREENS: readonly StoreScreen[] = [
  {
    name: 'pour',
    show: async (page, url) => {
      const s = aFewDaysIn();
      const [from] = partway(s, 'level', 0.45);
      await openWith(page, url, s);
      await page.getByTestId('play-level').click();
      await page.getByTestId(`jar-${String(from)}`).click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'home',
    show: async (page, url) => {
      const s = aFewDaysIn();
      s.looks.sky = 'moonrise';
      await openWith(page, url, s);
    },
  },
  {
    name: 'constellation',
    show: async (page, url) => {
      // Level 59 lights the last star of the Bell.
      const s = aFewDaysIn();
      s.level = 59;
      s.stats.levels = 58;
      const [from, to] = partway(s, 'level', 1);
      await openWith(page, url, s);
      await page.getByTestId('play-level').click();
      await page.getByTestId(`jar-${String(from)}`).click();
      await page.getByTestId(`jar-${String(to)}`).click();
      await page.getByTestId('results').waitFor();
      await settled(page);
    },
  },
  {
    name: 'daily',
    show: async (page, url) => {
      const s = aFewDaysIn();
      s.looks.jar = 'shell';
      s.looks.sky = 'aurora';
      const next = partway(s, 'daily', 0.3);
      const daily = s.shelves.daily;
      if (daily) {
        daily.hint = next;
        daily.hinted = 1;
      }
      await openWith(page, url, s);
      await page.getByTestId('play-daily').click();
      await page.getByTestId('hint-from').waitFor();
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'atlas',
    show: async (page, url) => {
      await openWith(page, url, aFewDaysIn());
      await page.getByTestId('open-atlas').click();
      await page.getByTestId('atlas').waitFor();
      await settled(page);
    },
  },
  {
    name: 'looks',
    show: async (page, url) => {
      await openWith(page, url, aFewDaysIn());
      await page.getByTestId('open-looks').click();
      await page.getByTestId('looks').waitFor();
      await settled(page);
    },
  },
];
