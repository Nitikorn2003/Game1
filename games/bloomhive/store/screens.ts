/**
 * The Google Play screenshots: real moments of the game, from saves made with its own code.
 * `npx tsx tools/store-assets.ts games/bloomhive screens` writes them to store/out/.
 */
import { exportSave, localDayKey } from '@game1/engine';
import type { Page } from '@playwright/test';
import type { StoreScreen } from '../../../tools/store-assets.js';
import { AIMS, pressAim, shoot, toTheLast, type Last } from '../e2e/helpers.js';
import { TIPS } from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone a screenshot might be taken in.
const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const TODAY = localDayKey(NOW);
const YESTERDAY = localDayKey(NOW - 86_400_000);

/** A player a week in: the first zones of the meadow in bloom, honey and tools saved up, and a daily streak going. */
function aWeekIn(reached: number): GameState {
  const s = createState(NOW - 7 * 86_400_000);
  s.stars = Array.from({ length: reached }, (_, i) => [3, 3, 2, 3, 1, 3, 2, 3, 3, 2, 3, 2][i % 12] ?? 3);
  s.coins = 1840;
  s.tools = { rainbow: 3, bomb: 2, sunbeam: 2 };
  s.daily = { day: YESTERDAY, tries: 1, lastDone: YESTERDAY, streak: 4, bestStreak: 6 };
  s.looks = { sky: 'morning', hat: 'leaf', bought: ['sunset', 'straw'] };
  s.tips = [...TIPS];
  s.stats = { rounds: 71, won: reached + 4, dailies: 5, shots: 1150, buds: 9400, bees: 160, continues: 4, toolsUsed: 12, playSeconds: 4 * 3600 };
  return s;
}

/** Plays the game's own hint shots on the round in progress, at most `most` of them and never the one that reaches the goals. */
function play(s: GameState, most: number): void {
  for (let n = 0; n < most; n++) {
    const aim = R.hintAim(s);
    if (!aim) return;
    const ahead = structuredClone(s);
    if (aim.swap) R.swapPollen(ahead);
    const shot = R.shoot(ahead, aim.angle);
    if (!shot || shot.result || R.isStuck(ahead)) return;
    if (aim.swap) R.swapPollen(s);
    R.shoot(s, aim.angle);
  }
}

/** The pollen shot that brings down the most buds from the round as it stands, without reaching the goals or filling the jar. */
function biggestFall(s: GameState): { angle: number; fallen: number } {
  let best = { angle: 90, fallen: -1 };
  if (s.current?.round.bomb) return best;
  for (const angle of AIMS) {
    const after = structuredClone(s);
    const shot = R.shoot(after, angle);
    if (!shot || shot.result || shot.shot.filled) continue;
    const fallen = shot.shot.steps.reduce((n, step) => n + step.fallen.length, 0);
    if (fallen > best.fallen) best = { angle, fallen };
  }
  return best;
}

/** The aim that bounces off a side and pops the most where it sticks. */
function bankShot(s: GameState): number {
  let best = { angle: 0, popped: -1 };
  for (const angle of AIMS) {
    const after = structuredClone(s);
    const shot = R.shoot(after, angle);
    if (!shot || shot.result || shot.shot.points.length <= 2) continue;
    const popped = shot.shot.steps.reduce((n, step) => n + step.popped.length, 0);
    if (popped > best.popped) best = { angle, popped };
  }
  if (best.popped < 0) throw new Error('No shot bounces off a side.');
  return best.angle;
}

