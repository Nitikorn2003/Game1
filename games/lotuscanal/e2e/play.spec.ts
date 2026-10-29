import { expect, test, type Page } from '@playwright/test';
import { botPlay } from '../src/sim/bot.js';
import { WILD } from '../src/sim/cards.js';
import * as C from '../src/sim/content.js';
import { makeDeal } from '../src/sim/deal.js';
import { LAYOUT_IDS } from '../src/sim/layouts.js';
import { makeLevel } from '../src/sim/levels.js';
import * as R from '../src/sim/rules.js';
import type { GameState } from '../src/sim/state.js';
import { EXTRA_CARDS, replay } from '../src/sim/table.js';
import { TODAY, YESTERDAY, allButOne, coins, deal, loadSave, makeSave, openCard, openGame, play, watchTestAd } from './helpers.js';

/**
 * Two peaks. The pile starts with the 5 of fish; on the bottom line lie a 4, the 5 of lotus,
 * the 6 of mango, the 7 and 8 of fish, the 9 of lotus, a 4 and a 5. The 10 of lotus lies on
 * the 6 and the 7, so it turns face up once both are played; the stock holds an ace and a 2,
 * and More cards adds a 3 first.
 */
function basic(s: GameState): void {
  deal(s, 'level', 'peaks2', [12, 12, 11, 11, 10, 10, 6, 7, 9, 5, 6, 7, 3, 4, 5, 6, 7, 8, 3, 4], [4, 0, 1], [2, 3, 8, 9, 10]);
}
const FIVE_OF_FISH = 30;
const SIX_OF_MANGO = 18;
const ACE_OF_LOTUS = 0;
const TWO_OF_LOTUS = 1;
const THREE_OF_LOTUS = 2;

/** An ace on the pile, nothing that fits it face up, and no stock: stuck at once, with no cards to add. */
function stuck(s: GameState): void {
  deal(s, 'level', 'peaks2', [9, 9, 10, 10, 11, 11, 6, 7, 8, 5, 6, 7, 3, 4, 5, 6, 7, 8, 3, 4], [0]);
}

async function playLevel(page: Page, save: string): Promise<void> {
  await loadSave(page, save);
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('board')).toBeVisible();
}

test('the first level: play cards one higher or lower, turn the stock, clear the table and sail on', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('canal-name')).toHaveText('The Old Landing');
  await expect(page.getByTestId('trip-progress')).toHaveText('Stop 1 of 10');
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('deal-title')).toHaveText('Level 1');
  await expect(page.getByTestId('deal-where')).toHaveText('The Old Landing · stop 1 of 10');
  await expect(page.getByTestId('teach')).toBeVisible();
  // The careful player's way through the real first deal, tapped out on the screen.
  const { dealt } = makeLevel(1, 0);
  const way = botPlay(dealt);
  expect(way.won).toBe(true);
  for (const move of way.moves) {
    if (move.kind === 'play') await play(page, move.spot);
    else await page.getByTestId('stock').tap();
  }
  await expect(page.getByTestId('teach')).toBeHidden();
  await expect(page.getByTestId('cleared')).toBeVisible();
  await expect(page.getByTestId('results')).toBeVisible();
  const table = replay(dealt, way.moves).table;
  const paid = table.pot + C.levelCoins(1) + table.stock.length * C.SPARE_COINS;
  await expect(page.getByTestId('result-clean')).toBeVisible();
  await expect(page.getByTestId('result-run')).toHaveText(`Longest run: ${String(table.bestStreak)} cards`);
  await expect(page.getByTestId('result-next-stop')).toHaveText('Next: The Old Landing, stop 2 of 10');
  await expect(page.getByTestId('result-coins')).toHaveText(`+${String(paid)} coins`);
  expect(await coins(page)).toBe(paid);
  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('deal-title')).toHaveText('Level 2');
  await page.reload();
  await expect(page.getByTestId('level-name')).toHaveText('Level 2');
  await expect(page.getByTestId('trip-progress')).toHaveText('Stop 2 of 10');
});

