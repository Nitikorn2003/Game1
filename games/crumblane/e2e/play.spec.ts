import { expect, test, type Page } from '@playwright/test';
import * as C from '../src/sim/content.js';
import { LANE_LEVELS, ZONES } from '../src/sim/levels.js';
import { MORE_ROOM, TRAY, hidden, makeRoom, shut, takeable, tilesLeft, uncovered } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import type { GameState } from '../src/sim/state.js';
import {
  START,
  TODAY,
  YESTERDAY,
  coins,
  dealOrder,
  expectTable,
  jam,
  loadSave,
  openGame,
  player,
  rested,
  round,
  saveOf,
  takeTile,
  takeableTiles,
  toTheLast,
  watchTestAd,
} from './helpers.js';

/** The round in progress in `s`, which a test cannot do without. */
function roundOf(s: GameState) {
  const c = s.current;
  const level = R.currentLevel(s);
  if (!c || !level) throw new Error('No round in progress.');
  return { r: c.round, level };
}

/** A player at a level with a full tray: nothing on it boxes up, and room must be made. */
function stuckAt(n: number, coinsSaved = 0): GameState {
  const s = player(n - 1);
  s.coins = coinsSaved;
  R.startLevel(s, n);
  jam(s);
  return s;
}

/** Uses a tool on the screen, and the same tool in `s`. */
async function tapTool(page: Page, s: GameState, tool: C.Tool): Promise<R.ToolUse> {
  await page.getByTestId(`tool-${tool}`).click();
  const use = R.applyTool(s, tool);
  if (!use) throw new Error(`The ${tool} would do nothing.`);
  return use;
}

/** Clears a level the way its deal was made, from a save at its last tile, and waits for the results. */
async function clear(page: Page, s: GameState, button: 'play-next' | 'play-daily' = 'play-next'): Promise<R.Took> {
  const last = toTheLast(s);
  await loadSave(page, saveOf(s));
  await round(page, button);
  const took = await takeTile(page, s, last);
  if (!took.result) throw new Error('The last tile did not clear the counter.');
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  return took;
}

test('a pastry tapped goes onto the tray beside its kind, three of a kind box up, and one under another cannot be taken', async ({ page }) => {
  await openGame(page);
  const s = player(1);
  R.startLevel(s, 2);
  await loadSave(page, saveOf(s));
  await round(page);
  const { r, level } = roundOf(s);
  await expectTable(page, s);

  // A tile under another stays where it is.
  const free = uncovered(r, level);
  const covered = r.at.findIndex((at, i) => at === 'counter' && !(free[i] ?? false));
  expect(covered).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId(`tile-${String(covered)}`)).toHaveAttribute('data-free', 'false');
  await page.getByTestId(`tile-${String(covered)}`).dispatchEvent('click');
  await expect(page.getByTestId(`tile-${String(covered)}`)).toHaveClass(/tile--nope/);
  await expectTable(page, s);

  // Along the deal, up to the first set boxed up, the tray on the screen is the tray of the rules.
  let sets = 0;
  for (const tile of dealOrder(s)) {
    const took = await takeTile(page, s, tile);
    await rested(page);
    await expectTable(page, s);
    if (took.take.set) {
      sets += 1;
      if (sets === 2) break;
    }
  }
  expect(r.sets).toBe(2);
  await expect(page.getByTestId('left')).toHaveAttribute('data-left', String(tilesLeft(r)));
  await expect(page.getByTestId('star-meter')).toHaveAttribute('data-stars', '3');
});

test('a level cleared shows its stars and pays for them, a test ad doubles that once, and the next level opens', async ({ page }) => {
  await openGame(page);
  const s = player(1);
  R.startLevel(s, 2);
  const { result } = await clear(page, s);
  expect(result?.stars).toBe(3);
  const pay = C.LEVEL_COINS + 3 * C.STAR_COINS;
  expect(result?.pay).toBe(pay);
  await expect(page.getByTestId('result-stars')).toHaveAttribute('data-stars', '3');
  await expect.poll(() => coins(page)).toBe(pay);

  await page.getByTestId('double').click();
  await watchTestAd(page);
  await expect.poll(() => coins(page)).toBe(pay * 2);
  await expect(page.getByTestId('double')).toBeHidden();

  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '3');
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('level-2')).toHaveAttribute('data-stars', '3');
});

