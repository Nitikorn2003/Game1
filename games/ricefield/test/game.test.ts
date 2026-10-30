import { ManualClock, MemoryStore, exportSave, localDayKey } from '@game1/engine';
import { TestStore, noStore, type StoreService } from '@game1/platform';
import { FakeAds, manualFrames, settle } from '@game1/shell/testing';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, type ActEvent, type GameOptions, type HintEvent, type SoundName } from '../src/game.js';
import * as C from '../src/sim/content.js';
import { PICTURES, startBoard, type PictureId } from '../src/sim/fields.js';
import { EMPTY, FILLED, UNKNOWN } from '../src/sim/nonogram.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat } from '../src/sim/state.js';
import { DAY, T0, dayAfter, toPlant } from './helpers.js';

interface Rig {
  clock: ManualClock;
  storage: MemoryStore;
  ads: FakeAds;
  store: StoreService;
  sounds: SoundName[];
  options: GameOptions;
}

function rig(overrides: Partial<Omit<Rig, 'options' | 'sounds'>> = {}): Rig {
  const clock = overrides.clock ?? new ManualClock(T0);
  const storage = overrides.storage ?? new MemoryStore();
  const ads = overrides.ads ?? new FakeAds();
  const store = overrides.store ?? new TestStore(CATALOG, storage, { ask: () => Promise.resolve('buy') });
  const sounds: SoundName[] = [];
  const sound = { play: (name: SoundName) => sounds.push(name), setEnabled: () => undefined };
  return {
    clock,
    storage,
    ads,
    store,
    sounds,
    options: { clock, scheduler: manualFrames, storage, ads, store, sound, dayKey: (ms) => localDayKey(ms, 0) },
  };
}

async function started(r: Rig): Promise<Game> {
  const game = await Game.load(r.options);
  game.start();
  await settle(game);
  return game;
}

/** The first picture: a heart, five by five. Its first row is `.X.X.`. */
const HEART: PictureId = 'heart';

/** Grows a field through the game, planting only its picture, the way a player who never goes wrong would. */
function grow(game: Game, key: R.FieldKey): void {
  for (const cell of toPlant(game.state, key)) {
    const acted = game.act(key, cell, 'plant');
    if (!acted || acted.mistake) throw new Error(`planting cell ${String(cell)} went wrong`);
  }
  if (game.field(key)) throw new Error('the field did not grow');
}

/** Opens these album pictures in turn and grows them. */
function growPictures(game: Game, pictures: readonly { id: PictureId }[]): void {
  for (const picture of pictures) {
    if (!game.openPicture(picture.id)) throw new Error(`${picture.id} cannot be played`);
    grow(game, picture.id);
  }
}

/** Open cells of the field that stay empty: planting one is a wrong move. */
function emptyCells(game: Game, key: R.FieldKey): number[] {
  const field = game.field(key);
  if (!field) throw new Error('no field');
  const { shape } = R.puzzleOfField(field);
  return field.board.flatMap((state, cell) => (state === UNKNOWN && !shape.filled[cell] ? [cell] : []));
}

/** Plants `n` cells that stay empty. */
function goWrong(game: Game, key: R.FieldKey, n: number): void {
  for (const cell of emptyCells(game, key).slice(0, n)) {
    if (!game.act(key, cell, 'plant')?.mistake) throw new Error('that was not a wrong move');
  }
}

