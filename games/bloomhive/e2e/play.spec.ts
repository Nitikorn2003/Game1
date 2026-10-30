import { expect, test, type Page } from '@playwright/test';
import * as C from '../src/sim/content.js';
import { CELLS, COLS, ROWS, SHOOTER, centreOf, reachedPip, trace } from '../src/sim/hive.js';
import { MEADOW_LEVELS, ZONES, levelAt } from '../src/sim/levels.js';
import { CLEARED_ROWS, MORE_SHOTS, NECTAR_FULL, goalsLeft } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import { levelOf, type GameState } from '../src/sim/state.js';
import {
  TODAY,
  YESTERDAY,
  aimWhere,
  coins,
  expectBoard,
  goneIn,
  loadSave,
  openGame,
  player,
  pressAim,
  rested,
  round,
  runOut,
  saveOf,
  shoot,
  toPip,
  watchTestAd,
  winnable,
} from './helpers.js';

const shotsLeft = (page: Page) => page.getByTestId('shots').locator('.shots__n');

/** Holds the counts around the board to the round in progress in `s`: pollen, the jar and each goal. */
async function expectCounts(page: Page, s: GameState): Promise<void> {
  const c = s.current;
  if (!c) throw new Error('No round in progress.');
  await expect(shotsLeft(page)).toHaveText(String(c.round.shotsLeft));
  await expect(page.getByTestId('jar')).toHaveAttribute('data-nectar', String(c.round.nectar));
  const left = goalsLeft(c.round, levelOf(c));
  for (const [i, n] of left.entries()) await expect(page.getByTestId(`goal-${String(i)}`)).toHaveAttribute('data-left', String(n));
}

/** A new try at a level, on colours where `plan` works out on a copy of the game; returns what it found. */
function tryWhere<T>(s: GameState, n: number, plan: (copy: GameState) => T): T {
  for (let tries = 0; tries < 30; tries++) {
    s.current = null;
    R.startLevel(s, n);
    try {
      return plan(structuredClone(s));
    } catch {
      // Other colours.
    }
  }
  throw new Error('No try at the level works out.');
}

/** A new try at a level, on colours that give Pip two different pollen to hold. */
function startWithTwoColours(s: GameState, n: number): void {
  tryWhere(s, n, (copy) => {
    if (copy.current?.round.queue[0] === copy.current?.round.queue[1]) throw new Error('Two of one colour.');
  });
}

test('a shot takes one pollen and sticks where the line shows; three of a colour pop and buds left hanging fall', async ({ page }) => {
  await openGame(page);
  const s = player(0);
  // Colours with a shot that pops nothing, and after it one that pops.
  const { quiet, pop } = tryWhere(s, 1, (copy) => {
    const first = aimWhere(copy, (shot) => goneIn(shot) === 0 && !shot.result);
    R.shoot(copy, first);
    return { quiet: first, pop: aimWhere(copy, (shot) => goneIn(shot) >= 3 && !shot.result) };
  });
  const level = levelAt(1);
  await loadSave(page, saveOf(s));
  await round(page);
  await expectBoard(page, s);
  await expectCounts(page, s);

  // Held down, the line ends at a bud where the pollen would stick. Let go at Pip's feet and nothing is shot.
  const board = s.current?.round.board;
  if (!board) throw new Error('No round.');
  const held = await pressAim(page, s, quiet);
  const stick = trace(board, held).cell ?? -1;
  await expect(page.locator('.aim__ghost')).toHaveAttribute('cx', String(centreOf(stick).x));
  await expect(page.locator('.aim__ghost')).toHaveAttribute('cy', String(centreOf(stick).y));
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('No board on the screen.');
  await page.mouse.move(box.x + box.width / 2, box.y + (SHOOTER.y + 0.6) * (box.width / COLS));
  await expect(page.locator('.aim__ghost')).toHaveCount(0);
  await page.mouse.up();
  await expect(shotsLeft(page)).toHaveText(String(level.shots));

  // While a ball is in the air, the board takes no other shot.
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1_000));
  await shoot(page, s, quiet);
  await expect(page.getByTestId('flying-ball')).toBeVisible();
  await expect(page.getByTestId('board')).toHaveAttribute('data-busy', 'true');
  const box2 = await page.getByTestId('board').boundingBox();
  if (box2) await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 3);
  await page.clock.runFor(2_000);
  await page.clock.resume();
  await rested(page);
  await expect(page.getByTestId('flying-ball')).toHaveCount(0);
  await expectBoard(page, s);
  await expectCounts(page, s);
  expect(s.current?.round.board.cells[stick]).not.toBeNull();

  const shot = await shoot(page, s, pop);
  expect(goneIn(shot)).toBeGreaterThanOrEqual(3);
  await rested(page);
  await expectBoard(page, s);
  await expectCounts(page, s);
});

