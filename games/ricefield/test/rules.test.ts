import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import { PICTURES, pictureOf, picturesOf, puzzleOf, startBoard } from '../src/sim/fields.js';
import { EMPTY, FILLED, truthOf, UNKNOWN } from '../src/sim/nonogram.js';
import * as R from '../src/sim/rules.js';
import { createState, type GameState } from '../src/sim/state.js';
import { DAY, dayAfter, growField, growPicture, T0, toPlant } from './helpers.js';

/*
 * The heart, cell by cell:  . r . r .    0  1  2  3  4
 *                           r r r r r    5  6  7  8  9
 *                           r r r r r   10 11 12 13 14
 *                           . r r r .   15 16 17 18 19
 *                           . . r . .   20 21 22 23 24
 */

function withHeart(): GameState {
  const s = createState(T0);
  if (!R.openAlbumField(s, 'heart')) throw new Error('no heart');
  return s;
}

function heart(s: GameState) {
  const field = R.fieldOf(s, 'heart');
  if (!field) throw new Error('no heart field');
  return field;
}

/** Grows the first eight pictures of the first album, which opens the second. */
function openWater(s: GameState): void {
  for (const id of picturesOf('first').slice(0, C.OPEN_AFTER)) growPicture(s, id);
}

describe('a field', () => {
  it('starts with the cells it shows, and pebbles in the lines with nothing to plant', () => {
    const rain = puzzleOf(pictureOf('raincloud'));
    // The row between the cloud and the rain has no rice at all.
    expect(rain.clues.rows[6]).toEqual([]);
    expect(startBoard(rain).slice(72, 84)).toEqual(new Array(12).fill(EMPTY));
    const cat = puzzleOf(pictureOf('cat'));
    const [given = -1] = cat.givens;
    expect(cat.givens).toHaveLength(1);
    expect(startBoard(cat)[given]).toBe(truthOf(cat.shape, given));
    expect(startBoard(puzzleOf(pictureOf('heart')))).toEqual(new Array(25).fill(UNKNOWN));
  });

  it('plants and pebbles cells, and puts a wrong move right for a heart', () => {
    const s = withHeart();
    expect(R.act(s, 'heart', 1, 'plant')).toMatchObject({ cell: 1, state: FILLED, mistake: false, result: null });
    expect(R.act(s, 'heart', 1, 'plant')).toBeNull();
    expect(R.act(s, 'heart', 1, 'pebble')).toBeNull();
    expect(R.act(s, 'heart', 0, 'pebble')).toMatchObject({ state: EMPTY, mistake: false });
    expect(R.act(s, 'heart', 2, 'plant')).toMatchObject({ cell: 2, state: EMPTY, mistake: true, wilted: false });
    expect(R.act(s, 'heart', 6, 'pebble')).toMatchObject({ cell: 6, state: FILLED, mistake: true });
    expect(heart(s)).toMatchObject({ hearts: C.HEARTS - 2, mistakes: 2, wrong: [2, 6] });
    expect(s.stats.mistakes).toBe(2);
    expect(R.act(s, 'heart', 25, 'plant')).toBeNull();
    expect(R.act(s, 'heart', -1, 'plant')).toBeNull();
    expect(R.act(s, 'tree', 0, 'plant')).toBeNull();
  });

  it('pebbles the rest of a line once all its rice is planted', () => {
    const s = withHeart();
    expect(R.act(s, 'heart', 1, 'plant')?.lines).toEqual([]);
    const acted = R.act(s, 'heart', 3, 'plant');
    expect(acted?.lines).toEqual([{ axis: 'row', index: 0 }]);
    expect(acted?.pebbled).toEqual([0, 2, 4]);
    expect(heart(s).board.slice(0, 5)).toEqual([EMPTY, FILLED, EMPTY, FILLED, EMPTY]);
    // A wrong move that was put right can finish a line too: column 0 is rice in rows 1 and 2 only.
    R.act(s, 'heart', 5, 'plant');
    const fixed = R.act(s, 'heart', 10, 'pebble');
    expect(fixed).toMatchObject({ mistake: true, state: FILLED, lines: [{ axis: 'col', index: 0 }], pebbled: [15, 20] });
  });

  it('waits once its hearts are gone, until they are filled up or the field is started over', () => {
    const s = withHeart();
    R.act(s, 'heart', 6, 'plant');
    R.act(s, 'heart', 0, 'plant');
    R.act(s, 'heart', 2, 'plant');
    expect(R.act(s, 'heart', 4, 'plant')).toMatchObject({ mistake: true, wilted: true });
    expect(heart(s).hearts).toBe(0);
    expect(R.act(s, 'heart', 7, 'plant')).toBeNull();
    expect(R.freeHint(s, 'heart')).toBeNull();
    expect(R.toolOffered(s, 'heart', 'hint')).toBe(false);
    expect(R.toolOffered(s, 'heart', 'hearts')).toBe(true);
    expect(R.buyTool(s, 'heart', 'hearts')).toBeNull();
    s.seeds = C.TOOL_COSTS.hearts;
    expect(R.buyTool(s, 'heart', 'hearts')).toEqual({ tool: 'hearts' });
    expect(s.seeds).toBe(0);
    expect(heart(s).hearts).toBe(C.HEARTS);
    expect(R.toolOffered(s, 'heart', 'hearts')).toBe(false);
    expect(R.act(s, 'heart', 7, 'plant')?.mistake).toBe(false);
    // Starting over keeps the count of wrong moves, so the field is no longer perfect.
    expect(R.restart(s, 'heart')).toBe(true);
    expect(heart(s)).toMatchObject({ board: new Array(25).fill(UNKNOWN), hearts: C.HEARTS, mistakes: 3, wrong: [], restarts: 1 });
    expect(s.stats.restarts).toBe(1);
    expect(growField(s, 'heart').perfect).toBe(false);
  });

  it('grows once its picture is planted, and pays for its size, half as much again when perfect', () => {
    const s = createState(T0);
    const result = growPicture(s, 'heart');
    const pay = C.fieldSeeds(25);
    expect(result).toMatchObject({ mode: 'album', id: 'heart', perfect: true, mistakes: 0, hints: 0, pay, bonus: C.perfectBonus(pay), album: null, opened: null });
    expect(result.seeds).toBe(pay + C.perfectBonus(pay));
    expect(s.seeds).toBe(result.seeds);
    expect(s.grown).toEqual(['heart']);
    expect(s.fields).toEqual([]);
    expect(s.result).toEqual(result);
    expect(s.stats).toMatchObject({ grown: 1, perfect: 1, cells: 16 });
    expect(s.taught).toBe(true);
    // A wrong move, or a hint, and the field pays only for its size.
    R.openAlbumField(s, 'house');
    R.act(s, 'house', 0, 'plant');
    expect(growField(s, 'house')).toMatchObject({ perfect: false, mistakes: 1, bonus: 0, seeds: C.fieldSeeds(25) });
    R.openAlbumField(s, 'tree');
    R.freeHint(s, 'tree');
    expect(growField(s, 'tree')).toMatchObject({ perfect: false, hints: 1, bonus: 0 });
    expect(s.stats).toMatchObject({ grown: 3, perfect: 1 });
  });

  it('can be grown on hints alone', () => {
    const s = withHeart();
    s.seeds = 10_000;
    let result = R.freeHint(s, 'heart')?.result ?? null;
    for (let hints = 1; result === null; hints++) {
      expect(hints).toBeLessThan(25);
      const helped = R.buyTool(s, 'heart', 'hint');
      expect(helped?.tool).toBe('hint');
      result = helped?.tool === 'hint' ? helped.hinted.result : null;
    }
    expect(result).toMatchObject({ id: 'heart', perfect: false });
    expect(s.grown).toEqual(['heart']);
  });

  it('opens the next album after eight pictures, and pays a bonus for the whole album', () => {
    const s = createState(T0);
    const first = picturesOf('first');
    const water = picturesOf('water')[0] ?? 'frog';
    expect(R.albumOpen(s, 'first')).toBe(true);
    expect(R.albumOpen(s, 'water')).toBe(false);
    expect(R.neededToOpen(s, 'water')).toBe(C.OPEN_AFTER);
    expect(R.openAlbumField(s, water)).toBeNull();
    const results = first.slice(0, C.OPEN_AFTER).map((id) => growPicture(s, id));
    expect(results.map((r) => r.opened)).toEqual([...Array.from({ length: C.OPEN_AFTER - 1 }, () => null), 'water']);
    expect(R.albumOpen(s, 'water')).toBe(true);
    expect(R.neededToOpen(s, 'water')).toBe(0);
    expect(R.albumOpen(s, 'farm')).toBe(false);
    expect(R.openAlbumField(s, water)?.id).toBe(water);
    for (const id of first.slice(C.OPEN_AFTER, -1)) growPicture(s, id);
    const seeds = s.seeds;
    const last = growPicture(s, first[first.length - 1] ?? 'leaf');
    expect(last).toMatchObject({ album: 'first', albumSeeds: C.ALBUM_SEEDS });
    expect(s.seeds).toBe(seeds + last.seeds + C.ALBUM_SEEDS);
    expect(R.albumDone(s, 'first')).toBe(true);
    expect(R.grownIn(s, 'first')).toBe(12);
    // A grown picture is not played again.
    expect(R.openAlbumField(s, 'heart')).toBeNull();
  });

  it('keeps twelve album fields in progress, the one played last at the end', () => {
    const s = createState(T0);
    openWater(s);
    const ids = [...picturesOf('first').slice(C.OPEN_AFTER), ...picturesOf('water').slice(0, 9)];
    for (const id of ids) R.openAlbumField(s, id);
    expect(s.fields.map((f) => f.id)).toEqual(ids.slice(1));
    expect(R.lastField(s)?.id).toBe(ids[ids.length - 1]);
    // Going back to one moves it to the end, and lets none go.
    const again = ids[3] ?? 'frog';
    const before = R.fieldOf(s, again);
    expect(R.openAlbumField(s, again)).toBe(before);
    expect(s.fields).toHaveLength(C.MAX_OPEN_FIELDS);
    expect(R.lastField(s)?.id).toBe(again);
  });

  it('finds the next picture to play, in an open album', () => {
    const s = createState(T0);
    expect(R.nextPicture(s)).toBe('heart');
    growPicture(s, 'heart');
    expect(R.nextPicture(s)).toBe('house');
    expect(R.nextPicture(s, 'house')).toBe('tree');
    // From the last picture of the open albums it goes round to the first one not grown.
    expect(R.nextPicture(s, 'leaf')).toBe('house');
    for (const id of picturesOf('first')) if (!s.grown.includes(id)) growPicture(s, id);
    expect(R.nextPicture(s, 'leaf')).toBe('frog');
    const t = createState(T0);
    t.grown = PICTURES.map((picture) => picture.id);
    expect(R.nextPicture(t)).toBeNull();
  });

  it('tells how far a field has grown', () => {
    const s = withHeart();
    expect(R.progressOf(heart(s))).toBe(0);
    expect(R.touched(heart(s))).toBe(false);
    R.act(s, 'heart', 1, 'plant');
    R.act(s, 'heart', 3, 'plant');
    R.act(s, 'heart', 22, 'plant');
    expect(R.progressOf(heart(s))).toBe(3 / 16);
    expect(R.touched(heart(s))).toBe(true);
  });
});