test('the stars above the counter fall as the tray fills: three up to four pastries, two at five, and a whisk clears the rest', async ({ page }) => {
  await openGame(page);
  const s = player(9);
  s.tools.whisk = 20;
  R.startLevel(s, 10);
  jam(s, 4);
  await loadSave(page, saveOf(s));
  await round(page);
  await expect(page.getByTestId('star-meter')).toHaveAttribute('data-stars', '3');
  const { r } = roundOf(s);
  const onTray = (kind: number) => r.tray.filter((t) => r.kinds[t] === kind).length;
  const fifth = takeableTiles(s).find((t) => r.at[t] === 'counter' && onTray(r.kinds[t] ?? -1) < 2);
  if (fifth === undefined) throw new Error('No fifth pastry that boxes nothing up.');
  await takeTile(page, s, fifth);
  await rested(page);
  await expect(page.getByTestId('star-meter')).toHaveAttribute('data-stars', '2');

  // The whisk takes no place on the tray, so the stars stay at two.
  for (let i = 0; i < 20; i++) {
    const use = await tapTool(page, s, 'whisk');
    if (use.result) break;
    await rested(page);
  }
  expect(s.result?.stars).toBe(2);
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('result-stars')).toHaveAttribute('data-stars', '2');
  await expect(page.getByTestId('results')).toContainText('The tray held 5 at most');
});

test('a full tray stops the round: room for a test ad or for sugar sends three pastries up to the rack, and one there can be taken back', async ({ page }) => {
  await openGame(page);
  let s = stuckAt(10);
  await loadSave(page, saveOf(s));
  await round(page);
  await expect(page.getByTestId('tray')).toHaveAttribute('data-count', String(TRAY));
  await expect(page.getByTestId('stuck-note')).toContainText('The tray is full');
  // Nothing more goes on a full tray.
  const another = takeableTiles(s).find((t) => s.current?.round.at[t] === 'counter');
  await page.getByTestId(`tile-${String(another)}`).click();
  await expectTable(page, s);

  await page.getByTestId('stuck-open').click();
  await page.getByTestId('stuck-watch').click();
  await watchTestAd(page);
  expect(R.grantAdReward(s, 'more_room', START.getTime(), TODAY, 0)).toBe(true);
  await expect(page.getByTestId('stuck')).toBeHidden();
  await rested(page);
  await expectTable(page, s);
  await expect(page.getByTestId('rack')).toHaveAttribute('data-count', String(MORE_ROOM));
  await expect(page.getByTestId('stuck-note')).toBeHidden();

  const back = roundOf(s).r.rack[0] ?? -1;
  await expect(page.getByTestId(`tile-${String(back)}`)).toHaveAttribute('data-free', 'true');
  await takeTile(page, s, back);
  await rested(page);
  await expectTable(page, s);

  // For sugar.
  await page.getByTestId('go-home').click();
  s = stuckAt(10, 250);
  await loadSave(page, saveOf(s));
  await round(page);
  await page.getByTestId('stuck-open').click();
  await page.getByTestId('stuck-spend').click();
  expect(R.buyRoom(s)).toBe(true);
  await expect(page.getByTestId('stuck')).toBeHidden();
  await rested(page);
  await expectTable(page, s);
  expect(await coins(page)).toBe(250 - C.MORE_ROOM_COST);

  // Or the round ends, and the next try is dealt anew.
  await page.getByTestId('go-home').click();
  s = stuckAt(10);
  await loadSave(page, saveOf(s));
  await round(page);
  // Closing the sheet keeps the round; the note under the counter opens it again.
  await page.getByTestId('stuck-open').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stuck-note')).toBeVisible();
  await page.getByTestId('stuck-open').click();
  await page.getByTestId('stuck-end').click();
  await expect(page.getByTestId('result-lost')).toBeVisible();
  await page.getByTestId('result-again').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '10');
  await expect(page.getByTestId('tray')).toHaveAttribute('data-count', '0');
  await expect(page.getByTestId('rack')).toHaveAttribute('data-count', '0');
});