test('a shot bounces off the sides, and tapping the next pollen swaps it into Pip’s hands for free', async ({ page }) => {
  await openGame(page);
  const s = player(2);
  startWithTwoColours(s, 3);
  const [inHand, next] = s.current?.round.queue ?? [0, 0];
  await loadSave(page, saveOf(s));
  await round(page);
  await expect(page.getByTestId('ball-in-hand')).toHaveAttribute('data-colour', String(inHand));
  await expect(page.getByTestId('next-ball')).toHaveAttribute('data-colour', String(next));
  await page.getByTestId('next-ball').click();
  R.swapPollen(s);
  await expect(page.getByTestId('ball-in-hand')).toHaveAttribute('data-colour', String(next));
  await expect(page.getByTestId('next-ball')).toHaveAttribute('data-colour', String(inHand));
  await expectCounts(page, s);

  const bank = aimWhere(s, (shot) => shot.shot.points.length > 2 && !shot.result);
  const shot = await shoot(page, s, bank);
  expect(shot.shot.points.length).toBeGreaterThan(2);
  await rested(page);
  await expectBoard(page, s);
  await expectCounts(page, s);
});

test('a level reached shows its stars and pays for them, a test ad doubles that once, and the next level opens', async ({ page }) => {
  await openGame(page);
  const s = player(1);
  const last = winnable(s, () => R.startLevel(s, 2));
  await loadSave(page, saveOf(s));
  await round(page);
  const shot = await shoot(page, s, last.angle);
  expect(shot.result?.stars).toBe(last.stars);
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

test('out of pollen: five more for a test ad or for honey, or the round ends and starts again on new colours', async ({ page }) => {
  await openGame(page);
  const stuck = () => {
    const s = player(4);
    s.coins = 250;
    R.startLevel(s, 5);
    runOut(s);
    return s;
  };
  await loadSave(page, saveOf(stuck()));
  await round(page);
  await expect(shotsLeft(page)).toHaveText('0');
  await expect(page.getByTestId('stuck-note')).toContainText('Out of pollen');
  await page.getByTestId('stuck-open').click();
  await page.getByTestId('stuck-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('stuck')).toBeHidden();
  await expect(shotsLeft(page)).toHaveText(String(MORE_SHOTS));

  await page.getByTestId('go-home').click();
  await loadSave(page, saveOf(stuck()));
  await round(page);
  await page.getByTestId('stuck-open').click();
  await page.getByTestId('stuck-spend').click();
  await expect(page.getByTestId('stuck')).toBeHidden();
  await expect(shotsLeft(page)).toHaveText(String(MORE_SHOTS));
  expect(await coins(page)).toBe(250 - C.MORE_SHOTS_COST);

  await page.getByTestId('go-home').click();
  await loadSave(page, saveOf(stuck()));
  await round(page);
  // Closing the sheet keeps the round; the note under the board opens it again.
  await page.getByTestId('stuck-open').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stuck-note')).toBeVisible();
  await page.getByTestId('stuck-open').click();
  await page.getByTestId('stuck-end').click();
  await expect(page.getByTestId('result-lost')).toBeVisible();
  await page.getByTestId('result-again').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '5');
  await expect(shotsLeft(page)).toHaveText(String(levelAt(5).shots));
});

test('a bud that comes down to Pip stops the round, and five more pollen blow the lowest rows away', async ({ page }) => {
  await openGame(page);
  const s = player(1);
  s.coins = 300;
  R.startLevel(s, 2);
  toPip(s);
  await loadSave(page, saveOf(s));
  await round(page);
  await expectBoard(page, s);
  await expect(page.locator('.board--danger')).toBeVisible();
  await expect(page.getByTestId('stuck-note')).toContainText('A bud reached Pip');
  await page.getByTestId('stuck-open').click();
  await expect(page.getByTestId('stuck')).toContainText('the lowest buds blow away');
  await page.getByTestId('stuck-spend').click();
  expect(R.buyMoreShots(s)).toBe(true);
  await expect(page.getByTestId('stuck')).toBeHidden();
  await expect(page.getByTestId('stuck-note')).toBeHidden();
  const after = s.current?.round.board;
  if (!after) throw new Error('The round ended.');
  expect(after.cells.slice((ROWS - CLEARED_ROWS) * COLS, CELLS).every((bud) => bud === null)).toBe(true);
  expect(reachedPip(after)).toBe(false);
  await expectBoard(page, s);
  await expectCounts(page, s);
});

test('tools take no pollen: the rainbow takes the colour that pops the most, the bomb blasts wax, and the sunbeam shines through', async ({ page }) => {
  await openGame(page);
  const s = player(24);
  R.startLevel(s, 25);
  const level = levelAt(25);
  const wax = (state: GameState) => state.current?.round.board.cells.filter((bud) => bud?.kind === 'wax').length ?? 0;
  expect(wax(s)).toBeGreaterThan(0);
  await loadSave(page, saveOf(s));
  await round(page);

  await page.getByTestId('tool-rainbow').click();
  await expect(page.getByTestId('tool-note')).toBeVisible();
  await expect(page.getByTestId('ball-in-hand')).toHaveAttribute('data-kind', 'rainbow');
  await shoot(page, s, aimWhere(s, (shot) => goneIn(shot) >= 3 && !shot.result, 'rainbow'), 'rainbow');
  await rested(page);
  await expectBoard(page, s);
  await expect(page.getByTestId('tool-rainbow-count')).toHaveText(String(C.START_TOOLS.rainbow - 1));
  await expect(page.getByTestId('tool-note')).toBeHidden();

  await page.getByTestId('tool-bomb').click();
  await shoot(page, s, aimWhere(s, (shot, after) => wax(after) < wax(s) && !shot.result, 'bomb'), 'bomb');
  await rested(page);
  await expectBoard(page, s);
  await expect(page.getByTestId('tool-bomb-count')).toHaveText(String(C.START_TOOLS.bomb - 1));

  await page.getByTestId('tool-sunbeam').click();
  await shoot(page, s, aimWhere(s, (shot) => goneIn(shot) >= 2 && !shot.result, 'sunbeam'), 'sunbeam');
  await rested(page);
  await expectBoard(page, s);
  await expect(page.getByTestId('tool-sunbeam-count')).toHaveText(C.START_TOOLS.sunbeam > 1 ? String(C.START_TOOLS.sunbeam - 1) : '+');
  await expect(shotsLeft(page)).toHaveText(String(level.shots));

  // A tool chosen can be put back.
  await page.getByTestId('tool-rainbow').click();
  await page.getByTestId('tool-cancel').click();
  await expect(page.getByTestId('tool-note')).toBeHidden();
  await expect(page.getByTestId('ball-in-hand')).toHaveAttribute('data-kind', s.current?.round.bomb ? 'jar' : 'pollen');
});

test('an empty pouch offers a tool for a test ad or for honey', async ({ page }) => {
  await openGame(page);
  const s = player(12);
  s.coins = 300;
  s.tools = { rainbow: 0, bomb: 0, sunbeam: 0 };
  R.startLevel(s, 13);
  await loadSave(page, saveOf(s));
  await round(page);
  await expect(page.getByTestId('tool-bomb-count')).toHaveText('+');
  await page.getByTestId('tool-bomb').click();
  await expect(page.getByTestId('tool-sheet')).toBeVisible();
  await page.getByTestId('tool-watch').click();
  await watchTestAd(page);
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(page.getByTestId('tool-bomb-count')).toHaveText('1');

  await page.getByTestId('tool-sunbeam').click();
  await page.getByTestId('tool-spend').click();
  await expect(page.getByTestId('tool-sheet')).toBeHidden();
  await expect(page.getByTestId('tool-sunbeam-count')).toHaveText('1');
  expect(await coins(page)).toBe(300 - C.TOOL_COSTS.sunbeam);
});

test('every bud popped or fallen fills the nectar jar, and a full jar gives a bomb that takes no pollen', async ({ page }) => {
  await openGame(page);
  const s = player(4);
  R.startLevel(s, 5);
  const c = s.current;
  if (!c) throw new Error('No round.');
  c.round.nectar = NECTAR_FULL - 1;
  await loadSave(page, saveOf(s));
  await round(page);
  await expect(page.getByTestId('jar-note')).toBeHidden();
  await shoot(
    page,
    s,
    aimWhere(s, (shot) => goneIn(shot) >= 3 && shot.shot.filled && !shot.result),
  );
  await rested(page);
  await expect(page.getByTestId('jar-note')).toHaveText('The jar is full: your next shot is a bomb, and it takes no pollen.');
  await expect(page.getByTestId('ball-in-hand')).toHaveAttribute('data-kind', 'jar');
  await expectCounts(page, s);
  const pollen = c.round.shotsLeft;
  await shoot(
    page,
    s,
    aimWhere(s, (shot) => goneIn(shot) > 0 && !shot.result),
  );
  await rested(page);
  await expectBoard(page, s);
  await expect(shotsLeft(page)).toHaveText(String(pollen));
  await expect(page.getByTestId('ball-in-hand')).toHaveAttribute('data-kind', 'pollen');
  await expect(page.getByTestId('jar-note')).toBeHidden();
});

/** The first level of each new kind of bud: every shot on them plays out on the screen as the rules say. */
const SPECIALS = [
  ['wax', 25, (s: GameState) => s.current?.round.board.cells.some((bud) => bud?.kind === 'wax')],
  ['honey', 37, (s: GameState) => s.current?.round.board.cells.some((bud) => bud?.honey)],
  ['dandelion puffs', 49, (s: GameState) => s.current?.round.board.cells.some((bud) => bud?.kind === 'puff')],
  ['butterflies', 61, (s: GameState) => s.current?.round.board.cells.some((bud) => bud?.butterfly)],
  ['six colours', 73, (s: GameState) => new Set(s.current?.round.board.cells.flatMap((bud) => (bud?.kind === 'bud' ? [bud.colour] : []))).size === 6],
] as const;

for (const [what, n, has] of SPECIALS) {
  test(`a board with ${what} plays out on the screen shot by shot as the rules say`, async ({ page }) => {
    await openGame(page);
    const s = player(n - 1);
    R.startLevel(s, n);
    expect(has(s)).toBe(true);
    await loadSave(page, saveOf(s));
    await round(page);
    await expectBoard(page, s);
    for (let i = 0; i < 4; i++) {
      const aim = R.hintAim(s);
      if (!aim) throw new Error('No shot to take.');
      if (aim.swap) {
        await page.getByTestId('next-ball').click();
        R.swapPollen(s);
      }
      const shot = await shoot(page, s, aim.angle);
      await rested(page);
      // A shot that reaches the goals ends the round, and the results show instead.
      if (shot.result) break;
      await expectBoard(page, s);
      await expectCounts(page, s);
    }
  });
}

test('the daily meadow pays once a day, more for the streak, and shows as reached at home', async ({ page }) => {
  await openGame(page);
  const s = player(20);
  s.daily = { day: YESTERDAY, tries: 1, lastDone: YESTERDAY, streak: 2, bestStreak: 2 };
  const last = winnable(s, () => R.openDaily(s, TODAY));
  expect(last.pay).toBe(C.DAILY_COINS + 2 * C.STREAK_COINS);
  await loadSave(page, saveOf(s));
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 2');
  await round(page, 'play-daily');
  await expect(page.getByTestId('play')).toHaveAttribute('data-mode', 'daily');
  await expect(shotsLeft(page)).toHaveText(String(s.current?.round.shotsLeft));
  await shoot(page, s, last.angle);
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('results')).toContainText('Daily meadow reached!');
  await expect(page.getByTestId('result-streak')).toHaveText('Daily streak: 3');
  await expect.poll(() => coins(page)).toBe(last.pay);
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('daily-status')).toHaveText('Reached for today. A new daily meadow comes tomorrow.');
  await expect(page.getByTestId('play-daily')).toBeHidden();
  await expect(page.getByTestId('daily-streak')).toHaveText('Daily streak: 3');
});