describe('hints', () => {
  it('gives one free hint a field, then one for an ad or seeds', () => {
    const s = createState(T0);
    R.openAlbumField(s, 'cat');
    const cat = puzzleOf(pictureOf('cat'));
    expect(R.toolOffered(s, 'cat', 'hint')).toBe(false);
    const hinted = R.freeHint(s, 'cat');
    expect(hinted?.cells.length).toBeGreaterThan(0);
    for (const { cell, state } of hinted?.cells ?? []) expect(state).toBe(truthOf(cat.shape, cell));
    expect(R.freeHint(s, 'cat')).toBeNull();
    expect(R.toolOffered(s, 'cat', 'hint')).toBe(true);
    expect(R.buyTool(s, 'cat', 'hint')).toBeNull();
    s.seeds = C.TOOL_COSTS.hint;
    expect(R.buyTool(s, 'cat', 'hint')?.tool).toBe('hint');
    expect(s.seeds).toBe(0);
    expect(R.fieldOf(s, 'cat')).toMatchObject({ hints: 2, freeHints: 0 });
    expect(s.stats.hints).toBe(2);
  });

  it('fills in the line the clues tell most about, and pebbles what that finishes', () => {
    const s = withHeart();
    // Rows 1 and 2 are all rice: either is a whole line of five.
    const hinted = R.freeHint(s, 'heart');
    expect(hinted?.line).toEqual({ axis: 'row', index: 1 });
    expect(hinted?.cells.map(({ cell }) => cell)).toEqual([5, 6, 7, 8, 9]);
    expect(hinted?.lines).toEqual([{ axis: 'row', index: 1 }]);
  });
});