test('a full rack leaves the tools: the spatula and the whisk free a place on a full tray', async ({ page }) => {
  await openGame(page);
  /** Room made twice, and the tray filled up again each time: the rack has no room for three more. */
  const fullRack = () => {
    const s = stuckAt(13);
    const { r } = roundOf(s);
    makeRoom(r);
    jam(s);
    makeRoom(r);
    jam(s);
    return s;
  };
  for (const tool of ['spatula', 'whisk'] as const) {
    const s = fullRack();
    expect(R.canMakeRoom(s)).toBe(false);
    await loadSave(page, saveOf(s));
    await round(page);
    await page.getByTestId('stuck-open').click();
    await expect(page.getByTestId('stuck')).toContainText('The cooling rack is full too');
    await expect(page.getByTestId('stuck-watch')).toBeHidden();
    await page.getByTestId(`stuck-${tool}`).click();
    expect(R.applyTool(s, tool)).not.toBeNull();
    await expect(page.getByTestId('stuck')).toBeHidden();
    await rested(page);
    await expectTable(page, s);
    await expect(page.getByTestId(`tool-${tool}-count`)).toHaveText(String(C.START_TOOLS[tool] - 1));
    await expect(page.getByTestId('stuck-note')).toBeHidden();
    await page.getByTestId('go-home').click();
  }
});

test('tools take no place on the tray: the spatula puts the last pastry back, the whisk boxes up a set, and the rolling pin rolls the counter anew', async ({ page }) => {
  await openGame(page);
  const s = player(12);
  R.startLevel(s, 13);
  await loadSave(page, saveOf(s));
  await round(page);
  const order = dealOrder(s);
  for (const tile of order.slice(0, 2)) {
    await takeTile(page, s, tile);
    await rested(page);
  }
  const use = await tapTool(page, s, 'spatula');
  expect(use.undo?.tile).toBe(order[1]);
  await rested(page);
  await expectTable(page, s);
  await expect(page.getByTestId('tool-spatula-count')).toHaveText(String(C.START_TOOLS.spatula - 1));

  const whisk = await tapTool(page, s, 'whisk');
  expect(whisk.whisk?.set).toHaveLength(3);
  expect(whisk.whisk?.set).toContain(order[0]);
  await rested(page);
  await expectTable(page, s);
  await expect(page.getByTestId('tool-whisk-count')).toHaveText(String(C.START_TOOLS.whisk - 1));

  const { r } = roundOf(s);
  const before = [...r.kinds];
  await tapTool(page, s, 'rollingpin');
  expect(r.kinds).not.toEqual(before);
  await rested(page);
  await expectTable(page, s);
  await expect(page.getByTestId('tool-rollingpin-count')).toHaveText('+');
});

test('an empty apron offers a tool for a test ad or for sugar', async ({ page }) => {
  await openGame(page);
  const s = player(4);
  s.coins = 300;
  s.tools = { spatula: 0, rollingpin: 0, whisk: 0 };
  R.startLevel(s, 5);
  await loadSave(page, saveOf(s));
  await round(page);
  await expect(page.getByTestId('tool-whisk-count')).toHaveText('+');
  await page.getByTestId('tool-whisk').click();
  await expect(page.getByTestId('tool-sheet')).toContainText('The whisk boxes up a set of three at once');
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(page.getByTestId('tool-whisk-count')).toHaveText('1');
  // The tool goes into the apron, to be used with a tap of its own.
  await expect(page.getByTestId('tray')).toHaveAttribute('data-count', '0');

  await page.getByTestId('tool-rollingpin').click();
  await page.getByTestId('tool-spend').click();
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(page.getByTestId('tool-rollingpin-count')).toHaveText('1');
  expect(await coins(page)).toBe(300 - C.TOOL_COSTS.rollingpin);
});

test('a paper bag hides its pastry while anything covers it', async ({ page }) => {
  await openGame(page);
  const s = player(C.TIP_LEVELS.bag - 1);
  R.startLevel(s, C.TIP_LEVELS.bag);
  await loadSave(page, saveOf(s));
  await round(page);
  const { r, level } = roundOf(s);
  const bag = level.bags.findIndex((b, i) => b && hidden(r, level, i, uncovered(r, level)));
  expect(bag).toBeGreaterThanOrEqual(0);
  const tile = page.getByTestId(`tile-${String(bag)}`);
  await expect(tile).toHaveAttribute('data-kind', 'hidden');
  await expect(tile).toHaveAccessibleName('A paper bag: uncover it to see what is inside');
  for (const next of dealOrder(s)) {
    if (!hidden(r, level, bag, uncovered(r, level))) break;
    await takeTile(page, s, next);
    await rested(page);
  }
  await expect(tile).toHaveAttribute('data-kind', String(r.kinds[bag]));
  await expectTable(page, s);
});

