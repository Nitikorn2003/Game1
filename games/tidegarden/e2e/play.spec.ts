import { expect, test, type Page } from '@playwright/test';
import { TURTLE, type Move } from '../src/sim/board.js';
import * as C from '../src/sim/content.js';
import { MORE_MOVES, goalsLeft } from '../src/sim/dive.js';
import { REEF_LEVELS, levelAt } from '../src/sim/levels.js';
import * as R from '../src/sim/rules.js';
import {
  TODAY,
  YESTERDAY,
  coins,
  dive,
  loadSave,
  noSwap,
  openGame,
  piece,
  player,
  rested,
  runOut,
  saveOf,
  swipe,
  tapCell,
  watchTestAd,
  winnable,
} from './helpers.js';

const movesLeft = (page: Page) => page.getByTestId('moves').locator('.moves__n');

test('a swap that matches takes a move and counts towards the goals; one that does not goes back and takes none', async ({ page }) => {
  await openGame(page);
  const s = player(0);
  R.startLevel(s, 1);
  const level = levelAt(1);
  const nope = noSwap(s);
  const move = R.hintMove(s);
  if (!move) throw new Error('No move on the first board.');
  const after = structuredClone(s);
  R.swap(after, move.from, move.to);
  await loadSave(page, saveOf(s));
  await dive(page);
  await expect(movesLeft(page)).toHaveText(String(level.moves));

  await swipe(page, nope);
  await rested(page);
  await expect(movesLeft(page)).toHaveText(String(level.moves));

  // Tapped one and then the other, two pieces swap too.
  await tapCell(page, move.from);
  await expect(piece(page, move.from)).toHaveClass(/pc--picked/);
  await tapCell(page, move.to);
  await expect(movesLeft(page)).toHaveText(String(level.moves - 1));
  await rested(page);
  const left = after.current ? goalsLeft(after.current.dive, level) : [];
  await expect(page.getByTestId('goal-0')).toHaveAttribute('data-left', String(left[0]));
});

test('a level reached shows its stars and pays for them, a test ad doubles that once, and the next level opens', async ({ page }) => {
  await openGame(page);
  const s = player(1);
  const last = winnable(s, () => R.startLevel(s, 2));
  await loadSave(page, saveOf(s));
  await dive(page);
  await swipe(page, last.move);
  await expect(page.getByTestId('reached')).toBeVisible();
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('result-stars')).toHaveAttribute('data-stars', String(last.stars));
  expect(last.pay).toBe(C.LEVEL_COINS + C.STAR_COINS * last.stars);
  await expect.poll(() => coins(page)).toBe(last.pay);

  await page.getByTestId('double').click();
  await watchTestAd(page);
  await expect.poll(() => coins(page)).toBe(last.pay * 2);
  await expect(page.getByTestId('double')).toBeHidden();

  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '3');
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('level-2')).toHaveAttribute('data-stars', String(last.stars));
});

test('out of moves: five more for a test ad or for sand dollars, or the dive ends and starts again on a new board', async ({ page }) => {
  await openGame(page);
  const stuck = () => {
    const s = player(4);
    s.coins = 250;
    R.startLevel(s, 5);
    runOut(s);
    return s;
  };
  await loadSave(page, saveOf(stuck()));
  await dive(page);
  await expect(movesLeft(page)).toHaveText('0');
  await page.getByTestId('out-of-moves-open').click();
  await page.getByTestId('stuck-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('stuck')).toBeHidden();
  await expect(movesLeft(page)).toHaveText(String(MORE_MOVES));

  await page.getByTestId('go-home').click();
  await loadSave(page, saveOf(stuck()));
  await dive(page);
  await page.getByTestId('out-of-moves-open').click();
  await page.getByTestId('stuck-spend').click();
  await expect(page.getByTestId('stuck')).toBeHidden();
  await expect(movesLeft(page)).toHaveText(String(MORE_MOVES));
  expect(await coins(page)).toBe(250 - C.MORE_MOVES_COST);

  await page.getByTestId('go-home').click();
  await loadSave(page, saveOf(stuck()));
  await dive(page);
  // Closing the sheet keeps the dive; the note under the board opens it again.
  await page.getByTestId('out-of-moves-open').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('out-of-moves')).toBeVisible();
  await page.getByTestId('out-of-moves-open').click();
  await page.getByTestId('stuck-end').click();
  await expect(page.getByTestId('result-lost')).toBeVisible();
  await page.getByTestId('result-again').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '5');
  await expect(movesLeft(page)).toHaveText(String(levelAt(5).moves));
});