describe('the daily field', () => {
  it('is one a day, pays for the day, and counts a streak of days', () => {
    const s = createState(T0);
    const field = R.openDaily(s, DAY);
    expect(field).toMatchObject({ mode: 'daily', id: DAY, hearts: C.HEARTS });
    expect(R.openDaily(s, DAY)).toBe(field);
    expect(R.keyOf(field ?? fail())).toBe('daily');
    expect(growField(s, 'daily')).toMatchObject({ mode: 'daily', id: DAY, pay: C.DAILY_SEEDS, bonus: C.perfectBonus(C.DAILY_SEEDS), streak: 1 });
    expect(s.seeds).toBe(C.DAILY_SEEDS + C.perfectBonus(C.DAILY_SEEDS));
    expect(R.dailyDoneToday(s, DAY)).toBe(true);
    expect(R.openDaily(s, DAY)).toBeNull();
    expect(s.grown).toEqual([]);
    R.openDaily(s, dayAfter(DAY));
    expect(growField(s, 'daily').streak).toBe(2);
    expect(R.dailyStreak(s, dayAfter(DAY, 2))).toBe(2);
    expect(R.dailyStreak(s, dayAfter(DAY, 3))).toBe(0);
    R.openDaily(s, dayAfter(DAY, 3));
    expect(growField(s, 'daily').streak).toBe(1);
    expect(s.daily).toMatchObject({ streak: 1, bestStreak: 2, lastDone: dayAfter(DAY, 3) });
    expect(s.stats.dailies).toBe(3);
  });

  it('gives way to a new one the next day', () => {
    const s = createState(T0);
    R.openDaily(s, DAY);
    const [cell = 0] = toPlant(s, 'daily');
    R.act(s, 'daily', cell, 'plant');
    const next = R.openDaily(s, dayAfter(DAY));
    expect(next?.id).toBe(dayAfter(DAY));
    expect(next?.board).toEqual(startBoard(R.puzzleOfField(next ?? fail())));
  });

  it('pays nothing for a day already counted', () => {
    const s = createState(T0);
    R.openDaily(s, DAY);
    // Played on and finished after a later day was done, say on another phone.
    s.daily.lastDone = dayAfter(DAY);
    expect(growField(s, 'daily')).toMatchObject({ pay: 0, bonus: 0, seeds: 0, streak: 0 });
    expect(s.seeds).toBe(0);
    expect(s.daily.lastDone).toBe(dayAfter(DAY));
  });
});