test('a ribbon box opens once enough sets are boxed up, counting down on its ribbon', async ({ page }) => {
  await openGame(page);
  const s = player(C.TIP_LEVELS.box - 1);
  R.startLevel(s, C.TIP_LEVELS.box);
  await loadSave(page, saveOf(s));
  await round(page);
  const { r, level } = roundOf(s);
  const boxed = level.locks.findIndex((n) => n > 0);
  const lock = level.locks[boxed] ?? 0;
  expect(lock).toBeGreaterThan(1);
  const tile = page.getByTestId(`tile-${String(boxed)}`);
  await expect(tile).toHaveAttribute('data-box', String(lock));
  await expect(tile).toHaveAttribute('data-free', 'false');
  // A box shows how many sets it still waits for, unless nothing else is left to take and it opens early.
  const onCounter = () => r.at[boxed] === 'counter';
  const shown = () => (shut(r, level, boxed) && !(takeable(r, level)[boxed] ?? false) ? String(lock - r.sets) : null);
  for (const next of dealOrder(s)) {
    if (r.sets >= lock) break;
    await takeTile(page, s, next);
    await rested(page);
    if (!onCounter()) break;
    const want = shown();
    if (want) await expect(tile).toHaveAttribute('data-box', want);
    else await expect(tile).not.toHaveAttribute('data-box');
  }
  if (onCounter()) {
    expect(r.sets).toBeGreaterThanOrEqual(lock);
    await expect(tile).not.toHaveAttribute('data-box');
  }
  await expectTable(page, s);
});

test('sprinkled pastries pay a little sugar each when they are boxed up', async ({ page }) => {
  await openGame(page);
  const s = player(C.TIP_LEVELS.sprinkles - 1);
  R.startLevel(s, C.TIP_LEVELS.sprinkles);
  const sprinkled = R.currentLevel(s)?.sprinkles.filter(Boolean).length ?? 0;
  expect(sprinkled).toBeGreaterThan(0);
  const { result } = await clear(page, s);
  expect(result?.sprinkles).toBe(sprinkled * C.SPRINKLE_COINS);
  await expect(page.getByTestId('result-sprinkles')).toContainText(`Sprinkles: ${String(sprinkled)}`);
  await expect.poll(() => coins(page)).toBe((result?.pay ?? 0) + (result?.zoneCoins ?? 0));
});

test('the daily special pays once a day, more for the streak, and shows as cleared at home', async ({ page }) => {
  await openGame(page);
  const s = player(20);
  s.daily = { day: YESTERDAY, tries: 1, lastDone: YESTERDAY, streak: 2, bestStreak: 2 };
  R.openDaily(s, TODAY);
  const last = toTheLast(s);
  await loadSave(page, saveOf(s));
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 2');
  await round(page, 'play-daily');
  await expect(page.getByTestId('play')).toHaveAttribute('data-mode', 'daily');
  await expectTable(page, s);
  const took = await takeTile(page, s, last);
  expect(took.result?.pay).toBe(C.DAILY_COINS + 2 * C.STREAK_COINS + (took.result?.sprinkles ?? 0));
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('results')).toContainText('Daily special cleared!');
  await expect(page.getByTestId('result-streak')).toHaveText('Daily streak: 3');
  await expect.poll(() => coins(page)).toBe(took.result?.pay ?? -1);
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('daily-status')).toHaveText('Cleared for today. A new daily special comes tomorrow.');
  await expect(page.getByTestId('play-daily')).toBeHidden();
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 3');
});

test('a round keeps its place: home and back, and after a reload', async ({ page }) => {
  await openGame(page);
  const s = player(2);
  R.startLevel(s, 3);
  for (const tile of dealOrder(s).slice(0, 5)) R.take(s, tile);
  await loadSave(page, saveOf(s));
  await expect(page.getByTestId('next-title')).toHaveText('Back to level 3');
  await round(page);
  await expectTable(page, s);
  await page.getByTestId('go-home').click();
  await page.reload();
  // A round in progress opens on its counter.
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '3');
  await expectTable(page, s);
});