/** A try at level `n` that hint shots reach with three stars, played up to its last shot, which it returns. */
function oneShotFrom(s: GameState, n: number): Last {
  for (let tries = 0; tries < 50; tries++) {
    s.current = null;
    if (!R.startLevel(s, n)) throw new Error(`Level ${String(n)} is not open.`);
    try {
      if (toTheLast(structuredClone(s)).stars === 3) return toTheLast(s);
    } catch {
      // Other colours.
    }
  }
  throw new Error(`No try at level ${String(n)} was reached with three stars.`);
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

/** Goes from the home screen to the board of the round in progress. */
async function round(page: Page, button: 'play-next' | 'play-daily'): Promise<void> {
  await page.getByTestId(button).click();
  await page.getByTestId('board').waitFor();
  await page.waitForTimeout(500);
}

/**
 * Shoots, then holds the game still `ms` into the buds falling: the game's timers stopped on
 * Playwright's clock, so the board stays on that step, and every animation paused there.
 */
async function shootAndHold(page: Page, s: GameState, angle: number, ms: number): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 500);
  await shoot(page, s, angle);
  for (let step = 0; step < 100 && (await page.locator('.bud--fall').count()) === 0; step++) await page.clock.runFor(20);
  await page.evaluate((at) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = at;
    }
  }, ms);
}

export const SCREENS: readonly StoreScreen[] = [
  {
    name: 'splash',
    show: async (page, url) => {
      // A shot in the Sunflower Field that brings a whole bunch of buds down, under a sunset sky.
      const s = aWeekIn(50);
      s.looks = { sky: 'sunset', hat: 'straw', bought: ['sunset', 'straw'] };
      if (!R.startLevel(s, 22)) throw new Error('Level 22 is not open.');
      let fall = biggestFall(s);
      for (let n = 0; n < 12 && fall.fallen < 8; n++) {
        play(s, 1);
        fall = biggestFall(s);
      }
      if (fall.fallen < 8) throw new Error('No shot brings a bunch of buds down.');
      await openWith(page, url, s);
      await round(page, 'play-next');
      await shootAndHold(page, s, fall.angle, 300);
    },
  },
  {
    name: 'aim',
    show: async (page, url) => {
      // The Honey Orchard: Pip aims a shot off the side, and the line shows where it will stick.
      const s = aWeekIn(42);
      if (!R.startLevel(s, 42)) throw new Error('Level 42 is not open.');
      play(s, 3);
      const angle = bankShot(s);
      await openWith(page, url, s);
      await round(page, 'play-next');
      await pressAim(page, s, angle);
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'bloom',
    show: async (page, url) => {
      // The last shot of the Sunflower Field, and the sunflower blooms in Pip's garden.
      const s = aWeekIn(23);
      const last = oneShotFrom(s, 24);
      await openWith(page, url, s);
      await round(page, 'play-next');
      await shoot(page, s, last.angle);
      await page.getByTestId('results').waitFor({ timeout: 15_000 });
      // Until its opening animation ends, a pop-up is still partly see-through, and its stars come in one by one.
      await page.waitForTimeout(1_400);
    },
  },
  {
    name: 'sunbeam',
    show: async (page, url) => {
      // Dandelion Hill: the sunbeam lines up every bud it will shine through.
      const s = aWeekIn(52);
      if (!R.startLevel(s, 52)) throw new Error('Level 52 is not open.');
      play(s, 2);
      await openWith(page, url, s);
      await round(page, 'play-next');
      await page.getByTestId('tool-sunbeam').click();
      await pressAim(page, s, 97.5);
      await page.waitForTimeout(300);
    },
  },
  {
    name: 'meadow',
    show: async (page, url) => {
      await openWith(page, url, aWeekIn(50));
    },
  },
  {
    name: 'daily',
    show: async (page, url) => {
      // Today's daily meadow, a few shots in, under the starry night with Pip in a knitted beanie.
      const s = aWeekIn(50);
      s.looks = { sky: 'starry', hat: 'beanie', bought: ['sunset', 'straw', 'starry', 'beanie'] };
      if (!R.openDaily(s, TODAY)) throw new Error('No daily meadow today.');
      play(s, 4);
      await openWith(page, url, s);
      await round(page, 'play-daily');
    },
  },
];