test('a card one rank away goes onto the pile, others stay put, and every fifth card in a row pays more', async ({ page }) => {
  await openGame(page);
  await playLevel(page, makeSave(basic));
  const pile = page.getByTestId('pile');
  await expect(pile).toHaveAccessibleName('Open card: 5 of fish');
  await expect(page.getByTestId('card-13')).toHaveAccessibleName('5 of lotus');
  // A 5 does not go onto a 5.
  await play(page, 13);
  await expect(page.getByTestId('card-13')).toBeVisible();
  expect(await openCard(page)).toBe(FIVE_OF_FISH);
  await play(page, 14);
  await expect(pile).toHaveAttribute('data-card', String(SIX_OF_MANGO));
  await expect(page.getByTestId('card-14')).toHaveCount(0);
  await expect(page.getByTestId('cards-left')).toHaveText('19 left');
  await expect(page.getByTestId('pot')).toHaveAccessibleName('Coins from this deal: 1');
  // The 10 of lotus lay on the 6 and the 7: it turns face up once both are played.
  await expect(page.getByTestId('card-8')).toHaveClass(/card--down/);
  await play(page, 15);
  await expect(page.getByTestId('card-8')).toHaveClass(/card--up/);
  await expect(page.getByTestId('card-8')).toHaveAccessibleName('10 of lotus');
  await play(page, 16);
  await play(page, 17);
  await expect(page.getByTestId('streak')).toHaveAttribute('data-streak', '4');
  await expect(page.getByTestId('streak-bonus')).toHaveCount(0);
  await play(page, 8);
  await expect(page.getByTestId('streak')).toHaveAttribute('data-streak', '5');
  await expect(page.getByTestId('streak-bonus')).toHaveText('+5 run bonus');
  await expect(page.getByTestId('pot')).toHaveAccessibleName('Coins from this deal: 10');
});

test('the stock turns a new open card and ends the run; out of moves, five more cards from a test ad go on', async ({ page }) => {
  await openGame(page);
  await playLevel(page, makeSave(basic));
  const stock = page.getByTestId('stock');
  await expect(stock).toHaveAttribute('data-count', '2');
  await expect(page.getByTestId('tool-extraCards')).toBeDisabled();
  await play(page, 14);
  await expect(page.getByTestId('streak')).toHaveAttribute('data-streak', '1');
  await stock.tap();
  await expect(page.getByTestId('pile')).toHaveAttribute('data-card', String(ACE_OF_LOTUS));
  await expect(page.getByTestId('streak')).toHaveAttribute('data-streak', '0');
  await expect(stock).toHaveAccessibleName('Stock: one card. Tap to turn it over.');
  await stock.tap();
  await expect(page.getByTestId('pile')).toHaveAttribute('data-card', String(TWO_OF_LOTUS));
  await expect(stock).toHaveAccessibleName('The stock is empty.');
  // Nothing face up goes onto a 2.
  await expect(page.getByTestId('stuck')).toContainText('Out of moves. Add more cards, play a lotus wild, or end this deal.');
  const more = page.getByTestId('tool-extraCards');
  await expect(more).toHaveText(`+${String(EXTRA_CARDS)} cards`);
  await more.click();
  await expect(page.getByTestId('tool-sheet')).toContainText(`Adds ${String(EXTRA_CARDS)} cards to the empty stock.`);
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(stock).toHaveAttribute('data-count', String(EXTRA_CARDS));
  await expect(page.getByTestId('stuck')).toBeHidden();
  await expect(more).toBeDisabled();
  await stock.tap();
  await expect(page.getByTestId('pile')).toHaveAttribute('data-card', String(THREE_OF_LOTUS));
  await play(page, 12);
  await expect(page.getByTestId('card-12')).toHaveCount(0);
});

test('Undo takes plays and draws back: two are free, and more come from a test ad', async ({ page }) => {
  await openGame(page);
  await playLevel(page, makeSave(basic));
  const undo = page.getByTestId('tool-undo');
  await expect(undo).toHaveText('Undo2');
  await expect(undo).toBeDisabled();
  await play(page, 14);
  await undo.click();
  await expect(page.getByTestId('card-14')).toBeVisible();
  await expect(page.getByTestId('pile')).toHaveAttribute('data-card', String(FIVE_OF_FISH));
  await expect(undo).toHaveText('Undo1');
  await page.getByTestId('stock').tap();
  await undo.click();
  await expect(page.getByTestId('pile')).toHaveAttribute('data-card', String(FIVE_OF_FISH));
  await expect(page.getByTestId('stock')).toHaveAttribute('data-count', '2');
  await expect(undo).toHaveText('More undos+');
  await expect(undo).toBeDisabled();
  await play(page, 14);
  await undo.click();
  await expect(page.getByTestId('tool-sheet')).toContainText(`The free undos of this deal are used up. Get ${String(C.MORE_UNDOS)} more.`);
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(undo).toHaveText(`Undo${String(C.MORE_UNDOS)}`);
  await undo.click();
  await expect(page.getByTestId('pile')).toHaveAttribute('data-card', String(FIVE_OF_FISH));
  await expect(undo).toHaveText(`Undo${String(C.MORE_UNDOS - 1)}`);
});