test('the last level of a shop opens it on the lane, with sugar and a tool of each kind', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('lane-bread')).toHaveAttribute('data-open', 'false');
  const s = player(11);
  const tools = { ...s.tools };
  R.startLevel(s, 12);
  const { result } = await clear(page, s);
  await expect(page.getByTestId('result-zone')).toContainText('Bread Corner is open!');
  await expect.poll(() => coins(page)).toBe((result?.pay ?? 0) + C.ZONE_COINS);
  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '13');
  for (const tool of C.TOOLS) await expect(page.getByTestId(`tool-${tool}-count`)).toHaveText(String(tools[tool] + 1));
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('lane-bread')).toHaveAttribute('data-open', 'true');
  await expect(page.getByTestId('zone-bread')).toContainText('Open on the lane');
  await expect(page.getByTestId('lane')).toContainText(`1 of ${String(ZONES.length)} shops open`);
});

test('ad breaks wait for three levels cleared and a few minutes of play, and come once the results close', async ({ page }) => {
  await openGame(page);
  const first = player(1);
  R.startLevel(first, 2);
  const last = toTheLast(first);
  await loadSave(page, saveOf(first));
  // As if the phone had been put down a while: timers due in the meantime fire once.
  await page.clock.fastForward(6 * 60_000);
  await round(page);
  await takeTile(page, first, last);
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('result-next').click();
  // Two levels cleared: too early for one.
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '3');
  await page.clock.runFor(1_000);
  await expect(page.getByTestId('test-interstitial')).toBeHidden();

  await page.getByTestId('go-home').click();
  const second = player(C.AD_BREAKS_AFTER_WINS - 1);
  R.startLevel(second, C.AD_BREAKS_AFTER_WINS);
  await clear(page, second);
  // Not while the counter is cleared and the results show: only once they close.
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('test-interstitial')).toContainText('Ad break');
  await page.getByTestId('test-ad-close').click();
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a test purchase shows that no money is charged and delivers once; the Baker’s Kit brings its tools and its tiles', async ({ page }) => {
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
  await page.getByTestId('buy-baker_kit').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect(page.getByTestId('offer-baker_kit')).toContainText('Owned');
  await expect.poll(() => coins(page)).toBe(1500);
  await expect(page.getByTestId('pocket')).toContainText(`Spatula: ${String(C.START_TOOLS.spatula + 5)}`);
  await expect(page.getByTestId('pocket')).toContainText(`Rolling pin: ${String(C.START_TOOLS.rollingpin + 5)}`);
  await expect(page.getByTestId('pocket')).toContainText(`Whisk: ${String(C.START_TOOLS.whisk + 5)}`);
  await page.keyboard.press('Escape');
  await page.getByTestId('open-looks').click();
  await page.getByTestId(`use-${C.BAKER_KIT_TILES}`).click();
  await expect(page.getByTestId(`look-${C.BAKER_KIT_TILES}`)).toContainText('In use');
  await expect(page.locator('.app')).toHaveAttribute('data-tiles', C.BAKER_KIT_TILES);
  expect(await coins(page)).toBe(1500);
});

test('free sugar from a test ad, with the daily limit shown', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('coins').click();
  const offer = page.getByTestId('offer-free');
  await expect(offer).toContainText(`${String(R.AD_LIMITS.perPlacement.free_coins)} left today`);
  // Closing the ad early gives nothing.
  await page.getByTestId('watch-free').click();
  await page.getByTestId('test-ad-close').click();
  await page.clock.runFor(500);
  expect(await coins(page)).toBe(0);
  await page.getByTestId('watch-free').click();
  await watchTestAd(page);
  await expect.poll(() => coins(page)).toBe(C.FREE_COINS);
  await expect(offer).toContainText(`${String(R.AD_LIMITS.perPlacement.free_coins - 1)} left today`);
});

