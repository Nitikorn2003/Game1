import { exportSave, localDayKey } from '@game1/engine';
import { expect, type Page } from '@playwright/test';
import { TIPS, type Tool } from '../src/sim/content.js';
import { COLS, SHOOTER, aimTo, clampAngle, reachedPip, rowOf } from '../src/sim/hive.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone the tests might run in.
export const START = new Date('2026-10-29T12:00:00Z');
export const TODAY = localDayKey(START.getTime());
export const YESTERDAY = localDayKey(START.getTime() - 86_400_000);

/** The aims the tests try, in degrees: the same as the game's hints, steepest first, as those bounce least. */
export const AIMS: readonly number[] = Array.from({ length: 65 }, (_, i) => 10 + i * 2.5).sort((a, b) => Math.abs(a - 90) - Math.abs(b - 90));

/** Opens the game with a controllable clock that runs normally until a test moves it. */
export async function openGame(page: Page): Promise<void> {
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
}

/** Reads the honey the way the game shows it. */
export async function coins(page: Page): Promise<number> {
  const text = (await page.getByTestId('coins').locator('.res__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9-]/g, ''));
}

/** A player who has reached the first `levels` levels, with three stars on each. */
export function player(levels = 0): GameState {
  const s = createState(START.getTime() - 86_400_000);
  s.stars = new Array<number>(levels).fill(3);
  s.stats.won = levels;
  // The notes on what is new have been read, so they stay out of the way.
  s.tips = [...TIPS];
  return s;
}

/** A save made with the game's own code, to start a test from a later point in the game. */
export function saveOf(s: GameState): string {
  return exportSave(saveFormat, s, START.getTime());
}

export async function loadSave(page: Page, save: string): Promise<void> {
  await page.getByTestId('open-settings').click();
  await page.getByTestId('import-save').click();
  await page.getByTestId('import-text').fill(save);
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('settings-message')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** The first of the tests' aims at which a shot from the round in progress does what `ok` asks, on a copy of the game. */
export function aimWhere(s: GameState, ok: (shot: R.Shot, after: GameState) => boolean, tool: Tool | null = null): number {
  for (const angle of AIMS) {
    const after = structuredClone(s);
    const shot = R.shoot(after, angle, tool);
    if (shot && ok(shot, after)) return angle;
  }
  throw new Error('No aim does that.');
}

/** Buds a shot popped or brought down. */
export const goneIn = (shot: R.Shot): number => shot.shot.steps.reduce((n, step) => n + step.popped.length + step.fallen.length, 0);

/** The last shot of a round, and what the game says reaching the goals with it pays. */
export interface Last {
  angle: number;
  stars: number;
  pay: number;
}

/**
 * Plays the game's own hint shots on the round in progress until one more would reach the goals,
 * and returns that shot; when the hint swaps the pollen first, the pollen is swapped already.
 * Throws if the round runs out first.
 */
export function toTheLast(s: GameState): Last {
  for (let guard = 0; guard < 300; guard++) {
    const aim = R.hintAim(s);
    if (!aim) break;
    if (aim.swap) R.swapPollen(s);
    const ahead = structuredClone(s);
    const shot = R.shoot(ahead, aim.angle);
    if (!shot) break;
    if (shot.result) return { angle: aim.angle, stars: shot.result.stars, pay: shot.result.pay };
    R.shoot(s, aim.angle);
    if (R.isStuck(s)) break;
  }
  throw new Error('The round ran out before its goals were reached.');
}

/** Starts a round with `open` that hint shots reach, trying new colours until one is, and plays it up to its last shot. */
export function winnable(s: GameState, open: () => unknown): Last {
  for (let tries = 0; tries < 50; tries++) {
    s.current = null;
    if (!open()) throw new Error('The round could not start.');
    try {
      toTheLast(structuredClone(s));
      return toTheLast(s);
    } catch {
      // Other colours.
    }
  }
  throw new Error('No try at the round could be reached.');
}

/** Leaves the round in progress out of pollen, its goals not reached, with no bud at Pip. */
export function runOut(s: GameState): void {
  const c = s.current;
  if (!c) throw new Error('No round to run out.');
  c.round.shotsLeft = 1;
  const angle = aimWhere(s, (shot, after) => !shot.result && R.isStuck(after) && !reachedPip(after.current?.round.board ?? c.round.board));
  R.shoot(s, angle);
}

/** Shoots pollen that pops nothing, each as low as it sticks, until a bud comes down to Pip. */
export function toPip(s: GameState): void {
  const c = s.current;
  if (!c) throw new Error('No round in progress.');
  for (let guard = 0; guard < 80 && !reachedPip(c.round.board); guard++) {
    c.round.shotsLeft = Math.max(c.round.shotsLeft, 2);
    let best: { angle: number; swap: boolean; row: number } | null = null;
    for (const swap of [false, true]) {
      const base = structuredClone(s);
      if (swap && !R.swapPollen(base)) continue;
      for (const angle of AIMS) {
        const after = structuredClone(base);
        const shot = R.shoot(after, angle);
        if (!shot || shot.result || goneIn(shot) > 0 || shot.shot.cell === null) continue;
        const row = rowOf(shot.shot.cell);
        if (!best || row > best.row) best = { angle, swap, row };
      }
    }
    if (!best) throw new Error('Every shot pops something.');
    if (best.swap) R.swapPollen(s);
    R.shoot(s, best.angle);
  }
  if (!reachedPip(c.round.board)) throw new Error('No bud came down to Pip.');
}

interface Tap {
  x: number;
  y: number;
  /** The aim the game reads from a tap there. */
  angle: number;
}

/** Spots a pixel around a point. */
const NUDGES: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
];

/** Where on the screen a tap aims near `angle`: along its line, far from Pip first, each with the aim the game reads there. */
async function tapsFor(page: Page, angle: number): Promise<Tap[]> {
  const box = await page.getByTestId('board').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width };
  });
  const size = box.width / COLS;
  const rad = (angle * Math.PI) / 180;
  const taps: Tap[] = [];
  for (let d = 14; d >= 2; d -= 0.5) {
    const p = { x: SHOOTER.x + Math.cos(rad) * d, y: SHOOTER.y - Math.sin(rad) * d };
    if (p.x < 0.2 || p.x > COLS - 0.2 || p.y < 0.2) continue;
    for (const [dx, dy] of NUDGES) {
      const x = Math.round(box.left + p.x * size) + dx;
      const y = Math.round(box.top + p.y * size) + dy;
      // The game's own sums, on the same numbers as the page.
      const at = { x: (x - box.left) / size, y: (y - box.top) / size };
      if (at.y < SHOOTER.y - 0.3) taps.push({ x, y, angle: clampAngle(aimTo(at)) });
    }
  }
  return taps;
}