test('a lotus wild for coins takes any face-up card, and Undo cannot take the wild back', async ({ page }) => {
  await openGame(page);
  await playLevel(
    page,
    makeSave((s) => {
      s.coins = 120;
      basic(s);
    }),
  );
  await page.getByTestId('tool-wild').click();
  await expect(page.getByTestId('tool-sheet')).toContainText('Puts a lotus wild on the open card.');
  await expect(page.getByTestId('tool-spend')).toHaveText(`Use ${String(C.TOOL_COSTS.wild)} coins`);
  await page.getByTestId('tool-spend').click();
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  const pile = page.getByTestId('pile');
  await expect(pile).toHaveAttribute('data-card', String(WILD));
  await expect(pile).toHaveAccessibleName('Open card: Lotus wild: any card goes on it');
  await expect(page.getByTestId('tool-wild')).toBeDisabled();
  expect(await coins(page)).toBe(120 - C.TOOL_COSTS.wild);
  // The 5 of lotus did not fit the 5 of fish; on the wild it does.
  await play(page, 13);
  await expect(pile).toHaveAccessibleName('Open card: 5 of lotus');
  await page.getByTestId('tool-undo').click();
  await expect(pile).toHaveAttribute('data-card', String(WILD));
  await expect(page.getByTestId('tool-undo')).toBeDisabled();
});

test('a stuck deal can be ended: it pays nothing, and the level is dealt anew', async ({ page }) => {
  await openGame(page);
  await playLevel(page, makeSave(stuck));
  await expect(page.getByTestId('stuck')).toBeVisible();
  // No cards are left to add, but a wild would still help.
  await expect(page.getByTestId('tool-extraCards')).toBeDisabled();
  await expect(page.getByTestId('tool-wild')).toBeEnabled();
  await page.getByTestId('end-deal').click();
  await expect(page.getByTestId('results')).toContainText('Out of moves');
  await expect(page.getByTestId('result-cleared')).toHaveText('0 of 20 cards cleared');
  expect(await coins(page)).toBe(0);
  await page.getByTestId('result-again').click();
  await expect(page.getByTestId('results')).toBeHidden();
  await expect(page.getByTestId('pile')).toHaveAttribute('data-card', String(makeLevel(1, 1).dealt.stock[0]));
  await expect(page.getByTestId('stuck')).toBeHidden();
});

test('a cleared deal pays its pot, its level pay and its spare cards, and an ad doubles it once', async ({ page }) => {
  await openGame(page);
  let last = { spot: 0, coins: 0 };
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 3;
      s.stats.wins = 2;
      const { spot, result } = allButOne(s, 'level');
      last = { spot, coins: result.coins };
    }),
  );
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('deal-title')).toHaveText('Level 3');
  await play(page, last.spot);
  await expect(page.getByTestId('results')).toContainText('Level 3 cleared');
  await expect(page.getByTestId('result-next-stop')).toHaveText('Next: The Old Landing, stop 4 of 10');
  await expect(page.getByTestId('result-coins')).toHaveText(`+${String(last.coins)} coins`);
  expect(await coins(page)).toBe(last.coins);
  await page.getByTestId('double').click();
  await watchTestAd(page);
  await expect(page.getByTestId('result-coins')).toHaveText(`+${String(2 * last.coins)} coins`);
  await expect(page.getByTestId('double')).toBeHidden();
  expect(await coins(page)).toBe(2 * last.coins);
});

test('the last stop of a canal pays a bonus and a postcard, and the boat sails into the next canal', async ({ page }) => {
  await openGame(page);
  let last = { spot: 0, coins: 0 };
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 10;
      s.stats.wins = 9;
      const { spot, result } = allButOne(s, 'level');
      last = { spot, coins: result.coins };
    }),
  );
  await expect(page.getByTestId('trip-progress')).toHaveText('Stop 10 of 10');
  await page.getByTestId('play-level').click();
  await play(page, last.spot);
  await expect(page.getByTestId('result-canal')).toContainText(`The Old Landing: the end of the canal! +${String(C.CANAL_COINS)} coins`);
  await expect(page.getByTestId('result-canal')).toContainText('Where every trip begins');
  await expect(page.getByTestId('result-coins')).toHaveText(`+${String(last.coins)} coins`);
  expect(await coins(page)).toBe(last.coins + C.CANAL_COINS);
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('canal-name')).toHaveText('Mango Orchards');
  await expect(page.getByTestId('trip-progress')).toHaveText('Stop 1 of 10');
  await expect(page.getByTestId('trip-card')).toContainText('1 of 12 canals behind you');
  await page.getByTestId('open-map').click();
  await expect(page.getByTestId('canal-landing')).toContainText('Where every trip begins');
  await expect(page.getByTestId('canal-mango')).toContainText('Stop 1 of 10');
  await expect(page.getByTestId('canal-kingfisher')).toContainText('Ahead');
});