test('No Ad Breaks: what a video would give comes without one', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-shop').click();
  await page.getByTestId('buy-remove_ads').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect(page.getByTestId('offer-remove_ads')).toContainText('Owned');
  await expect(page.getByTestId('watch-free')).toHaveText('Claim');
  await page.getByTestId('watch-free').click();
  await expect.poll(() => coins(page)).toBe(C.FREE_COINS);
  await expect(page.getByTestId('test-ad')).toBeHidden();
  await page.keyboard.press('Escape');

  const s = stuckAt(10);
  s.shop.entitlements = ['remove_ads'];
  await loadSave(page, saveOf(s));
  await round(page);
  await page.getByTestId('stuck-open').click();
  await expect(page.getByTestId('stuck-watch')).toHaveText('Make room free');
  await page.getByTestId('stuck-watch').click();
  await expect(page.getByTestId('stuck')).toBeHidden();
  await expect(page.getByTestId('rack')).toHaveAttribute('data-count', String(MORE_ROOM));
  await expect(page.getByTestId('test-ad')).toBeHidden();
});

test('looks bought with sugar are used at once, and stay after a reload', async ({ page }) => {
  await openGame(page);
  const s = player(3);
  s.coins = 1500;
  await loadSave(page, saveOf(s));
  await page.getByTestId('open-looks').click();
  await page.getByTestId('buy-look-willow').click();
  await expect(page.getByTestId('look-willow')).toContainText('In use');
  expect(await coins(page)).toBe(1500 - C.LOOK_COSTS.willow);
  await expect(page.getByTestId('buy-look-mint')).toBeDisabled();
  const app = page.locator('.app');
  await expect(app).toHaveAttribute('data-tiles', 'willow');
  await page.getByTestId('buy-look-rain').click();
  await expect(app).toHaveAttribute('data-season', 'rain');
  await page.getByTestId('use-cream').click();
  await expect(app).toHaveAttribute('data-tiles', 'cream');
  await page.getByTestId('use-willow').click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(app).toHaveAttribute('data-tiles', 'willow');
  await expect(app).toHaveAttribute('data-season', 'rain');
  await page.getByTestId('play-next').click();
  await expect(app).toHaveAttribute('data-tiles', 'willow');
  await expect(page.locator('.backdrop--rain')).toBeVisible();
});

/** A first level with its note, the biggest counter of the lane, and the daily special: each fits a small phone. */
const FITS = [
  ['a first level, with its note', 1, false],
  ['the biggest counter', LANE_LEVELS, true],
  ['the daily special', 0, true],
] as const;

for (const [what, n, seen] of FITS) {
  test(`the counter for ${what} fits a small phone, with tiles big enough to tap`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openGame(page);
    const s = player(Math.max(n - 1, 0));
    if (!seen) s.tips = [];
    if (n > 0) R.startLevel(s, n);
    else R.openDaily(s, TODAY);
    await loadSave(page, saveOf(s));
    await round(page, n > 0 ? 'play-next' : 'play-daily');
    const ids = ['table', 'go-home', 'coins', 'left', 'star-meter', 'rack', 'tray', 'tool-spatula', 'tool-rollingpin', 'tool-whisk', ...(seen ? [] : ['tip'])];
    for (const id of ids) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      if (!box) continue;
      expect(box.x, id).toBeGreaterThanOrEqual(0);
      expect(box.y, id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, id).toBeLessThanOrEqual(360);
      expect(box.y + box.height, id).toBeLessThanOrEqual(640);
    }
    // Every tile on the counter is inside the table, and the counter stays clear of the rack.
    const table = await page.getByTestId('table').boundingBox();
    const rack = await page.getByTestId('rack').boundingBox();
    const counter = await page.locator('.counter').boundingBox();
    expect((counter?.y ?? 0) + (counter?.height ?? 0)).toBeLessThanOrEqual(rack?.y ?? 0);
    const boxes = await page.locator('.tile--counter').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(table?.x ?? 0);
      expect(b.right).toBeLessThanOrEqual((table?.x ?? 0) + (table?.width ?? 0));
      expect(b.bottom).toBeLessThanOrEqual(rack?.y ?? 0);
      expect(b.width).toBeGreaterThanOrEqual(24);
    }
  });
}