/** What a shot leaves behind, on a copy of the game, with the walls it bounced off: the same for two aims that play out alike. */
function outcomeOf(s: GameState, angle: number, tool: Tool | null): string {
  const after = structuredClone(s);
  const shot = R.shoot(after, angle, tool);
  return shot ? `${String(shot.shot.points.length)}:${JSON.stringify(after)}` : 'none';
}

/** Finds a spot to tap that shoots the way an aim of `angle` would. */
async function tapFor(page: Page, s: GameState, angle: number, tool: Tool | null): Promise<Tap> {
  const want = outcomeOf(s, angle, tool);
  const tap = (await tapsFor(page, angle)).find((t) => outcomeOf(s, t.angle, tool) === want);
  if (!tap) throw new Error(`No tap shoots like an aim of ${String(angle)}.`);
  return tap;
}

/**
 * Shoots the way a finger does: taps where a shot goes the way an aim of `angle` would, and
 * plays the same shot on `s`, so that a test can hold the screen to the game's own rules.
 */
export async function shoot(page: Page, s: GameState, angle: number, tool: Tool | null = null): Promise<R.Shot> {
  const tap = await tapFor(page, s, angle, tool);
  await page.mouse.click(tap.x, tap.y);
  const shot = R.shoot(s, tap.angle, tool);
  if (!shot) throw new Error('The game would not take that shot.');
  return shot;
}

/** Presses on the board to aim the way `angle` would, without letting go. */
export async function pressAim(page: Page, s: GameState, angle: number): Promise<number> {
  const tap = await tapFor(page, s, angle, null);
  await page.mouse.move(tap.x, tap.y);
  await page.mouse.down();
  return tap.angle;
}

/** Waits for the board to finish playing out a shot. */
export async function rested(page: Page): Promise<void> {
  await expect(page.getByTestId('board')).toHaveAttribute('data-busy', 'false');
}

/** Every bud on the board as the screen shows it, in the order of the cells. */
async function shownBuds(page: Page): Promise<string[]> {
  return page
    .locator('.buds [data-cell]')
    .evaluateAll((els) =>
      els.map((el) => {
        const d = (el as HTMLElement).dataset;
        return [d.cell, d.kind, d.colour, d.bee ? 'bee' : '', d.honey ? 'honey' : '', d.butterfly ? 'butterfly' : ''].join(':');
      }),
    );
}

/** Holds the board on the screen to the board of the round in progress in `s`, bud by bud. */
export async function expectBoard(page: Page, s: GameState): Promise<void> {
  const cells = s.current?.round.board.cells ?? [];
  const want = cells.flatMap((bud, cell) =>
    bud ? [[cell, bud.kind, bud.colour, bud.bee ? 'bee' : '', bud.honey ? 'honey' : '', bud.butterfly ? 'butterfly' : ''].join(':')] : [],
  );
  await expect.poll(() => shownBuds(page)).toEqual(want);
}

/** Opens the round in progress from the home screen. */
export async function round(page: Page, button: 'play-next' | 'play-daily' = 'play-next'): Promise<void> {
  await page.getByTestId(button).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

/** Plays a test ad through its countdown and claims the reward. */
export async function watchTestAd(page: Page): Promise<void> {
  await expect(page.getByTestId('test-ad')).toContainText('TEST AD');
  await expect(page.getByTestId('test-ad-claim')).toBeDisabled();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('test-ad')).toBeHidden();
}
