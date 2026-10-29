import { exportSave, localDayKey } from '@game1/engine';
import { expect, type Page } from '@playwright/test';
import { botChoice } from '../src/sim/bot.js';
import { RANKS, type Card } from '../src/sim/cards.js';
import type { Mode } from '../src/sim/content.js';
import type { LayoutId } from '../src/sim/layouts.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat, type Deal, type DealResult, type GameState } from '../src/sim/state.js';

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

/** Reads the coins the way the game shows them. */
export async function coins(page: Page): Promise<number> {
  const text = (await page.getByTestId('coins').locator('.res__value').textContent()) ?? '';
  return Number(text.replace(/[^0-9-]/g, ''));
}

/** A save made with the game's own code, to start a test from a later point in the game. */
export function makeSave(edit: (state: GameState) => void): string {
  const state = createState(START.getTime() - 86_400_000);
  state.taught = true;
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

/** Cards of these ranks (0 the ace), each rank's suits in turn, so that no card comes twice. */
function cardsOf(ranks: readonly number[], used: Map<number, number>): Card[] {
  return ranks.map((rank) => {
    const suit = used.get(rank) ?? 0;
    if (suit > 3) throw new Error(`A deck has four cards of rank ${String(rank)}.`);
    used.set(rank, suit + 1);
    return suit * RANKS + rank;
  });
}

/**
 * Deals the deal of a mode as given, the way the game would have dealt it: cards of these
 * ranks on the layout's spots, in the stock (whose first card starts the pile) and in the
 * reserve that More cards takes from.
 */
export function deal(s: GameState, mode: Mode, layout: LayoutId, spots: readonly number[], stock: readonly number[], reserve: readonly number[] = []): Deal {
  const d = R.openDeal(s, mode, TODAY);
  if (!d) throw new Error(`No ${mode} deal to deal.`);
  const used = new Map<number, number>();
  d.dealt = { layout, cards: cardsOf(spots, used), stock: cardsOf(stock, used), reserve: cardsOf(reserve, used) };
  return d;
}

/**
 * Deals the mode's own deal and clears it the careful player's way, through the game's rules,
 * all but its last card. Returns that card's spot, and what clearing the deal with it pays.
 */
export function allButOne(s: GameState, mode: Mode): { spot: number; result: DealResult } {
  const d = R.openDeal(s, mode, TODAY);
  if (!d) throw new Error(`No ${mode} deal to play.`);
  for (let moves = 0; moves < 200; moves++) {
    const table = R.tableOf(d);
    const spot = botChoice(table);
    if (spot !== null && table.played === d.dealt.cards.length - 1) {
      const result = R.play(structuredClone(s), mode, spot, TODAY)?.result;
      if (!result) throw new Error('The last card did not clear the deal.');
      return { spot, result };
    }
    if (spot === null) {
      if (R.draw(s, mode) === null) throw new Error(`The ${mode} deal got stuck.`);
    } else if (!R.play(s, mode, spot, TODAY)) {
      throw new Error(`The play on spot ${String(spot)} was refused.`);
    }
  }
  throw new Error(`The ${mode} deal went on too long.`);
}

/** The card on top of the pile. */
export async function openCard(page: Page): Promise<number> {
  return Number(await page.getByTestId('pile').getAttribute('data-card'));
}

/** Plays the card on a spot of the table, the way a finger does. */
export async function play(page: Page, spot: number): Promise<void> {
  await page.getByTestId(`card-${String(spot)}`).tap();
}

/** Plays a test ad through its countdown and claims the reward. */
export async function watchTestAd(page: Page): Promise<void> {
  await expect(page.getByTestId('test-ad')).toContainText('TEST AD');
  await expect(page.getByTestId('test-ad-claim')).toBeDisabled();
  await page.clock.runFor(5_500);
  await page.getByTestId('test-ad-claim').click();
  await expect(page.getByTestId('test-ad')).toBeHidden();
}