describe('looks', () => {
  it('sells looks for seeds, and draws only those owned', () => {
    const s = createState(T0);
    expect(R.sceneInUse(s)).toBe('terraces');
    expect(R.markerInUse(s)).toBe('pebble');
    expect(R.buyLook(s, 'golden')).toBe(false);
    s.seeds = C.LOOK_COSTS.golden;
    expect(R.buyLook(s, 'golden')).toBe(true);
    expect(s.seeds).toBe(0);
    expect(R.sceneInUse(s)).toBe('golden');
    expect(R.buyLook(s, 'golden')).toBe(false);
    expect(R.chooseLook(s, 'snail')).toBe(false);
    expect(R.chooseLook(s, 'terraces')).toBe(true);
    expect(R.sceneInUse(s)).toBe('terraces');
  });

  it('comes with the Farmer’s Kit and the Field Collection, and goes with a refund', () => {
    const s = createState(T0);
    R.setEntitlements(s, ['farmer_kit']);
    expect(R.ownsLook(s, C.FARMER_KIT_MARKER)).toBe(true);
    expect(R.farmerKitOffered(s)).toBe(false);
    expect(R.chooseLook(s, 'frog')).toBe(true);
    expect(R.collectionOffered(s)).toBe(true);
    R.setEntitlements(s, ['farmer_kit', 'field_collection']);
    expect(R.LOOKS.every((id) => R.ownsLook(s, id))).toBe(true);
    expect(R.collectionOffered(s)).toBe(false);
    R.chooseLook(s, 'snowy');
    R.setEntitlements(s, []);
    expect(R.sceneInUse(s)).toBe('terraces');
    expect(R.markerInUse(s)).toBe('pebble');
  });
});