test('a round keeps its place: home and back, and after a reload', async ({ page }) => {
  await openGame(page);
  const s = player(2);
  R.startLevel(s, 3);
  for (let i = 0; i < 3; i++) {
    const aim = R.hintAim(s);
    if (!aim) break;
    if (aim.swap) R.swapPollen(s);
    R.shoot(s, aim.angle);
  }
  await loadSave(page, saveOf(s));
  await expect(page.getByTestId('next-title')).toHaveText('Back to level 3');
  await round(page);
  await expectBoard(page, s);
  await expectCounts(page, s);
  await page.getByTestId('go-home').click();
  await page.reload();
  // A round in progress opens on its board.
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '3');
  await expectBoard(page, s);
  await expectCounts(page, s);
});

test('the last level of a zone makes its flower bloom in Pip’s garden, with honey and a tool of each kind', async ({ page }) => {
  await openGame(page);
  const s = player(11);
  const last = winnable(s, () => R.startLevel(s, 12));
  const tools = { ...s.tools };
  await loadSave(page, saveOf(s));
  await expect(page.getByTestId('garden-clover')).toHaveAttribute('data-bloomed', 'false');
  await round(page);
  await shoot(page, s, last.angle);
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('result-zone')).toContainText('The daisy is in bloom!');
  await expect.poll(() => coins(page)).toBe(last.pay + C.ZONE_COINS);
  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '13');
  for (const tool of C.TOOLS) await expect(page.getByTestId(`tool-${tool}-count`)).toHaveText(String(tools[tool] + 1));
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('garden-clover')).toHaveAttribute('data-bloomed', 'true');
  await expect(page.getByTestId('zone-clover')).toContainText('The daisy is in bloom');
});