test('the daily deal pays once, keeps the streak going and shows as cleared at home', async ({ page }) => {
  await openGame(page);
  let last = { spot: 0, coins: 0 };
  await loadSave(
    page,
    makeSave((s) => {
      s.daily = { lastDone: YESTERDAY, streak: 4, bestStreak: 4 };
      const { spot, result } = allButOne(s, 'daily');
      last = { spot, coins: result.coins };
    }),
  );
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 4');
  await page.getByTestId('play-daily').click();
  await expect(page.getByTestId('deal-title')).toHaveText('Daily deal');
  await play(page, last.spot);
  await expect(page.getByTestId('results')).toContainText('Daily deal cleared');
  await expect(page.getByTestId('result-streak')).toHaveText('Daily streak: 5');
  await expect(page.getByTestId('result-tally')).toContainText(`Daily deal+${String(C.DAILY_COINS)}`);
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('daily-status')).toHaveText('Cleared for today. A new daily deal comes tomorrow.');
  await expect(page.getByTestId('play-daily')).toBeHidden();
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 5');
  expect(await coins(page)).toBe(last.coins);
  expect(last.coins).toBeGreaterThanOrEqual(C.DAILY_COINS);
});

test('a deal keeps its place: home and back, and after a reload, with its undos', async ({ page }) => {
  await openGame(page);
  await playLevel(page, makeSave(basic));
  await play(page, 14);
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('play-level')).toContainText('Continue');
  await page.reload();
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('card-14')).toHaveCount(0);
  expect(await openCard(page)).toBe(SIX_OF_MANGO);
  await page.getByTestId('tool-undo').click();
  await expect(page.getByTestId('card-14')).toBeVisible();
  await expect(page.getByTestId('tool-undo')).toHaveText('Undo1');
});

test('ad breaks wait for the first cleared deals and a few minutes of play, and come between deals', async ({ page }) => {
  await openGame(page);
  let spot = 0;
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 4;
      s.stats.wins = 3;
      spot = allButOne(s, 'level').spot;
    }),
  );
  // As if the phone had been put down a while: timers due in the meantime fire once.
  await page.clock.fastForward(6 * 60_000);
  await page.getByTestId('play-level').click();
  await play(page, spot);
  await page.getByTestId('result-next').click();
  // Four deals cleared: too early for one.
  await expect(page.getByTestId('deal-title')).toHaveText('Level 5');
  await page.clock.runFor(1_000);
  await expect(page.getByTestId('test-interstitial')).toBeHidden();

  await page.getByTestId('go-home').click();
  await loadSave(
    page,
    makeSave((s) => {
      s.level = 5;
      s.stats.wins = C.AD_BREAKS_AFTER_WINS - 1;
      spot = allButOne(s, 'level').spot;
    }),
  );
  await page.getByTestId('play-level').click();
  await play(page, spot);
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('test-interstitial')).toContainText('Ad break');
  await page.getByTestId('test-ad-close').click();
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a test purchase shows that no money is charged and delivers once; the Market Kit brings its card backs', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await expect(page.getByTestId('test-note')).toBeVisible();
  await page.getByTestId('buy-coins_small').click();
  const dialog = page.getByTestId('test-purchase');
  await expect(dialog).toContainText('No money is charged');
  await expect(dialog).toContainText('$0.99');
  await page.getByTestId('test-purchase-cancel').click();
  await page.clock.runFor(300);
  expect(await coins(page)).toBe(0);

  await page.getByTestId('buy-coins_small').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect.poll(() => coins(page)).toBe(500);
  await page.reload();
  await expect.poll(() => coins(page)).toBe(500);

  await page.getByTestId('open-shop').click();
  await page.getByTestId('buy-market_kit').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect(page.getByTestId('offer-market_kit')).toContainText('Owned');
  await expect.poll(() => coins(page)).toBe(1500);
  await page.keyboard.press('Escape');
  await page.getByTestId('open-looks').click();
  await page.getByTestId(`use-${C.MARKET_KIT_BACK}`).click();
  await expect(page.getByTestId(`look-${C.MARKET_KIT_BACK}`)).toContainText('In use');
  expect(await coins(page)).toBe(1500);
});