describe('ads and purchases', () => {
  it('knows a field by its slot', () => {
    expect(R.slotOf('daily')).toBe(0);
    expect(R.slotOf('heart')).toBe(1);
    expect(R.keyOfSlot(0)).toBe('daily');
    expect(R.keyOfSlot(1)).toBe('heart');
    expect(R.keyOfSlot(PICTURES.length)).toBe(PICTURES[PICTURES.length - 1]?.id);
    expect(R.keyOfSlot(PICTURES.length + 1)).toBeNull();
    for (const picture of PICTURES) expect(R.keyOfSlot(R.slotOf(picture.id))).toBe(picture.id);
  });

  it('offers a hint for an ad once the free one is used, and hearts once they are gone', () => {
    const s = createState(T0);
    const apple = R.openAlbumField(s, 'apple') ?? fail();
    expect(R.adOffered(s, 'hint', DAY, 'apple')).toBe(false);
    R.freeHint(s, 'apple');
    expect(R.adOffered(s, 'hint', DAY, 'apple')).toBe(true);
    expect(R.adOffered(s, 'hint', DAY, 'daily')).toBe(false);
    expect(R.adOffered(s, 'hint', DAY, null)).toBe(false);
    const rewarded = R.grantAdReward(s, 'hint', T0, DAY, 'apple');
    expect(rewarded?.hinted?.cells.length).toBeGreaterThan(0);
    expect(apple.hints).toBe(2);
    expect(R.adOffered(s, 'hearts', DAY, 'apple')).toBe(false);
    // Three wrong moves: rice planted where the picture has none.
    const { shape } = R.puzzleOfField(apple);
    const empty = apple.board.flatMap((state, cell) => (state === UNKNOWN && !shape.filled[cell] ? [cell] : []));
    for (const cell of empty.slice(0, C.HEARTS)) R.act(s, 'apple', cell, 'plant');
    expect(apple.hearts).toBe(0);
    expect(R.adOffered(s, 'hint', DAY, 'apple')).toBe(false);
    expect(R.grantAdReward(s, 'hearts', T0, DAY, 'apple')).toEqual({ placement: 'hearts', hinted: null });
    expect(apple.hearts).toBe(C.HEARTS);
    expect(R.adsLeft(s, 'hint', DAY)).toBe(R.AD_LIMITS.perPlacement.hint - 1);
    expect(R.adsLeft(s, 'hearts', DAY)).toBe(R.AD_LIMITS.perPlacement.hearts - 1);
  });

  it('doubles a grown field’s seeds once, but not the album bonus', () => {
    const s = createState(T0);
    for (const id of picturesOf('first').slice(0, -1)) growPicture(s, id);
    expect(R.grantAdReward(s, 'double_seeds', T0, DAY, null)).not.toBeNull();
    const result = growPicture(s, 'leaf');
    const seeds = s.seeds;
    expect(R.adOffered(s, 'double_seeds', DAY, null)).toBe(true);
    R.grantAdReward(s, 'double_seeds', T0, DAY, null);
    expect(s.seeds).toBe(seeds + result.seeds);
    expect(s.result?.doubled).toBe(true);
    expect(R.adOffered(s, 'double_seeds', DAY, null)).toBe(false);
    // A daily field that paid nothing has nothing to double.
    const t = createState(T0);
    R.openDaily(t, DAY);
    t.daily.lastDone = DAY;
    growField(t, 'daily');
    expect(R.adOffered(t, 'double_seeds', DAY, null)).toBe(false);
  });

  it('gives free seeds up to the daily limits, which start again the next day', () => {
    const s = createState(T0);
    const limit = R.AD_LIMITS.perPlacement.free_seeds;
    for (let i = 0; i < limit; i++) expect(R.grantAdReward(s, 'free_seeds', T0, DAY, null)).not.toBeNull();
    expect(R.adOffered(s, 'free_seeds', DAY, null)).toBe(false);
    expect(s.seeds).toBe(limit * C.FREE_SEEDS);
    expect(R.adsLeft(s, 'free_seeds', dayAfter(DAY))).toBe(limit);
  });

  it('adds purchased seeds, takes them back after a refund, and keeps only known entitlements', () => {
    const s = createState(T0);
    R.grantPurchase(s, { seeds: 500 });
    R.grantPurchase(s, { coins: 99 });
    expect(s.seeds).toBe(500);
    R.grantPurchase(s, { seeds: -3000 });
    expect(s.seeds).toBe(-2500);
    R.setEntitlements(s, ['remove_ads', 'canal_collection', 'remove_ads']);
    expect(s.shop.entitlements).toEqual(['remove_ads']);
  });

  it('starts ad breaks only after a few grown fields', () => {
    const s = createState(T0);
    for (const id of ['heart', 'house'] as const) growPicture(s, id);
    expect(R.adBreaksEarned(s)).toBe(false);
    R.openDaily(s, DAY);
    growField(s, 'daily');
    expect(R.adBreaksEarned(s)).toBe(true);
  });
});

function fail(): never {
  throw new Error('missing');
}