test('tools take no move: the claw picks off kelp, the tide washes a row clear, and the crab swaps any two neighbours', async ({ page }) => {
  await openGame(page);
  const s = player(24);
  R.startLevel(s, 25);
  const level = levelAt(25);
  const board = s.current?.dive.board;
  const kelp = board?.kelp.findIndex((k) => k > 0) ?? -1;
  expect(kelp).toBeGreaterThanOrEqual(0);
  await loadSave(page, saveOf(s));
  await dive(page);

  await page.getByTestId('tool-claw').click();
  await expect(page.getByTestId('tool-note')).toBeVisible();
  await tapCell(page, kelp);
  await rested(page);
  await expect(page.getByTestId(`kelp-${String(kelp)}`)).toBeHidden();
  await expect(page.getByTestId('tool-claw-count')).toHaveText(String(C.START_TOOLS.claw - 1));
  await expect(page.getByTestId('tool-note')).toBeHidden();

  await page.getByTestId('tool-tide').click();
  await tapCell(page, 3);
  await rested(page);
  await expect(page.getByTestId('tool-tide-count')).toHaveText(C.START_TOOLS.tide > 1 ? String(C.START_TOOLS.tide - 1) : '+');

  // The same tools on the game's own rules give the board the screen now shows.
  R.playTool(s, { tool: 'claw', cell: kelp });
  R.playTool(s, { tool: 'tide', row: 0 });
  const free = noSwap(s);
  const kinds = [s.current?.dive.board.pieces[free.from]?.kind, s.current?.dive.board.pieces[free.to]?.kind];
  await page.getByTestId('tool-crab').click();
  await swipe(page, free);
  await rested(page);
  await expect(page.getByTestId('tool-crab-count')).toHaveText(String(C.START_TOOLS.crab - 1));
  await expect(piece(page, free.from)).toHaveAttribute('data-kind', String(kinds[1]));
  await expect(piece(page, free.to)).toHaveAttribute('data-kind', String(kinds[0]));
  await expect(movesLeft(page)).toHaveText(String(level.moves));
});

test('an empty bag offers a tool for a test ad or for sand dollars', async ({ page }) => {
  await openGame(page);
  const s = player(12);
  s.coins = 300;
  s.tools = { claw: 0, tide: 0, crab: 0 };
  R.startLevel(s, 13);
  await loadSave(page, saveOf(s));
  await dive(page);
  await expect(page.getByTestId('tool-tide-count')).toHaveText('+');
  await page.getByTestId('tool-tide').click();
  await expect(page.getByTestId('tool-sheet')).toBeVisible();
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(page.getByTestId('tool-tide-count')).toHaveText('1');

  await page.getByTestId('tool-claw').click();
  await page.getByTestId('tool-spend').click();
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(page.getByTestId('tool-claw-count')).toHaveText('1');
  expect(await coins(page)).toBe(300 - C.TOOL_COSTS.claw);
});

test('a baby turtle crawls down when swiped down, match or not, and one that reaches the bottom is home in the sea', async ({ page }) => {
  await openGame(page);
  const s = player(48);
  R.startLevel(s, 49);
  const level = levelAt(49);
  const goal = level.goals.findIndex((g) => g.kind === 'turtle');
  const turtleAt = (state: typeof s) => state.current?.dive.board.pieces.findIndex((p) => p?.kind === TURTLE) ?? -1;
  const from = turtleAt(s);
  const width = s.current?.dive.board.width ?? 0;
  const crawl: Move = { from, to: from + width };
  const after = structuredClone(s);
  expect(R.swap(after, crawl.from, crawl.to)).not.toBeNull();
  await loadSave(page, saveOf(s));
  await dive(page);
  await swipe(page, crawl);
  await rested(page);
  await expect(movesLeft(page)).toHaveText(String(level.moves - 1));
  await expect(page.locator(`.pc[data-kind="${String(TURTLE)}"]`)).toHaveAttribute('data-cell', String(turtleAt(after)));

  // Hint moves until the next one brings a turtle to the bottom.
  const t = structuredClone(after);
  let home: Move | null = null;
  for (let i = 0; i < 80 && !home; i++) {
    const move = R.hintMove(t);
    if (!move) break;
    const ahead = structuredClone(t);
    const moved = R.swap(ahead, move.from, move.to);
    if ((ahead.current?.dive.turtles.saved ?? 0) > (t.current?.dive.turtles.saved ?? 0) && !moved?.result) home = move;
    else {
      R.swap(t, move.from, move.to);
      if (t.current && t.current.dive.movesLeft < 3) t.current.dive.movesLeft = 3;
    }
  }
  if (!home || !t.current) throw new Error('No turtle came home.');
  const before = goalsLeft(t.current.dive, level)[goal] ?? 0;
  await page.getByTestId('go-home').click();
  await loadSave(page, saveOf(t));
  await dive(page);
  await expect(page.getByTestId(`goal-${String(goal)}`)).toHaveAttribute('data-left', String(before));
  await swipe(page, home);
  await rested(page);
  await expect(page.getByTestId(`goal-${String(goal)}`)).toHaveAttribute('data-left', String(before - 1));
});

