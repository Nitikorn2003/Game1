/**
 * The Google Play screenshots: real moments of the game, from saves the scripted player made.
 * `npx tsx tools/store-assets.ts games/lodelings screens` writes them to store/out/.
 */
import { exportSave, localDayKey } from '@game1/engine';
import type { Page } from '@playwright/test';
import type { StoreConfig } from '../../../tools/store-assets.js';
import { ATTENTIVE, newBotGame, playActive } from '../src/sim/bot.js';
import { speciesOf, type EggKind, type Rarity } from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { saveFormat, type GameState } from '../src/sim/state.js';

/** The save of a player who has played actively for this long, mining (not stuck at a Guardian). */
function playedFor(minutes: number): GameState {
  const state = newBotGame(7);
  playActive(state, minutes * 60, ATTENTIVE);
  state.farming = false;
  return state;
}

/** Puts an egg ready to hatch in the first incubator, with the dice set so it gives a new Lodeling of this rarity. */
function readyEgg(state: GameState, kind: EggKind, rarity: Rarity): void {
  const now = state.lastSeenAt;
  state.incubators[0] = { kind, startedAt: now - 60_000, readyAt: now - 1000 };
  for (let seed = 1; seed < 10_000; seed++) {
    const trial = structuredClone(state);
    trial.rng = seed;
    const species = R.hatch(trial, R.ctx(now, localDayKey(now, 0)), 0);
    if (species && speciesOf(species)?.rarity === rarity && !(species in state.roster)) {
      state.rng = seed;
      return;
    }
  }
  throw new Error(`No seed hatches a new ${rarity} Lodeling.`);
}

/** Opens the game at the save's own time, so no time has passed offline, and loads the save. */
async function openWith(page: Page, url: string, state: GameState): Promise<void> {
  await page.clock.install({ time: state.lastSeenAt });
  await page.goto(url);
  await page.getByTestId('rock').waitFor();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('import-save').click();
  await page.getByTestId('import-text').fill(exportSave(saveFormat(R.blockHp), state, state.lastSeenAt));
  await page.getByTestId('import-confirm').click();
  await page.getByTestId('settings-message').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  // A phone shows no keyboard focus ring on the settings button.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

/** Taps the rock like a player, a few times a second, so a few damage numbers are in the air. */
async function tap(page: Page, times: number): Promise<void> {
  const rock = page.getByTestId('rock');
  for (let i = 0; i < times; i++) {
    await rock.dispatchEvent('pointerdown', { button: 0, isPrimary: true, pointerType: 'touch' });
    await page.waitForTimeout(160);
  }
}

/** Scrolls the open tab down by this many pixels, to show what is further down it. */
async function scrollPanel(page: Page, pixels: number): Promise<void> {
  await page.locator('main.panel').evaluate((panel, top) => {
    panel.scrollTop = top;
  }, pixels);
}

const config: StoreConfig = {
  locales: ['en', 'th'],
  screens: [
    {
      name: 'mine',
      show: async (page, url) => {
        await openWith(page, url, playedFor(30));
        await tap(page, 4);
      },
    },
    {
      name: 'guardian',
      show: async (page, url) => {
        const state = playedFor(30);
        // A few seconds into the next Guardian fight, with the Guardian well hurt.
        state.depth = Math.ceil((state.depth + 1) / 5) * 5;
        state.maxDepth = Math.max(state.maxDepth, state.depth);
        R.startGuardian(state, R.ctx(state.lastSeenAt, localDayKey(state.lastSeenAt, 0)));
        state.hp = (state.guardian?.maxHp ?? 0) * 0.42;
        await openWith(page, url, state);
        await tap(page, 4);
      },
    },
    {
      name: 'hatch',
      show: async (page, url) => {
        const state = playedFor(30);
        readyEgg(state, 'prism', 'legendary');
        await openWith(page, url, state);
        await page.getByTestId('tab-eggs').click();
        await page.getByTestId('hatch-0').click();
        await page.getByTestId('hatch-headline').waitFor();
        await page.waitForTimeout(1000);
      },
    },
    {
      name: 'lodelings',
      show: async (page, url) => {
        await openWith(page, url, playedFor(30));
        await page.getByTestId('tab-lodelings').click();
        await scrollPanel(page, 150);
      },
    },
    {
      name: 'eggs',
      show: async (page, url) => {
        await openWith(page, url, playedFor(30));
        await page.getByTestId('tab-eggs').click();
      },
    },
    {
      name: 'relics',
      show: async (page, url) => {
        await openWith(page, url, playedFor(30));
        await page.getByTestId('tab-relics').click();
      },
    },
  ],
};

export default config;
