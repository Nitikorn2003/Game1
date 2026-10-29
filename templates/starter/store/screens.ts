/**
 * The Google Play screenshots: real moments of the game, from saves made with its own code.
 * `npx tsx tools/store-assets.ts templates/starter screens` writes them to store/out/.
 */
import { exportSave } from '@game1/engine';
import type { Page } from '@playwright/test';
import type { StoreScreen } from '../../../tools/store-assets.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

const NOW = Date.UTC(2026, 9, 29, 3, 0, 0);

/** A player a few minutes in: several upgrades bought and some coins saved up. */
function aFewMinutesIn(): GameState {
  const state = createState(NOW - 10 * 60_000);
  state.tapLevel = 6;
  state.coins = 1240;
  state.stats = { taps: 640, playSeconds: 600 };
  return state;
}

/** Opens the game and loads the save, then closes the settings again. */
async function openWith(page: Page, url: string, state: GameState): Promise<void> {
  await page.clock.install({ time: NOW });
  await page.goto(url);
  await page.getByTestId('tap').waitFor();
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

export const SCREENS: readonly StoreScreen[] = [
  {
    name: 'tap',
    show: async (page, url) => {
      await openWith(page, url, aFewMinutesIn());
    },
  },
  {
    name: 'shop',
    show: async (page, url) => {
      await openWith(page, url, aFewMinutesIn());
      await page.getByTestId('open-shop').click();
      await page.getByTestId('shop-modal').waitFor();
      // Until its opening animation ends, the shop is still partly see-through.
      await page.waitForTimeout(500);
    },
  },
];