test('the daily dive pays once a day, more for the streak, and shows as reached at home', async ({ page }) => {
  await openGame(page);
  const s = player(20);
  s.daily = { day: YESTERDAY, tries: 1, lastDone: YESTERDAY, streak: 2, bestStreak: 2 };
  const last = winnable(s, () => R.openDaily(s, TODAY));
  expect(last.pay).toBe(C.DAILY_COINS + 2 * C.STREAK_COINS);
  await loadSave(page, saveOf(s));
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 2');
  await dive(page, 'play-daily');
  await expect(page.getByTestId('play')).toHaveAttribute('data-mode', 'daily');
  await expect(movesLeft(page)).toHaveText(String(s.current?.dive.movesLeft));
  await swipe(page, last.move);
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('results')).toContainText('Daily dive reached!');
  await expect(page.getByTestId('result-streak')).toHaveText('Daily streak: 3');
  await expect.poll(() => coins(page)).toBe(last.pay);
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('daily-status')).toHaveText('Reached for today. A new daily dive comes tomorrow.');
  await expect(page.getByTestId('play-daily')).toBeHidden();
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 3');
});

test('a dive keeps its place: home and back, and after a reload', async ({ page }) => {
  await openGame(page);
  const s = player(2);
  R.startLevel(s, 3);
  for (let i = 0; i < 3; i++) {
    const move = R.hintMove(s);
    if (move) R.swap(s, move.from, move.to);
  }
  const left = s.current?.dive.movesLeft ?? 0;
  await loadSave(page, saveOf(s));
  await expect(page.getByTestId('next-title')).toHaveText('Back to level 3');
  await dive(page);
  await expect(movesLeft(page)).toHaveText(String(left));
  await page.getByTestId('go-home').click();
  await page.reload();
  // A dive in progress opens on its board.
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '3');
  await expect(movesLeft(page)).toHaveText(String(left));
});

test('the last level of a zone brings its creature home, with sand dollars and a tool of each kind', async ({ page }) => {
  await openGame(page);
  const s = player(11);
  const last = winnable(s, () => R.startLevel(s, 12));
  const tools = { ...s.tools };
  await loadSave(page, saveOf(s));
  await dive(page);
  await swipe(page, last.move);
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('result-zone')).toContainText('The hermit crab has come home!');
  await expect.poll(() => coins(page)).toBe(last.pay + C.ZONE_COINS);
  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '13');
  for (const tool of C.TOOLS) await expect(page.getByTestId(`tool-${tool}-count`)).toHaveText(String(tools[tool] + 1));
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('zone-shallows')).toContainText('The hermit crab is home');
});

test('ad breaks wait for three levels reached and a few minutes of play, and come once the results close', async ({ page }) => {
  await openGame(page);
  const first = player(1);
  let last = winnable(first, () => R.startLevel(first, 2));
  await loadSave(page, saveOf(first));
  // As if the phone had been put down a while: timers due in the meantime fire once.
  await page.clock.fastForward(6 * 60_000);
  await dive(page);
  await swipe(page, last.move);
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('result-next').click();
  // Two levels reached: too early for one.
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '3');
  await page.clock.runFor(1_000);
  await expect(page.getByTestId('test-interstitial')).toBeHidden();

  await page.getByTestId('go-home').click();
  const second = player(C.AD_BREAKS_AFTER_WINS - 1);
  last = winnable(second, () => R.startLevel(second, C.AD_BREAKS_AFTER_WINS));
  await loadSave(page, saveOf(second));
  await dive(page);
  await swipe(page, last.move);
  // Not while the goals are reached and the results show: only once they close.
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('test-interstitial')).toContainText('Ad break');
  await page.getByTestId('test-ad-close').click();
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a test purchase shows that no money is charged and delivers once; the Diver’s Kit brings its tools and its buddy', async ({ page }) => {
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
  await page.getByTestId('buy-diver_kit').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect(page.getByTestId('offer-diver_kit')).toContainText('Owned');
  await expect.poll(() => coins(page)).toBe(1500);
  await expect(page.getByTestId('bag')).toContainText(`Claw: ${String(C.START_TOOLS.claw + 5)}`);
  await expect(page.getByTestId('bag')).toContainText(`Tide: ${String(C.START_TOOLS.tide + 5)}`);
  await expect(page.getByTestId('bag')).toContainText(`Hermit crab: ${String(C.START_TOOLS.crab + 5)}`);
  await page.keyboard.press('Escape');
  await page.getByTestId('open-looks').click();
  await page.getByTestId(`use-${C.DIVER_KIT_BUDDY}`).click();
  await expect(page.getByTestId(`look-${C.DIVER_KIT_BUDDY}`)).toContainText('In use');
  await expect(page.locator('.app')).toHaveAttribute('data-buddy', C.DIVER_KIT_BUDDY);
  expect(await coins(page)).toBe(1500);
});

