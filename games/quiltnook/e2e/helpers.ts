import { exportSave, localDayKey } from '@game1/engine';
import { expect, type Page } from '@playwright/test';
import * as B from '../src/sim/board.js';
import * as Q from '../src/sim/quilt.js';
import { SHAPES, type ShapeId } from '../src/sim/shapes.js';
import { createState, saveFormat, type GameState } from '../src/sim/state.js';

// Noon, so that it is the same day in every time zone the tests might run in.
export const START = new Date('2026-10-29T12:00:00Z');
export const TODAY = localDayKey(START.getTime());

/** Opens the game with a controllable clock that runs normally until a test moves it. */
export async function openGame(page: Page): Promise<void> {
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByTestId('home')).toBeVisible();
}

/** Reads the spools the way the game shows them. */
export async function spools(page: Page): Promise<number> {
  const text = (await page.getByTestId('spools').locator('.res__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9-]/g, ''));
}

export async function score(page: Page): Promise<number> {
  const text = (await page.getByTestId('score').locator('.score__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9]/g, ''));
}

/** A board drawn as 8 rows of `.` (empty) and fabrics 0 to 3. */
export function rows(drawing: string): B.Board {
  return drawing
    .trim()
    .split(/\s+/)
    .flatMap((row) => Array.from(row, (mark) => (mark === '.' ? B.EMPTY : Number(mark))));
}

export function quilt(mode: Q.Mode, drawing: string, tray: readonly ([ShapeId, number] | null)[]): Q.Quilt {
  const q = Q.newQuilt(mode, mode === 'daily' ? TODAY : null, 7);
  q.board = rows(drawing);
  q.tray = tray.map((patch) => (patch ? { shape: patch[0], fabric: patch[1] } : null));
  return q;
}

/** A save made with the game's own code, to start a test from a later point in the game. */
export function makeSave(edit: (state: GameState) => void): string {
  const state = createState(START.getTime() - 86_400_000, 7);
  state.hintDone = true;
  edit(state);
  return exportSave(saveFormat, state, START.getTime());
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

/** Where a board square is on screen, and how big squares are. */
async function boardBox(page: Page): Promise<{ x: number; y: number; cell: number }> {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('The quilt is not on screen.');
  return { x: box.x, y: box.y, cell: box.width / B.SIZE };
}

async function slotCentre(page: Page, slot: number): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId(`patch-${String(slot)}`).boundingBox();
  if (!box) throw new Error(`Tray slot ${String(slot)} is not on screen.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Drags a patch with the mouse so that its top left corner lands on square (x, y). */
export async function mouseDrag(page: Page, slot: number, shape: ShapeId, x: number, y: number): Promise<void> {
  const from = await slotCentre(page, slot);
  const b = await boardBox(page);
  const s = SHAPES[shape];
  // A patch dragged with a mouse is held by its middle.
  const to = { x: b.x + (x + s.width / 2) * b.cell, y: b.y + (y + s.height / 2) * b.cell };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

/** Drags a patch with a finger, the way a phone does it, so that it lands on square (x, y). */
export async function touchDrag(page: Page, slot: number, shape: ShapeId, x: number, y: number): Promise<void> {
  const from = await slotCentre(page, slot);
  const b = await boardBox(page);
  const s = SHAPES[shape];
  // A patch dragged with a finger rides above it, so the finger does not hide it.
  const to = { x: b.x + (x + s.width / 2) * b.cell, y: b.y + (y + s.height + 0.8) * b.cell };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= 10; i++) {
    const at = { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Whether square (x, y) of the quilt is sewn. */
export async function sewn(page: Page, x: number, y: number): Promise<boolean> {
  const square = page.locator(`[data-testid=board] [data-square="${String(x)},${String(y)}"]`);
  return (await square.getAttribute('class'))?.includes('sq--sewn') ?? false;
}
