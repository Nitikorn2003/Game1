import { exportSave, localDayKey } from '@game1/engine';
import { expect, type Page } from '@playwright/test';
import { TIPS } from '../src/sim/content.js';
import { TRAY, dealOf, hidden, takeable, uncovered, type Place } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone the tests might run in.
export const START = new Date('2026-10-29T12:00:00Z');
export const TODAY = localDayKey(START.getTime());
export const YESTERDAY = localDayKey(START.getTime() - 86_400_000);

/** Opens the game with a controllable clock that runs normally until a test moves it. */
export async function openGame(page: Page): Promise<void> {
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
}

/** Reads the sugar the way the game shows it. */
export async function coins(page: Page): Promise<number> {
  const text = (await page.getByTestId('coins').locator('.res__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9-]/g, ''));
}

/** A player who has cleared the first `levels` levels, with three stars on each. */
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

/** Opens the round in progress from the home screen. */
export async function round(page: Page, button: 'play-next' | 'play-daily' = 'play-next'): Promise<void> {
  await page.getByTestId(button).click();
  await expect(page.getByTestId('table')).toBeVisible();
}

/** Waits for the table to finish playing out a take or a tool. */
export async function rested(page: Page): Promise<void> {
  await expect(page.getByTestId('table')).toHaveAttribute('data-busy', 'false');
}

/** The tiles of the round in progress still on the counter, in the order its deal was made: taken in turn, they clear it with three stars. */
export function dealOrder(s: GameState): number[] {
  const c = s.current;
  const level = R.currentLevel(s);
  if (!c || !level) throw new Error('No round in progress.');
  return dealOf(level, c.round.seed).order.filter((tile) => c.round.at[tile] === 'counter');
}

/** Taps a tile the way a finger does, and takes the same tile in `s`, so that a test can hold the screen to the game's own rules. */
export async function takeTile(page: Page, s: GameState, tile: number): Promise<R.Took> {
  await page.getByTestId(`tile-${String(tile)}`).click();
  const took = R.take(s, tile);
  if (!took) throw new Error(`Tile ${String(tile)} cannot be taken.`);
  return took;
}

/** Takes tiles along the deal of the round in progress until `left` are still to take, waiting for each to land. */
export async function playDeal(page: Page, s: GameState, left = 0): Promise<R.Took | null> {
  let last: R.Took | null = null;
  const order = dealOrder(s);
  for (const tile of order.slice(0, Math.max(0, order.length - left))) {
    last = await takeTile(page, s, tile);
    if (last.result) return last;
    await rested(page);
  }
  return last;
}

/** Plays the deal of the round in progress in `s` up to its last take, and returns that tile. */
export function toTheLast(s: GameState): number {
  const order = dealOrder(s);
  const last = order.pop();
  if (last === undefined) throw new Error('Nothing to take.');
  for (const tile of order) {
    if (!R.take(s, tile)) throw new Error(`Tile ${String(tile)} cannot be taken.`);
  }
  return last;
}

/** Fills the tray of the round in progress from the counter up to `count`, two of a kind at most so that none box up: full, unless asked. */
export function jam(s: GameState, count = TRAY): void {
  const r = s.current?.round;
  if (!r) throw new Error('No round in progress.');
  const onTray = (kind: number) => r.tray.filter((t) => r.kinds[t] === kind).length;
  while (r.tray.length < count) {
    const tile = takeableTiles(s).find((t) => r.at[t] === 'counter' && onTray(r.kinds[t] ?? -1) < 2);
    if (tile === undefined) throw new Error('No tile keeps the tray from boxing up.');
    R.take(s, tile);
  }
}

/** The tiles a player can take now, from the counter or the rack. */
export function takeableTiles(s: GameState): number[] {
  const c = s.current;
  const level = R.currentLevel(s);
  if (!c || !level) return [];
  const can = takeable(c.round, level);
  return c.round.at.flatMap((at, tile) => (at === 'rack' || (can[tile] ?? false) ? [tile] : []));
}

/** Every tile on the screen, with its place, its pastry and where it is on the tray or the rack, in the order of the tiles. */
async function shownTiles(page: Page): Promise<string[]> {
  return page
    .locator('.tiles [data-testid^="tile-"]')
    .evaluateAll((els) =>
      els
        .map((el) => {
          const d = (el as HTMLElement).dataset;
          return { tile: Number(d.testid?.slice(5)), at: `${d.place ?? ''}:${d.kind ?? ''}:${d.index ?? ''}` };
        })
        .sort((a, b) => a.tile - b.tile)
        .map((t) => `${String(t.tile)}:${t.at}`),
    );
}

/** Holds the table on the screen to the round in progress in `s`, tile by tile: where each is, and what it shows. */
export async function expectTable(page: Page, s: GameState): Promise<void> {
  const c = s.current;
  const level = R.currentLevel(s);
  if (!c || !level) throw new Error('No round in progress.');
  const r = c.round;
  const free = uncovered(r, level);
  const want = r.at.flatMap((at: Place, tile) => {
    if (at === 'gone') return [];
    const bag = at === 'counter' && hidden(r, level, tile, free);
    const index = at === 'tray' ? String(r.tray.indexOf(tile)) : at === 'rack' ? String(r.rack.indexOf(tile)) : '';
    return [`${String(tile)}:${at}:${bag ? 'hidden' : String(r.kinds[tile])}:${index}`];
  });
  await expect.poll(() => shownTiles(page)).toEqual(want);
  await expect(page.getByTestId('tray')).toHaveAttribute('data-count', String(r.tray.length));
  await expect(page.getByTestId('rack')).toHaveAttribute('data-count', String(r.rack.length));
}

/** Plays a test ad through its countdown and claims the reward. */
export async function watchTestAd(page: Page): Promise<void> {
  await expect(page.getByTestId('test-ad')).toContainText('TEST AD');
  await expect(page.getByTestId('test-ad-claim')).toBeDisabled();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('test-ad')).toBeHidden();
}