test('free sand dollars from a test ad, with the daily limit shown', async ({ page }) => {
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

  const s = player(4);
  s.shop.entitlements = ['remove_ads'];
  R.startLevel(s, 5);
  runOut(s);
  await loadSave(page, saveOf(s));
  await dive(page);
  await page.getByTestId('out-of-moves-open').click();
  await expect(page.getByTestId('stuck-watch')).toHaveText(`Get ${String(MORE_MOVES)} moves free`);
  await page.getByTestId('stuck-watch').click();
  await expect(page.getByTestId('stuck')).toBeHidden();
  await expect(movesLeft(page)).toHaveText(String(MORE_MOVES));
  await expect(page.getByTestId('test-ad')).toBeHidden();
});

test('looks bought with sand dollars are used at once, and stay after a reload', async ({ page }) => {
  await openGame(page);
  const s = player(3);
  s.coins = 1500;
  await loadSave(page, saveOf(s));
  await page.getByTestId('open-looks').click();
  await page.getByTestId('buy-look-sunset').click();
  await expect(page.getByTestId('look-sunset')).toContainText('In use');
  expect(await coins(page)).toBe(1500 - C.LOOK_COSTS.sunset);
  await expect(page.getByTestId('buy-look-glow')).toBeDisabled();
  const app = page.locator('.app');
  await expect(app).toHaveAttribute('data-water', 'sunset');
  await page.getByTestId('buy-look-manta').click();
  await expect(app).toHaveAttribute('data-buddy', 'manta');
  await page.getByTestId('use-sunlit').click();
  await expect(app).toHaveAttribute('data-water', 'sunlit');
  await page.getByTestId('use-sunset').click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(app).toHaveAttribute('data-water', 'sunset');
  await expect(app).toHaveAttribute('data-buddy', 'manta');
  await page.getByTestId('play-next').click();
  await expect(app).toHaveAttribute('data-water', 'sunset');
  await expect(page.locator('.buddy--swim')).toBeVisible();
});

/** The first level of each size of board, and the daily dive: every board fits a small phone. */
const BOARDS = new Map<string, number>();
for (let n = 1; n <= REEF_LEVELS; n++) {
  const { width, height } = levelAt(n).layout;
  const size = `${String(width)}×${String(height)}`;
  if (!BOARDS.has(size)) BOARDS.set(size, n);
}

for (const [size, n] of [...BOARDS, ['daily', 0] as const]) {
  test(`a ${size} board fits a small phone, with cells big enough to tap`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openGame(page);
    const s = player(Math.max(n - 1, 0));
    if (n > 0) R.startLevel(s, n);
    else R.openDaily(s, TODAY);
    await loadSave(page, saveOf(s));
    await dive(page, n > 0 ? 'play-next' : 'play-daily');
    const ids = ['board', 'go-home', 'coins', 'moves', 'goal-0', 'tool-claw', 'tool-tide', 'tool-crab'];
    for (const id of ids) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      if (!box) continue;
      expect(box.x, id).toBeGreaterThanOrEqual(0);
      expect(box.y, id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, id).toBeLessThanOrEqual(360);
      expect(box.y + box.height, id).toBeLessThanOrEqual(640);
    }
    // The board stays clear of the tools below it.
    const board = await page.getByTestId('board').boundingBox();
    const dock = await page.locator('.dock').boundingBox();
    expect((board?.y ?? 0) + (board?.height ?? 0)).toBeLessThanOrEqual(dock?.y ?? 0);
    const first = s.current?.dive.board.open.findIndex((open) => open) ?? 0;
    expect((await page.getByTestId(`cell-${String(first)}`).boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(30);
  });
}