test('free coins from a test ad, with the daily limit shown', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('coins').click();
  const offer = page.getByTestId('offer-free');
  await expect(offer).toContainText(`${String(R.AD_LIMITS.perPlacement.free_coins)} left today`);
  await page.getByTestId('watch-free').click();
  await page.getByTestId('test-ad-close').click();
  await page.clock.runFor(500);
  expect(await coins(page)).toBe(0);
  await page.getByTestId('watch-free').click();
  await watchTestAd(page);
  await expect.poll(() => coins(page)).toBe(C.FREE_COINS);
  await expect(offer).toContainText(`${String(R.AD_LIMITS.perPlacement.free_coins - 1)} left today`);
});

test('No Ad Breaks: help that comes from a video comes without one', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await page.getByTestId('buy-remove_ads').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect(page.getByTestId('offer-remove_ads')).toContainText('Owned');
  await page.keyboard.press('Escape');
  await page.getByTestId('play-level').click();
  await page.getByTestId('tool-wild').click();
  await expect(page.getByTestId('tool-watch')).toHaveText('Get it free');
  await page.getByTestId('tool-watch').click();
  await expect(page.getByTestId('pile')).toHaveAttribute('data-card', String(WILD));
  await expect(page.getByTestId('test-ad')).toBeHidden();
  expect(await coins(page)).toBe(0);
});

test('card backs bought with coins are used at once, and stay after a reload', async ({ page }) => {
  await openGame(page);
  await loadSave(page, makeSave((s) => (s.coins = 700)));
  await page.getByTestId('open-looks').click();
  await expect(page.getByTestId('buy-look-elephant')).toBeDisabled();
  await page.getByTestId('buy-look-waves').click();
  await expect(page.getByTestId('look-waves')).toContainText('In use');
  expect(await coins(page)).toBe(700 - C.LOOK_COSTS.waves);
  await page.getByTestId('use-lotus').click();
  await expect(page.getByTestId('look-lotus')).toContainText('In use');
  await page.getByTestId('use-waves').click();
  await page.keyboard.press('Escape');
  await page.getByTestId('play-level').click();
  await expect(page.locator('.card--down .back').first()).toHaveClass(/back--waves/);
  await page.reload();
  await page.getByTestId('play-level').click();
  await expect(page.locator('.card--down .back').first()).toHaveClass(/back--waves/);
});

for (const layout of LAYOUT_IDS) {
  test(`the ${layout} table fits a small phone, with cards big enough to tap`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openGame(page);
    await playLevel(
      page,
      makeSave((s) => {
        const d = R.openDeal(s, 'level', TODAY);
        if (d) d.dealt = makeDeal({ layout, runs: 6, spare: 2 }, 7).dealt;
      }),
    );
    await expect(page.getByTestId('board')).toHaveAttribute('data-layout', layout);
    const cards = page.getByTestId('board').locator('.card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    const boxes = [];
    for (let i = 0; i < count; i++) boxes.push(await cards.nth(i).boundingBox());
    for (const id of ['stock', 'pile', 'tool-undo', 'tool-wild', 'tool-extraCards', 'go-home', 'coins']) boxes.push(await page.getByTestId(id).boundingBox());
    for (const box of boxes) {
      expect(box).not.toBeNull();
      if (!box) continue;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
      expect(box.y + box.height).toBeLessThanOrEqual(640);
    }
    expect((await cards.first().boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(30);
  });
}

test('the keyboard plays too: Enter or Space on a face-up card, and Escape goes home', async ({ page }) => {
  await openGame(page);
  await playLevel(page, makeSave(basic));
  await page.getByTestId('card-14').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('pile')).toHaveAttribute('data-card', String(SIX_OF_MANGO));
  await page.getByTestId('card-15').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('pile')).toHaveAccessibleName('Open card: 7 of fish');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('home')).toBeVisible();
});

test('the game speaks Thai', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('lang-th').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('level-name')).toHaveText('ด่าน 1');
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.getByTestId('canal-name')).toHaveText('ท่าน้ำเก่า');
  await page.getByTestId('play-level').click();
  await expect(page.getByTestId('teach')).toContainText('แตะไพ่');
  await page.getByTestId('go-home').click();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('open-privacy').click();
  await expect(page.getByTestId('privacy-modal')).toContainText('เราคือใคร');
});
