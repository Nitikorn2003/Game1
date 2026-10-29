/**
 * The Google Play screenshots: real moments of the game, from saves made with its own code.
 * `npx tsx tools/store-assets.ts games/ricefield screens` writes them to store/out/.
 */
import { exportSave, localDayKey } from '@game1/engine';
import type { Page } from '@playwright/test';
import type { StoreScreen } from '../../../tools/store-assets.js';
import { picturesOf, type PictureId } from '../src/sim/fields.js';
import { FILLED, UNKNOWN, truthOf } from '../src/sim/nonogram.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone a screenshot might be taken in.
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const TODAY = localDayKey(NOW);
const YESTERDAY = localDayKey(NOW - 86_400_000);

/** A player some days in: the first album full, most of the second, the farm just opened, and a daily streak going. */
function aFewDaysIn(): GameState {
  const s = createState(NOW - 6 * 86_400_000);
  s.taught = true;
  s.grown = [...picturesOf('first'), ...picturesOf('water').slice(0, 9), 'buffalo'];
  s.seeds = 1460;
  s.daily = { field: null, lastDone: YESTERDAY, streak: 5, bestStreak: 7 };
  s.looks = { scene: 'terraces', marker: 'pebble', bought: ['golden', 'frog'] };
  s.stats = { grown: 28, perfect: 15, dailies: 6, cells: 1900, mistakes: 21, hints: 9, restarts: 1, playSeconds: 3 * 3600 };
  return s;
}

/**
 * Works the field out the way a player who never goes wrong would, through the game's rules,
 * cell by cell from the top left, until `until` cells are known. Leaves at least one cell to plant.
 */
function workOut(s: GameState, key: R.FieldKey, until: number): number {
  const field = R.fieldOf(s, key);
  if (!field) throw new Error(`No ${key} field to work out.`);
  const { shape } = R.puzzleOfField(field);
  let last = -1;
  for (let cell = 0; cell < field.board.length && field.board.filter((state) => state !== UNKNOWN).length < until; cell++) {
    if (field.board[cell] !== UNKNOWN) continue;
    const acted = R.act(s, key, cell, truthOf(shape, cell) === FILLED ? 'plant' : 'pebble');
    if (!acted || acted.mistake || acted.result) throw new Error(`Working out ${key} went wrong at cell ${String(cell)}.`);
    last = cell;
  }
  return last;
}

/** The one cell of the picture still to plant, once every other is planted. */
function allButOne(s: GameState, id: PictureId): number {
  const field = R.openAlbumField(s, id);
  if (!field) throw new Error(`${id} cannot be played.`);
  const { shape } = R.puzzleOfField(field);
  const toPlant = field.board.flatMap((state, cell) => (state === UNKNOWN && shape.filled[cell] ? [cell] : []));
  const lastCell = toPlant.pop();
  if (lastCell === undefined) throw new Error(`${id} has nothing to plant.`);
  for (const cell of toPlant) {
    const acted = R.act(s, id, cell, 'plant');
    if (!acted || acted.mistake || acted.result) throw new Error(`Planting ${id} went wrong at cell ${String(cell)}.`);
  }
  return lastCell;
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

/** Taps a cell of the field on the screen, as a finger would. */
async function tapCell(page: Page, cell: number): Promise<void> {
  const box = await page.getByTestId(`cell-${String(cell)}`).boundingBox();
  if (!box) throw new Error(`Cell ${String(cell)} is not on the screen.`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

export const SCREENS: readonly StoreScreen[] = [
  {
    name: 'grown',
    show: async (page, url) => {
      // The last rice of the rooster, as the picture comes up in colour.
      const s = aFewDaysIn();
      const cell = allButOne(s, 'rooster');
      await openWith(page, url, s);
      await page.getByTestId('play-next').click();
      await page.getByTestId('board').waitFor();
      await tapCell(page, cell);
      await page.getByTestId('grown').waitFor();
      // The colour sweeps across and the banner comes in, before the results open.
      await page.waitForTimeout(1500);
    },
  },
  {
    name: 'play',
    show: async (page, url) => {
      // The pig, half worked out, on the golden harvest with little frogs for the empty cells.
      const s = aFewDaysIn();
      s.looks.scene = 'golden';
      s.looks.marker = 'frog';
      if (!R.openAlbumField(s, 'pig')) throw new Error('The pig cannot be played.');
      const last = workOut(s, 'pig', 62);
      await openWith(page, url, s);
      await page.getByTestId('play-next').click();
      await page.getByTestId('board').waitFor();
      // A finger on the cell played last, so its row and column light up.
      await tapCell(page, last);
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'home',
    show: async (page, url) => {
      const s = aFewDaysIn();
      s.looks.scene = 'misty';
      s.looks.bought.push('misty');
      if (!R.openAlbumField(s, 'chick')) throw new Error('The chick cannot be played.');
      workOut(s, 'chick', 40);
      await openWith(page, url, s);
    },
  },
  {
    name: 'album',
    show: async (page, url) => {
      await openWith(page, url, aFewDaysIn());
      await page.getByTestId('album-first').click();
      await page.getByTestId('album').waitFor();
      await settled(page);
    },
  },
  {
    name: 'daily',
    show: async (page, url) => {
      // Today's daily field, two thirds worked out, in the snow with lotus blossoms for the empty cells.
      const s = aFewDaysIn();
      s.looks = { scene: 'snowy', marker: 'blossom', bought: ['golden', 'frog', 'snowy', 'blossom'] };
      if (!R.openDaily(s, TODAY)) throw new Error('No daily field today.');
      workOut(s, 'daily', 66);
      await openWith(page, url, s);
      await page.getByTestId('play-daily').click();
      await page.getByTestId('board').waitFor();
      await page.waitForTimeout(300);
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