test('the keyboard plays too: a pastry takes with Enter, and Escape goes home', async ({ page }) => {
  await openGame(page);
  const s = player(0);
  R.startLevel(s, 1);
  await loadSave(page, saveOf(s));
  await round(page);
  const [first] = dealOrder(s);
  await page.getByTestId(`tile-${String(first)}`).focus();
  await page.keyboard.press('Enter');
  R.take(s, first ?? -1);
  await rested(page);
  await expectTable(page, s);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a pastry to take shows after a while without one', async ({ page }) => {
  await openGame(page);
  const s = player(4);
  R.startLevel(s, 5);
  const hint = R.hintTile(s);
  await loadSave(page, saveOf(s));
  await round(page);
  await expect(page.locator('.tile--hint')).toHaveCount(0);
  await page.clock.runFor(9_500);
  await expect(page.locator('.tile--hint')).toHaveCount(1);
  await expect(page.getByTestId(`tile-${String(hint)}`)).toHaveClass(/tile--hint/);
  await expect(page.getByTestId(`tile-${String(hint)}`)).toHaveAttribute('data-free', 'true');
});

test('home shows the next level, the daily special, the lane and its shops, and after the lane the late shift', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('next-title')).toHaveText('Level 1');
  await expect(page.getByTestId('next-where')).toHaveText('Bread Corner');
  await expect(page.getByTestId('daily-status')).toContainText(`Clear it for ${String(C.DAILY_COINS)} sugar`);
  await expect(page.getByTestId('lane')).toContainText(`0 of ${String(ZONES.length)} shops open`);
  await page.getByTestId('zone-open-cafe').click();
  await expect(page.getByTestId('zone-progress')).toHaveText('This shop opens at level 13.');
  await page.keyboard.press('Escape');
  await page.getByTestId('open-rules').click();
  await expect(page.getByTestId('rules')).toContainText('Three of a kind on the tray are boxed up');
  await page.keyboard.press('Escape');

  await loadSave(page, saveOf(player(LANE_LEVELS)));
  await expect(page.getByTestId('total-stars')).toContainText(`${String(LANE_LEVELS * 3)}/${String(LANE_LEVELS * 3)}`);
  await expect(page.getByTestId('lane')).toContainText(`${String(ZONES.length)} of ${String(ZONES.length)} shops open`);
  for (const zone of ZONES) await expect(page.getByTestId(`lane-${zone}`)).toHaveAttribute('data-open', 'true');
  await expect(page.getByTestId('next-title')).toHaveText(`Level ${String(LANE_LEVELS + 1)}`);
  await expect(page.getByTestId('next-where')).toHaveText('The late shift');
  await expect(page.getByTestId('late-note')).toContainText('the lane’s counters again');
  await round(page);
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', String(LANE_LEVELS + 1));
  await expect(page.getByTestId('play')).toContainText('The late shift');
});

test('a note on what is new shows at the first level that has it, until it is read', async ({ page }) => {
  await openGame(page);
  await round(page);
  await expect(page.getByTestId('tip')).toHaveAttribute('data-tip', 'tap');
  await page.getByTestId('tip-ok').click();
  await expect(page.getByTestId('tip')).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page.getByTestId('tip')).toBeHidden();
});

test('the game speaks Thai, in a Thai typeface', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('lang-th').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.getByTestId('play-next')).toHaveText('อบเลย');
  await expect(page.getByTestId('next-where')).toHaveText('มุมขนมปัง');
  const typeface = await page.getByTestId('next-where').evaluate(async (el) => {
    await document.fonts.ready;
    return { family: getComputedStyle(el).fontFamily, loaded: document.fonts.check('400 16px Niramit', 'มุมขนมปัง') };
  });
  expect(typeface.family).toContain('Niramit');
  expect(typeface.loaded).toBe(true);
  await round(page);
  await expect(page.getByTestId('tool-spatula')).toContainText('ตะหลิว');
  await expect(page.getByTestId('tip')).toContainText('แตะขนมเพื่อวางบนถาด');
  await page.getByTestId('go-home').click();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('open-privacy').click();
  await expect(page.getByTestId('privacy-modal')).toContainText('เราคือใคร');
});

test('a cleared level can be played again for the stars it lacks, from its shop', async ({ page }) => {
  await openGame(page);
  const s = player(6);
  s.stars[3] = 1;
  await loadSave(page, saveOf(s));
  await expect(page.getByTestId('level-4')).toHaveAttribute('data-stars', '1');
  await page.getByTestId('zone-open-bread').click();
  await page.getByTestId('zone').getByTestId('level-4').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '4');
  // Levels after the next one to clear stay closed.
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('level-7')).toBeEnabled();
  await expect(page.getByTestId('level-8')).toBeDisabled();
});