describe('the game', () => {
  it('starts a new game, saves it and continues it after a restart', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    expect(first.openPicture(HEART)).not.toBeNull();
    first.act(HEART, 1, 'plant');
    await first.save();
    const saved = JSON.stringify(first.state);
    first.stop();

    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(JSON.stringify(second.state)).toBe(saved);
    expect(second.field(HEART)?.board[1]).toBe(FILLED);
  });

  it('tells the screens what a move did, with a sound for it', async () => {
    const r = rig();
    const game = await started(r);
    const events: ActEvent[] = [];
    game.events.on('act', (e) => events.push(e));
    game.openPicture(HEART);

    const wrong = game.act(HEART, 0, 'plant');
    expect(wrong).toMatchObject({ cell: 0, state: EMPTY, mistake: true, wilted: false });
    expect(game.field(HEART)?.hearts).toBe(C.HEARTS - 1);
    // A cell already known takes no move.
    expect(game.act(HEART, 0, 'pebble')).toBeNull();
    expect(game.act(HEART, 1, 'plant')?.mistake).toBe(false);
    expect(game.act(HEART, 2, 'pebble')?.mistake).toBe(false);
    // The last rice of the first row: the row is done, and its last open cell is pebbled.
    const row = game.act(HEART, 3, 'plant');
    expect(row?.lines).toEqual([{ axis: 'row', index: 0 }]);
    expect(row?.pebbled).toEqual([4]);
    expect(r.sounds).toEqual(['mistake', 'plant', 'pebble', 'line']);

    grow(game, HEART);
    const last = events[events.length - 1];
    expect(last?.key).toBe(HEART);
    expect(last?.acted.result).toMatchObject({ mode: 'album', id: HEART, perfect: false, mistakes: 1 });
    expect(events.every((e) => e.key === HEART)).toBe(true);
    expect(r.sounds[r.sounds.length - 1]).toBe('grown');
    expect(game.state.grown).toEqual([HEART]);
  });

  it('grows a picture into a result that one rewarded ad doubles', async () => {
    const r = rig();
    const game = await started(r);
    game.openPicture(HEART);
    grow(game, HEART);
    const result = game.state.result;
    // A field of 25 cells pays 6 seeds, and half as much again for growing it perfectly.
    expect(result).toMatchObject({ perfect: true, pay: 6, bonus: 3, seeds: 9 });
    expect(game.state.seeds).toBe(9);
    r.ads.next = 'skipped';
    expect(await game.watchAd('double_seeds')).toBe(false);
    r.ads.next = 'rewarded';
    expect(await game.watchAd('double_seeds')).toBe(true);
    expect(game.state.seeds).toBe(18);
    expect(game.state.result?.doubled).toBe(true);
    expect(await game.watchAd('double_seeds')).toBe(false);
    expect(r.ads.rewarded).toEqual(['double_seeds', 'double_seeds']);
  });

  it('gives a hint for a rewarded ad to the field it was watched for', async () => {
    const r = rig();
    const game = await started(r);
    const hints: HintEvent[] = [];
    game.events.on('hint', (e) => hints.push(e));
    game.openPicture(HEART);
    game.openDaily();
    expect(game.adOffered('hint', R.slotOf('daily'))).toBe(false);
    expect(game.freeHint('daily')).not.toBeNull();
    // The free hint goes first; after it, a hint is for an ad or for seeds.
    expect(game.freeHint('daily')).toBeNull();
    expect(game.adOffered('hint', R.slotOf('daily'))).toBe(true);
    expect(game.adOffered('hint', R.slotOf(HEART))).toBe(false);
    expect(await game.watchAd('hint', R.slotOf('daily'))).toBe(true);
    expect(game.field('daily')?.hints).toBe(2);
    expect(game.field(HEART)?.hints).toBe(0);
    expect(hints.map((e) => e.key)).toEqual(['daily', 'daily']);
    expect(r.sounds).toEqual(['hint', 'hint']);
  });

  it('uses a hint for seeds once the free one is used, and refuses it without', async () => {
    const r = rig();
    const game = await started(r);
    game.openPicture(HEART);
    game.state.seeds = C.TOOL_COSTS.hint;
    expect(game.buyTool(HEART, 'hint')).toBe(false);
    game.freeHint(HEART);
    game.state.seeds = 0;
    expect(game.buyTool(HEART, 'hint')).toBe(false);
    game.state.seeds = C.TOOL_COSTS.hint;
    expect(game.buyTool(HEART, 'hint')).toBe(true);
    expect(game.state.seeds).toBe(0);
    expect(game.field(HEART)?.hints).toBe(2);
    expect(r.sounds).toEqual(['hint', 'hint']);
  });

  it('fills up the hearts of a wilted field for an ad or for seeds, or starts it over', async () => {
    const r = rig();
    const game = await started(r);
    const events: ActEvent[] = [];
    game.events.on('act', (e) => events.push(e));
    game.openPicture(HEART);
    goWrong(game, HEART, C.HEARTS);
    expect(events[events.length - 1]?.acted.wilted).toBe(true);
    expect(r.sounds).toEqual(['mistake', 'mistake', 'wilt']);
    // A wilted field takes no moves and no free hint until its hearts are back.
    expect(game.act(HEART, 1, 'plant')).toBeNull();
    expect(game.freeHint(HEART)).toBeNull();
    expect(game.toolOffered(HEART, 'hearts')).toBe(true);
    expect(game.buyTool(HEART, 'hearts')).toBe(false);
    game.state.seeds = C.TOOL_COSTS.hearts;
    expect(game.buyTool(HEART, 'hearts')).toBe(true);
    expect(game.field(HEART)?.hearts).toBe(C.HEARTS);
    expect(game.state.seeds).toBe(0);
    expect(game.toolOffered(HEART, 'hearts')).toBe(false);

    goWrong(game, HEART, C.HEARTS);
    expect(game.adOffered('hearts', R.slotOf(HEART))).toBe(true);
    expect(await game.watchAd('hearts', R.slotOf(HEART))).toBe(true);
    expect(game.field(HEART)?.hearts).toBe(C.HEARTS);

    goWrong(game, HEART, 1);
    expect(game.restart(HEART)).toBe(true);
    const field = game.field(HEART);
    expect(field?.board).toEqual(startBoard(R.puzzleOfField(field ?? fail())));
    expect(field).toMatchObject({ hearts: C.HEARTS, wrong: [], restarts: 1, mistakes: 2 * C.HEARTS + 1 });
    expect(r.sounds.slice(3)).toEqual(['buy', 'mistake', 'mistake', 'wilt', 'claim', 'mistake']);
  });

  it('opens only the pictures of open albums, and the daily field once a day', async () => {
    const r = rig();
    const game = await started(r);
    expect(game.openPicture('frog')).toBeNull();
    const daily = game.openDaily();
    expect(daily?.id).toBe(DAY);
    grow(game, 'daily');
    expect(game.state.result).toMatchObject({ mode: 'daily', pay: C.DAILY_SEEDS, streak: 1 });
    expect(game.openDaily()).toBeNull();
    r.clock.advance(86_400_000);
    expect(game.openDaily()?.id).toBe(dayAfter(DAY));
  });

  it('sells looks for seeds', async () => {
    const r = rig();
    const game = await started(r);
    game.state.seeds = C.LOOK_COSTS.golden;
    expect(game.buyLook('golden')).toBe(true);
    expect(R.sceneInUse(game.state)).toBe('golden');
    expect(game.chooseLook('terraces')).toBe(true);
    expect(game.chooseLook('frog')).toBe(false);
    expect(game.buyLook('frog')).toBe(false);
    expect(game.state.seeds).toBe(0);
    expect(r.sounds).toEqual(['buy']);
  });

  it('counts time played on its clock', async () => {
    const r = rig();
    const game = await started(r);
    for (let i = 0; i < 30; i++) {
      r.clock.advance(1000);
      game.pump();
    }
    expect(game.state.stats.playSeconds).toBe(30);
  });
});