test('ad breaks wait for three levels reached and a few minutes of play, and come once the results close', async ({ page }) => {
  await openGame(page);
  const first = player(1);
  let last = winnable(first, () => R.startLevel(first, 2));
  await loadSave(page, saveOf(first));
  // As if the phone had been put down a while: timers due in the meantime fire once.
  await page.clock.fastForward(6 * 60_000);
  await round(page);
  await shoot(page, first, last.angle);
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
  await round(page);
  await shoot(page, second, last.angle);
  // Not while the goals are reached and the results show: only once they close.
  await expect(page.getByTestId('results')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await page.getByTestId('result-home').click();
  await expect(page.getByTestId('test-interstitial')).toContainText('Ad break');
  await page.getByTestId('test-ad-close').click();
  await expect(page.getByTestId('test-interstitial')).toBeHidden();
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a test purchase shows that no money is charged and delivers once; the Keeper’s Kit brings its tools and its hat', async ({ page }) => {
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
  await page.getByTestId('buy-keeper_kit').click();
  await page.getByTestId('test-purchase-buy').click();
  await expect(page.getByTestId('offer-keeper_kit')).toContainText('Owned');
  await expect.poll(() => coins(page)).toBe(1500);
  await expect(page.getByTestId('pouch')).toContainText(`Rainbow: ${String(C.START_TOOLS.rainbow + 5)}`);
  await expect(page.getByTestId('pouch')).toContainText(`Bomb: ${String(C.START_TOOLS.bomb + 5)}`);
  await expect(page.getByTestId('pouch')).toContainText(`Sunbeam: ${String(C.START_TOOLS.sunbeam + 5)}`);
  await page.keyboard.press('Escape');
  await page.getByTestId('open-looks').click();
  await page.getByTestId(`use-${C.KEEPER_KIT_HAT}`).click();
  await expect(page.getByTestId(`look-${C.KEEPER_KIT_HAT}`)).toContainText('In use');
  await expect(page.locator('.app')).toHaveAttribute('data-hat', C.KEEPER_KIT_HAT);
  expect(await coins(page)).toBe(1500);
});

test('free honey from a test ad, with the daily limit shown', async ({ page }) => {
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
  await round(page);
  await page.getByTestId('stuck-open').click();
  await expect(page.getByTestId('stuck-watch')).toHaveText(`Get ${String(MORE_SHOTS)} pollen free`);
  await page.getByTestId('stuck-watch').click();
  await expect(page.getByTestId('stuck')).toBeHidden();
  await expect(shotsLeft(page)).toHaveText(String(MORE_SHOTS));
  await expect(page.getByTestId('test-ad')).toBeHidden();
});

test('looks bought with honey are used at once, and stay after a reload', async ({ page }) => {
  await openGame(page);
  const s = player(3);
  s.coins = 1500;
  await loadSave(page, saveOf(s));
  await page.getByTestId('open-looks').click();
  await page.getByTestId('buy-look-sunset').click();
  await expect(page.getByTestId('look-sunset')).toContainText('In use');
  expect(await coins(page)).toBe(1500 - C.LOOK_COSTS.sunset);
  await expect(page.getByTestId('buy-look-starry')).toBeDisabled();
  const app = page.locator('.app');
  await expect(app).toHaveAttribute('data-sky', 'sunset');
  await page.getByTestId('buy-look-flowers').click();
  await expect(app).toHaveAttribute('data-hat', 'flowers');
  await page.getByTestId('use-morning').click();
  await expect(app).toHaveAttribute('data-sky', 'morning');
  await page.getByTestId('use-sunset').click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(app).toHaveAttribute('data-sky', 'sunset');
  await expect(app).toHaveAttribute('data-hat', 'flowers');
  await page.getByTestId('play-next').click();
  await expect(app).toHaveAttribute('data-sky', 'sunset');
  await expect(page.locator('.pip--board')).toBeVisible();
});

/** Boards with one goal and the note on what is new, with two goals, and the daily meadow: each fits a small phone. */
const FITS = [
  ['a first level, with its note', 1, false],
  ['two goals', 18, true],
  ['the daily meadow', 0, true],
] as const;

for (const [what, n, seen] of FITS) {
  test(`the board for ${what} fits a small phone, with buds big enough to see`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openGame(page);
    const s = player(Math.max(n - 1, 0));
    if (!seen) s.tips = [];
    if (n > 0) R.startLevel(s, n);
    else R.openDaily(s, TODAY);
    await loadSave(page, saveOf(s));
    await round(page, n > 0 ? 'play-next' : 'play-daily');
    const goals = levelOf(s.current ?? { mode: 'meadow', level: 1, day: null }).goals.map((_, i) => `goal-${String(i)}`);
    const ids = ['board', 'go-home', 'coins', 'shots', 'jar', ...goals, 'tool-rainbow', 'tool-bomb', 'tool-sunbeam', 'next-ball', 'ball-in-hand', ...(seen ? [] : ['tip'])];
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
    const first = s.current?.round.board.cells.findIndex((bud) => bud !== null) ?? 0;
    expect((await page.getByTestId(`bud-${String(first)}`).boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(24);
  });
}

test('the keyboard plays too: the arrows aim, up or Enter shoots, down swaps, and Escape puts a tool back and then goes home', async ({ page }) => {
  await openGame(page);
  const s = player(0);
  startWithTwoColours(s, 1);
  const [inHand, next] = s.current?.round.queue ?? [0, 0];
  await loadSave(page, saveOf(s));
  await round(page);
  const board = page.getByTestId('board');
  await board.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(board).toHaveAttribute('data-aim', '92.0');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(board).toHaveAttribute('data-aim', '84.0');
  await page.keyboard.press('ArrowDown');
  R.swapPollen(s);
  await expect(page.getByTestId('ball-in-hand')).toHaveAttribute('data-colour', String(next));
  await expect(page.getByTestId('next-ball')).toHaveAttribute('data-colour', String(inHand));
  await page.keyboard.press('Enter');
  expect(R.shoot(s, 84)).not.toBeNull();
  await rested(page);
  await expectBoard(page, s);
  await expectCounts(page, s);

  await page.getByTestId('tool-rainbow').click();
  await board.focus();
  await expect(page.getByTestId('ball-in-hand')).toHaveAttribute('data-kind', 'rainbow');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tool-note')).toBeHidden();
  await expect(page.getByTestId('play')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('home')).toBeVisible();
});

test('a shot that helps shows after a while without one', async ({ page }) => {
  await openGame(page);
  const s = player(0);
  R.startLevel(s, 1);
  const hint = R.hintAim(s);
  if (!hint) throw new Error('No hint on the first board.');
  await loadSave(page, saveOf(s));
  await round(page);
  await page.mouse.move(1, 1);
  await expect(page.locator('.aim__path')).toHaveCount(0);
  await page.clock.runFor(7_500);
  await expect(page.locator('.aim__path--hint')).toHaveCount(1);
  await expect(page.getByTestId('board')).toHaveAttribute('data-aim', hint.angle.toFixed(1));
  if (hint.swap) await expect(page.getByTestId('next-ball')).toHaveClass(/nextball--hint/);
});

test('home shows the next level, the daily meadow, Pip’s garden and the zones, and past the meadow the wild', async ({ page }) => {
  await openGame(page);
  await expect(page.getByTestId('next-title')).toHaveText('Level 1');
  await expect(page.getByTestId('next-where')).toHaveText('Clover Lawn');
  await expect(page.getByTestId('daily-status')).toContainText(`Reach it for ${String(C.DAILY_COINS)} honey`);
  await expect(page.getByTestId('garden')).toContainText(`0 of ${String(ZONES.length)} flowers in bloom`);
  await page.getByTestId('zone-open-sunflower').click();
  await expect(page.getByTestId('zone-progress')).toHaveText('This zone opens at level 13.');
  await page.keyboard.press('Escape');
  await page.getByTestId('open-rules').click();
  await expect(page.getByTestId('rules')).toContainText('Three or more buds of one colour touching pop');
  await page.keyboard.press('Escape');

  await loadSave(page, saveOf(player(MEADOW_LEVELS)));
  await expect(page.getByTestId('total-stars')).toContainText(`${String(MEADOW_LEVELS * 3)}/${String(MEADOW_LEVELS * 3)}`);
  await expect(page.getByTestId('garden')).toContainText(`${String(ZONES.length)} of ${String(ZONES.length)} flowers in bloom`);
  for (const zone of ZONES) await expect(page.getByTestId(`garden-${zone}`)).toHaveAttribute('data-bloomed', 'true');
  await expect(page.getByTestId('next-title')).toHaveText(`Level ${String(MEADOW_LEVELS + 1)}`);
  await expect(page.getByTestId('next-where')).toHaveText('The wild meadow');
  await expect(page.getByTestId('wild-note')).toContainText('the meadow’s boards in new colours');
  await round(page);
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', String(MEADOW_LEVELS + 1));
  await expect(page.getByTestId('play')).toContainText('The wild meadow');
});

test('a note on what is new shows at the first level that has it, until it is read', async ({ page }) => {
  await openGame(page);
  await round(page);
  await expect(page.getByTestId('tip')).toHaveAttribute('data-tip', 'aim');
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
  await expect(page.getByTestId('play-next')).toHaveText('บินเลย');
  await expect(page.getByTestId('next-where')).toHaveText('สนามโคลเวอร์');
  const typeface = await page.getByTestId('next-where').evaluate(async (el) => {
    await document.fonts.ready;
    return { family: getComputedStyle(el).fontFamily, loaded: document.fonts.check('500 16px KoHo', 'บินเลย') };
  });
  expect(typeface.family).toContain('KoHo');
  expect(typeface.loaded).toBe(true);
  await round(page);
  await expect(page.getByTestId('tool-rainbow')).toContainText('สายรุ้ง');
  await expect(page.getByTestId('tip')).toContainText('ลากเพื่อเล็งแล้วปล่อยเพื่อยิง');
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
  await page.getByTestId('zone-open-clover').click();
  await page.getByTestId('zone').getByTestId('level-4').click();
  await expect(page.getByTestId('play')).toHaveAttribute('data-level', '4');
  // Levels after the next one to reach stay closed.
  await page.getByTestId('go-home').click();
  await expect(page.getByTestId('level-7')).toBeEnabled();
  await expect(page.getByTestId('level-8')).toBeDisabled();
});
