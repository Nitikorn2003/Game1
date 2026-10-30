/**
 * The Google Play screenshots: real moments of the game, from saves made with its own code.
 * `npx tsx tools/store-assets.ts games/lotuscanal screens` writes them to store/out/.
 */
import { exportSave, localDayKey } from '@game1/engine';
import type { Page } from '@playwright/test';
import type { StoreScreen } from '../../../tools/store-assets.js';
import { botChoice } from '../src/sim/bot.js';
import type { Mode } from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';
import { STREAK_EVERY, type Table } from '../src/sim/table.js';

// Noon, so that it is the same day in every time zone a screenshot might be taken in.
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const TODAY = localDayKey(NOW);
const YESTERDAY = localDayKey(NOW - 86_400_000);

/** A player some days in: four canals behind the boat, a daily streak going, and a few looks bought. */
function aFewDaysIn(): GameState {
  const s = createState(NOW - 6 * 86_400_000);
  s.taught = true;
  s.level = 49;
  s.coins = 1460;
  s.daily = { lastDone: YESTERDAY, streak: 5, bestStreak: 7 };
  s.looks = { back: 'lotus', scene: 'morning', bought: ['waves', 'sunset'] };
  s.stats = { wins: 54, losses: 9, dailies: 6, cards: 1500, bestStreak: 14, clean: 31, undos: 62, wilds: 7, extras: 5, playSeconds: 4 * 3600 };
  return s;
}

/**
 * Deals the deal of a mode and plays it the careful player's way, through the game's rules,
 * until `ready` likes the table and a card is there to play. Returns that card's spot.
 */
function playUntil(s: GameState, mode: Mode, ready: (table: Table) => boolean): number {
  const deal = R.openDeal(s, mode, TODAY);
  if (!deal) throw new Error(`No ${mode} deal to play.`);
  for (let moves = 0; moves < 200; moves++) {
    const table = R.tableOf(deal);
    const spot = botChoice(table);
    if (spot !== null && ready(table)) return spot;
    if (spot === null) {
      if (R.draw(s, mode) === null) throw new Error(`The ${mode} deal got stuck.`);
      continue;
    }
    const played = R.play(s, mode, spot, TODAY);
    if (!played || played.result) throw new Error(`The ${mode} deal ended before the moment to show.`);
  }
  throw new Error(`The ${mode} deal never came to the moment to show.`);
}

/** Past `share` of the cards, with a run going of `run` cards, counted in runs of STREAK_EVERY. */
const runOf = (share: number, run: number) => (table: Table) => table.played >= share * table.dealt.cards.length && table.streak % STREAK_EVERY === run;

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

/** Plays the card on `spot`, and waits for it to land on the pile. */
async function playCard(page: Page, spot: number): Promise<void> {
  await page.getByTestId(`card-${String(spot)}`).click();
  await page.waitForTimeout(400);
}

export const SCREENS: readonly StoreScreen[] = [
  {
    name: 'run',
    show: async (page, url) => {
      // The fifth card of a run, as its bonus comes up.
      const s = aFewDaysIn();
      const spot = playUntil(s, 'level', runOf(0.3, STREAK_EVERY - 1));
      await openWith(page, url, s);
      await page.getByTestId('play-level').click();
      await page.getByTestId(`card-${String(spot)}`).click();
      await page.getByTestId('streak-bonus').waitFor();
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'home',
    show: async (page, url) => {
      const s = aFewDaysIn();
      s.looks.scene = 'sunset';
      await openWith(page, url, s);
    },
  },
  {
    name: 'canal',
    show: async (page, url) => {
      // Level 50 is the last stop of the Orchid Farms canal.
      const s = aFewDaysIn();
      s.level = 50;
      s.stats.wins += 1;
      const spot = playUntil(s, 'level', (table) => table.played === table.dealt.cards.length - 1);
      await openWith(page, url, s);
      await page.getByTestId('play-level').click();
      await page.getByTestId(`card-${String(spot)}`).click();
      await page.getByTestId('results').waitFor();
      await settled(page);
    },
  },
  {
    name: 'daily',
    show: async (page, url) => {
      const s = aFewDaysIn();
      s.looks = { back: 'elephant', scene: 'lanterns', bought: ['waves', 'sunset', 'elephant', 'lanterns'] };
      const spot = playUntil(s, 'daily', runOf(0.2, 2));
      await openWith(page, url, s);
      await page.getByTestId('play-daily').click();
      await playCard(page, spot);
    },
  },
  {
    name: 'map',
    show: async (page, url) => {
      await openWith(page, url, aFewDaysIn());
      await page.getByTestId('open-map').click();
      await page.getByTestId('map').waitFor();
      await settled(page);
    },
  },
  {
    name: 'looks',
    show: async (page, url) => {
      const s = aFewDaysIn();
      s.looks.back = 'waves';
      await openWith(page, url, s);
      await page.getByTestId('open-looks').click();
      await page.getByTestId('looks').waitFor();
      await settled(page);
    },
  },
];