function fail(): never {
  throw new Error('no field');
}

describe('ads and purchases', () => {
  it('gives free seeds only when the ad network confirms the ad, up to the daily limit', async () => {
    const r = rig();
    const game = await started(r);
    r.ads.next = 'skipped';
    expect(await game.watchAd('free_seeds')).toBe(false);
    expect(game.state.seeds).toBe(0);
    r.ads.next = 'rewarded';
    const limit = R.AD_LIMITS.perPlacement.free_seeds;
    for (let i = 0; i < limit; i++) expect(await game.watchAd('free_seeds')).toBe(true);
    expect(game.adOffered('free_seeds')).toBe(false);
    expect(game.state.seeds).toBe(limit * C.FREE_SEEDS);
    expect(r.sounds).toEqual(Array.from({ length: limit }, () => 'claim'));
  });

  it('delivers seed packs, and the Farmer’s Kit with its marker once', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('seeds_medium');
    await settle(game);
    expect(game.state.seeds).toBe(3000);
    expect(R.farmerKitOffered(game.state)).toBe(true);
    await game.purchase('farmer_kit');
    await settle(game);
    expect(game.state.seeds).toBe(4000);
    expect(R.ownsLook(game.state, C.FARMER_KIT_MARKER)).toBe(true);
    expect(R.farmerKitOffered(game.state)).toBe(false);
    expect((await game.purchase('farmer_kit')).status).not.toBe('purchased');
    await settle(game);
    expect(game.state.seeds).toBe(4000);
    await game.purchase('field_collection');
    await settle(game);
    expect(R.LOOKS.every((id) => R.ownsLook(game.state, id))).toBe(true);
    expect(R.collectionOffered(game.state)).toBe(false);
  });

  it('shows ad breaks only after a few grown fields and some minutes, and never after No Ad Breaks', async () => {
    const r = rig();
    const game = await started(r);
    r.clock.advance(10 * 60_000);
    const enough = C.AD_BREAKS_AFTER_WINS;
    growPictures(game, PICTURES.slice(0, enough - 1));
    expect(await game.naturalBreak()).toBe(false);
    growPictures(game, PICTURES.slice(enough - 1, enough));
    expect(await game.naturalBreak()).toBe(true);
    expect(r.ads.interstitials).toBe(1);
    await game.purchase('remove_ads');
    await settle(game);
    r.clock.advance(60 * 60_000);
    expect(game.adBreakAllowed()).toBe(false);
  });

  it('in the ads-only edition sells nothing, never asks for a wallet and still pays ad rewards', async () => {
    const calls: string[] = [];
    const store: StoreService = {
      ...noStore,
      products: (ids) => {
        calls.push('products');
        return noStore.products(ids);
      },
      wallet: () => {
        calls.push('wallet');
        return noStore.wallet();
      },
    };
    const game = await started(rig({ store }));
    expect(game.sells).toBe(false);
    expect(await game.syncPurchases(false)).toBe(false);
    expect(calls).toEqual([]);
    expect(game.storeError).toBe(false);
    expect(await game.watchAd('free_seeds')).toBe(true);
    expect(game.state.seeds).toBe(C.FREE_SEEDS);
  });

  it('gives No Ad Breaks owners the ad rewards without showing ads', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('remove_ads');
    await settle(game);
    expect(await game.watchAd('free_seeds')).toBe(true);
    game.openPicture(HEART);
    game.freeHint(HEART);
    expect(await game.watchAd('hint', R.slotOf(HEART))).toBe(true);
    expect(game.field(HEART)?.hints).toBe(2);
    expect(game.state.seeds).toBe(C.FREE_SEEDS);
    expect(r.ads.rewarded).toEqual([]);
  });

  it('loads a save copied from another phone', async () => {
    const r = rig();
    const game = await started(r);
    const other = createState(T0);
    other.seeds = 77;
    other.grown = [HEART];
    expect(await game.importSave(exportSave(saveFormat, other, T0))).toBe(true);
    expect(game.state.seeds).toBe(77);
    expect(game.state.grown).toEqual([HEART]);
  });
});
