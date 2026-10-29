/**
 * The Google Play screenshots: real moments of the game, from saves made with its own code.
 * `npx tsx tools/store-assets.ts games/quiltnook screens` writes them to store/out/.
 */
import { exportSave, localDayKey } from '@game1/engine';
import type { Page } from '@playwright/test';
import type { StoreScreen } from '../../../tools/store-assets.js';
import * as B from '../src/sim/board.js';
import * as Q from '../src/sim/quilt.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';
import type { ShapeId } from '../src/sim/shapes.js';

// Noon, so that it is the same day in every time zone a screenshot might be taken in.
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const TODAY = localDayKey(NOW);

/** A board drawn as rows of `.` (empty) and fabrics 0 to 3. */
function rows(drawing: string): B.Board {
  return drawing
    .trim()
    .split(/\s+/)
    .flatMap((row) => Array.from(row, (mark) => (mark === '.' ? B.EMPTY : Number(mark))));
}

function quilt(mode: Q.Mode, drawing: string, tray: readonly (readonly [ShapeId, number])[], tally: Partial<Q.Quilt>): Q.Quilt {
  const q = Q.newQuilt(mode, mode === 'daily' ? TODAY : null, 7);
  q.board = rows(drawing);
  q.tray = tray.map(([shape, fabric]) => ({ shape, fabric }));
  return Object.assign(q, tally);
}

/** Three rows wait for one more patch down the right edge. */
const ALMOST = `
  ........
  ...22...
  ..0221..
  3300111.
  3330011.
  2233301.
  22.330..
  1122.00.`;

/** Every row and column has one hole left: the quilt is out of room. */
const FULL = `
  .0011223
  0.011223
  00.12233
  001.2233
  2233.100
  22331.00
  331100.2
  3311002.`;

/** A player a few days in, partway through a good quilt. */
function aFewDaysIn(): GameState {
  const s = createState(NOW - 4 * 86_400_000, 7);
  s.spools = 86;
  s.best = 2310;
  s.hintDone = true;
  s.quilts.endless = quilt('endless', ALMOST, [['tri_v', 1], ['ell_a', 0], ['square', 3]], { score: 1240, streak: 2, patches: 48, seams: 19, bestStreak: 5 });
  s.quilts.daily = quilt('daily', FULL, [['dot', 2], ['duo_h', 1], ['corner_a', 0]], { score: 1180, patches: 41, seams: 15 });
  s.daily = { lastDone: TODAY, streak: 4, bestStreak: 6 };
  s.fabrics = { chosen: 'cottage', bought: ['meadow', 'indigo'] };
  s.commissions = [
    { kind: 'perfect', tier: 1, progress: 3 },
    { kind: 'streak', tier: 1, progress: 7 },
    { kind: 'patches', tier: 1, progress: 64 },
  ];
  s.commissionsDone = 7;
  s.stats = { quilts: 23, patches: 1370, seams: 540, perfect: 31, doubles: 48, clears: 2, bestStreak: 12, playSeconds: 4 * 3600 };
  return s;
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
    name: 'sew',
    show: async (page, url) => {
      await openWith(page, url, aFewDaysIn());
      await page.getByTestId('play-endless').click();
      const slot = await page.getByTestId('patch-0').boundingBox();
      const board = await page.getByTestId('board').boundingBox();
      if (!slot || !board) throw new Error('The quilt is not on screen.');
      // Hold the long patch over the right edge, where it stitches three seams at once.
      const cell = board.width / B.SIZE;
      await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2);
      await page.mouse.down();
      await page.mouse.move(board.x + 7.5 * cell, board.y + 4.5 * cell, { steps: 12 });
      await page.waitForTimeout(150);
    },
  },
  {
    name: 'home',
    show: async (page, url) => {
      await openWith(page, url, aFewDaysIn());
    },
  },
  {
    name: 'finished',
    show: async (page, url) => {
      const s = aFewDaysIn();
      s.quilts.endless = quilt('endless', FULL, [['block', 1], ['quad_h', 0], ['corner_a', 3]], { score: 2480, patches: 131, seams: 58, perfect: 4, bestStreak: 9 });
      await openWith(page, url, s);
      await page.getByTestId('play-endless').click();
      await page.getByTestId('finish').click();
      await page.getByTestId('results').waitFor();
      await settled(page);
    },
  },
  {
    name: 'fabrics',
    show: async (page, url) => {
      await openWith(page, url, aFewDaysIn());
      await page.getByTestId('open-fabrics').click();
      await page.getByTestId('fabrics-modal').waitFor();
      await settled(page);
    },
  },
];
