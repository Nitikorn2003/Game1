/**
 * The Google Play screenshots: real moments of the game, from saves made with its own code.
 * `npx tsx tools/store-assets.ts games/tidegarden screens` writes them to store/out/.
 */
import { exportSave, localDayKey } from '@game1/engine';
import type { Page } from '@playwright/test';
import type { StoreScreen } from '../../../tools/store-assets.js';
import { BOMB, ROW, isColour, type Move } from '../src/sim/board.js';
import { TIPS } from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone a screenshot might be taken in.
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const TODAY = localDayKey(NOW);
const YESTERDAY = localDayKey(NOW - 86_400_000);

/** A player a week in: the first zones of the reef home, sand dollars and tools saved up, and a daily streak going. */
function aWeekIn(reached: number): GameState {
  const s = createState(NOW - 7 * 86_400_000);
  s.stars = Array.from({ length: reached }, (_, i) => [3, 3, 2, 3, 1, 3, 2, 3, 3, 2, 3, 2][i % 12] ?? 3);
  s.coins = 1840;
  s.tools = { claw: 4, tide: 2, crab: 3 };
  s.daily = { day: YESTERDAY, tries: 1, lastDone: YESTERDAY, streak: 4, bestStreak: 6 };
  s.looks = { water: 'sunlit', buddy: 'clownfish', bought: ['sunset', 'manta'] };
  s.tips = [...TIPS];
  s.stats = { dives: 71, won: reached + 4, dailies: 5, moves: 1150, cleared: 21_400, turtles: 9, continues: 4, toolsUsed: 12, playSeconds: 4 * 3600 };
  return s;
}

/** Plays the game's own hint moves on the dive in progress, at most `most` of them and never the one that reaches the goals. */
function play(s: GameState, most: number): void {
  for (let n = 0; n < most; n++) {
    const move = R.hintMove(s);
    if (!move) return;
    const ahead = structuredClone(s);
    if (R.swap(ahead, move.from, move.to)?.result || R.isStuck(ahead)) return;
    R.swap(s, move.from, move.to);
  }
}

/** Plays hint moves until one more reaches the goals; that move and its stars, or null if the dive runs out first. */
function toTheLast(s: GameState): { move: Move; stars: number } | null {
  for (let guard = 0; guard < 200; guard++) {
    const move = R.hintMove(s);
    if (!move) return null;
    const ahead = structuredClone(s);
    const moved = R.swap(ahead, move.from, move.to);
    if (!moved) return null;
    if (moved.result) return { move, stars: moved.result.stars };
    R.swap(s, move.from, move.to);
    if (R.isStuck(s)) return null;
  }
  return null;
}

/** A try at level `n` that hint moves reach with three stars, played up to its last move, which it returns. */
function oneMoveFrom(s: GameState, n: number): Move {
  for (let tries = 0; tries < 50; tries++) {
    s.current = null;
    if (!R.startLevel(s, n)) throw new Error(`Level ${String(n)} is not open.`);
    const last = toTheLast(structuredClone(s));
    if (last?.stars === 3) {
      toTheLast(s);
      return last.move;
    }
  }
  throw new Error(`No try at level ${String(n)} was reached with three stars.`);
}

/** Makes two pieces side by side near the middle of the board a wave and a bubble bomb, for the player to swap together. */
function waveBesideBomb(s: GameState): Move {
  const b = s.current?.dive.board;
  if (!b) throw new Error('No dive to put the specials in.');
  const free = (c: number) => b.open[c] === true && (b.kelp[c] ?? 0) === 0 && isColour(b.pieces[c]?.kind ?? -1) && b.pieces[c]?.special === 0;
  const middle = Math.floor(b.height / 2) * b.width + Math.floor(b.width / 2) - 1;
  for (let c = middle; c < b.pieces.length - 1; c++) {
    const wave = b.pieces[c];
    const bomb = b.pieces[c + 1];
    if (!wave || !bomb || !free(c) || !free(c + 1) || (c + 1) % b.width === 0) continue;
    b.pieces[c] = { ...wave, special: ROW };
    b.pieces[c + 1] = { ...bomb, special: BOMB };
    return { from: c, to: c + 1 };
  }
  throw new Error('No two plain pieces side by side.');
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

/** Swipes one piece onto another, as a finger would. */
async function swipe(page: Page, move: Move): Promise<void> {
  const from = await page.getByTestId(`cell-${String(move.from)}`).boundingBox();
  const to = await page.getByTestId(`cell-${String(move.to)}`).boundingBox();
  if (!from || !to) throw new Error(`Cells ${String(move.from)} and ${String(move.to)} are not on the screen.`);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 });
  await page.mouse.up();
}