test('the keyboard plays too: the arrow keys move, Enter picks a piece and an arrow swaps it, Escape lets go and then goes home', async ({ page }) => {
  await openGame(page);
  const s = player(0);
  R.startLevel(s, 1);
  const move = R.hintMove(s);
  if (!move) throw new Error('No move on the first board.');
  const width = s.current?.dive.board.width ?? 0;
  await loadSave(page, saveOf(s));
  await dive(page);
  await page.getByTestId('board').focus();
  // The first arrow shows the cursor on the first cell; the next ones move it.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.cursor')).toBeVisible();
  for (let x = 0; x < move.from % width; x++) await page.keyboard.press('ArrowRight');
  for (let y = 0; y < Math.floor(move.from / width); y++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(piece(page, move.from)).toHaveClass(/pc--picked/);
  // Escape lets go of the piece and stays on the board.
  await page.keyboard.press('Escape');
  await expect(piece(page, move.from)).not.toHaveClass(/pc--picked/);
  await expect(page.getByTestId('play')).toBeVisible();
  await page.keyboard.press('Space');
  const dir = move.to === move.from + 1 ? 'ArrowRight' : move.to === move.from - 1 ? 'ArrowLeft' : move.to > move.from ? 'ArrowDown' : 'ArrowUp';
  await page.keyboard.press(dir);
  await expect(movesLeft(page)).toHaveText(String(levelAt(1).moves - 1));
  await rested(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a hint shows after a while without a move', async ({ page }) => {
  await openGame(page);
  const s = player(0);
  R.startLevel(s, 1);
  await loadSave(page, saveOf(s));
  await dive(page);
  await expect(page.locator('.pc--hint')).toHaveCount(0);
  await page.clock.runFor(7_500);
  await expect(page.locator('.pc--hint')).toHaveCount(2);
});

test('home shows the next level, the daily dive and the zones, and past the reef the open sea', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('next-title')).toHaveText('Level 1');
  await expect(page.getByTestId('next-where')).toHaveText('Sunlit Shallows');
  await expect(page.getByTestId('daily-status')).toContainText(`Reach it for ${String(C.DAILY_COINS)} sand dollars`);
  await page.getByTestId('zone-open-meadow').click();
  await expect(page.getByTestId('zone-progress')).toHaveText('This zone opens at level 13.');
  await page.keyboard.press('Escape');
  await page.getByTestId('open-rules').click();
  await expect(page.getByTestId('rules')).toContainText('Four in a line make a wave');
  await page.keyboard.press('Escape');

  await loadSave(page, saveOf(player(REEF_LEVELS)));
  await expect(page.getByTestId('total-stars')).toContainText(`${String(REEF_LEVELS * 3)}/${String(REEF_LEVELS * 3)}`);
  await expect(page.getByTestId('next-title')).toHaveText(`Level ${String(REEF_LEVELS + 1)}`);
  await expect(page.getByTestId('next-where')).toHaveText('The open sea: the reef’s boards in new colours');
  await dive(page);
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', String(REEF_LEVELS + 1));
  await expect(page.getByTestId('play')).toContainText('The open sea');
});

test('a note on what is new shows at the first level that has it, until it is read', async ({ page }) => {
  await openGame(page);
  await dive(page);
  await expect(page.getByTestId('tip')).toHaveAttribute('data-tip', 'swap');
  await page.getByTestId('tip-ok').click();
  await expect(page.getByTestId('tip')).toBeHidden();
  await page.reload();
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page.getByTestId('tip')).toBeHidden();
});

test('the game speaks Thai', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('lang-th').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.getByTestId('play-next')).toHaveText('ดำน้ำ');
  await expect(page.getByTestId('next-where')).toHaveText('น้ำตื้นแสงแดด');
  await dive(page);
  await expect(page.getByTestId('tool-claw')).toContainText('ก้ามหนีบ');
  await expect(page.getByTestId('tip')).toContainText('สลับสองชิ้นที่อยู่ติดกัน');
  await page.getByTestId('go-home').click();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('open-privacy').click();
  await expect(page.getByTestId('privacy-modal')).toContainText('เราคือใคร');
});

test('a reached level can be played again for the stars it lacks, from its zone', async ({ page }) => {
  await openGame(page);
  const s = player(6);
  s.stars[3] = 1;
  await loadSave(page, saveOf(s));
  await expect(page.getByTestId('level-4')).toHaveAttribute('data-stars', '1');
  await page.getByTestId('zone-open-shallows').click();
  await page.getByTestId('zone').getByTestId('level-4').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '4');
  // Levels after the next one to reach stay closed.
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('level-7')).toBeEnabled();
  await expect(page.getByTestId('level-8')).toBeDisabled();
});