/**
 * Swipes a move, then holds the game still `ms` into its first clear: the game's timers stopped
 * on Playwright's clock, so the board stays on that step, and every animation paused there.
 */
async function swipeAndHold(page: Page, move: Move, ms: number): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 500);
  await swipe(page, move);
  // The swap slides in 180 ms; then the clear begins.
  await page.clock.runFor(200);
  await page.locator('.pc--pop').first().waitFor({ state: 'attached' });
  await page.evaluate((at) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = at;
    }
  }, ms);
}

/** Goes from the home screen to the board of the dive in progress. */
async function dive(page: Page, button: 'play-next' | 'play-daily'): Promise<void> {
  await page.getByTestId(button).click();
  await page.getByTestId('board').waitFor();
  await page.waitForTimeout(400);
}

export const SCREENS: readonly StoreScreen[] = [
  {
    name: 'splash',
    show: async (page, url) => {
      // A wave swapped onto a bubble bomb in the Coral Garden: three rows and three columns wash clear.
      const s = aWeekIn(50);
      s.looks.water = 'sunset';
      s.looks.buddy = 'manta';
      if (!R.startLevel(s, 44)) throw new Error('Level 44 is not open.');
      play(s, 6);
      const move = waveBesideBomb(s);
      await openWith(page, url, s);
      await dive(page, 'play-next');
      // The beams across the board, as the pieces in their way pop.
      await swipeAndHold(page, move, 90);
    },
  },
  {
    name: 'turtles',
    show: async (page, url) => {
      // Turtle Beach, a few moves in, with baby turtles on their way down to the sea.
      const s = aWeekIn(50);
      if (!R.startLevel(s, 51)) throw new Error('Level 51 is not open.');
      play(s, 5);
      await openWith(page, url, s);
      await dive(page, 'play-next');
    },
  },
  {
    name: 'home-again',
    show: async (page, url) => {
      // The last move of the Coral Garden, and the parrotfish comes home.
      const s = aWeekIn(47);
      const move = oneMoveFrom(s, 48);
      await openWith(page, url, s);
      await dive(page, 'play-next');
      await swipe(page, move);
      await page.getByTestId('results').waitFor({ timeout: 15_000 });
      await settled(page);
    },
  },
  {
    name: 'reef',
    show: async (page, url) => {
      await openWith(page, url, aWeekIn(50));
    },
  },
  {
    name: 'daily',
    show: async (page, url) => {
      // Today's daily dive, a few moves in, in the glowing night with the leafy sea dragon.
      const s = aWeekIn(50);
      s.looks = { water: 'glow', buddy: 'seadragon', bought: ['sunset', 'manta', 'glow', 'seadragon'] };
      if (!R.openDaily(s, TODAY)) throw new Error('No daily dive today.');
      play(s, 4);
      await openWith(page, url, s);
      await dive(page, 'play-daily');
    },
  },
  {
    name: 'looks',
    show: async (page, url) => {
      const s = aWeekIn(50);
      s.looks.water = 'moonlit';
      s.looks.bought.push('moonlit');
      await openWith(page, url, s);
      await page.getByTestId('open-looks').click();
      await page.getByTestId('looks').waitFor();
      await settled(page);
    },
  },
];
