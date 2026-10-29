import { ManualClock, MemoryStore, exportSave, localDayKey } from '@game1/engine';
import { TestStore, type StoreService } from '@game1/platform';
import { FakeAds, manualFrames, settle } from '@game1/shell/testing';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';
import { Game, type GameOptions, type SoundName, type StitchEvent } from '../src/game.js';
import * as C from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { createState, saveFormat } from '../src/sim/state.js';
import { T0, greedyBot, quiltWith } from './helpers.js';

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
    options: { clock, scheduler: manualFrames, storage, ads, store, sound, dayKey: (ms) => localDayKey(ms, 0), seed: () => 42 },
  };
}

async function started(r: Rig): Promise<Game> {
  const game = await Game.load(r.options);
  game.start();
  await settle(game);
  return game;
}

/** Plays the quilt in a mode the way the play-bot would, for this many patches at most. */
function sew(game: Game, mode: 'endless' | 'daily', patches: number): void {
  const q = game.open(mode);
  for (let i = 0; i < patches; i++) {
    const move = greedyBot(q);
    if (!move || !game.place(mode, move.slot, move.x, move.y)) return;
  }
}

/** One hole in every row and column: none of three 3 by 3 patches fits. */
const STUCK = `
  .1230123
  0.230123
  01.30123
  012.0123
  0123.123
  01230.23
  012301.3
  0123012.`;

describe('the game', () => {
  it('starts a new game, saves it and continues it after a restart', async () => {
    const r = rig();
    const first = await started(r);
    expect(first.startNote).toBe('new');
    sew(first, 'endless', 12);
    await first.save();
    const saved = JSON.stringify(first.state);
    expect(first.state.quilts.endless?.patches).toBe(12);
    first.stop();

    const second = await started(rig({ clock: r.clock, storage: r.storage, store: r.store }));
    expect(second.startNote).toBe('loaded');
    expect(JSON.stringify(second.state)).toBe(saved);
  });

  it('tells the screens what a patch did, with a sound and a buzz for it', async () => {
    const r = rig();
    const game = await started(r);
    const events: StitchEvent[] = [];
    game.events.on('stitch', (e) => events.push(e));
    game.open('endless');
    game.state.quilts.endless = quiltWith('012301.. ' + '........ '.repeat(6) + '.......2', [['duo_h', 1], ['dot', 0], null]);
    game.pick();
    expect(game.place('endless', 0, 6, 0)?.seams).toHaveLength(1);
    expect(game.place('endless', 0, 6, 0)).toBeNull();
    expect(events).toHaveLength(1);
    expect(events[0]?.mode).toBe('endless');
    expect(r.sounds).toEqual(['pick', 'seam']);
  });

  it('pays the daily reward with a toast when the target is reached', async () => {
    const r = rig();
    const game = await started(r);
    const toasts: string[] = [];
    game.events.on('toast', (toast) => toasts.push(toast.key));
    const q = game.open('daily');
    q.score = R.dailyTarget(game.today()) - 1;
    q.tray = [{ shape: 'dot', fabric: 0 }, null, { shape: 'dot', fabric: 1 }];
    game.place('daily', 0, 0, 0);
    expect(toasts).toEqual(['daily.done']);
    expect(game.state.spools).toBe(C.DAILY_SPOOLS);
  });

  it('finishes a quilt into a result that one rewarded ad doubles', async () => {
    const r = rig();
    const game = await started(r);
    sew(game, 'endless', 200);
    const result = game.finish('endless');
    expect(result?.spools).toBeGreaterThan(0);
    const spools = game.state.spools;
    r.ads.next = 'skipped';
    expect(await game.watchAd('double_spools')).toBe(false);
    r.ads.next = 'rewarded';
    expect(await game.watchAd('double_spools')).toBe(true);
    expect(game.state.spools).toBe(spools + (result?.spools ?? 0));
    expect(await game.watchAd('double_spools')).toBe(false);
    expect(r.ads.rewarded).toEqual(['double_spools', 'double_spools']);
  });

  it('gives a stuck quilt a second chance for a rewarded ad, in the quilt it was watched for', async () => {
    const r = rig();
    const game = await started(r);
    game.open('daily');
    game.open('endless');
    expect(game.adOffered('second_chance', R.slotOf('daily'))).toBe(false);
    game.state.quilts.daily = quiltWith(STUCK, [['block', 0], ['block', 1], ['block', 2]], 'daily');
    game.state.quilts.daily.day = game.today();
    expect(game.adOffered('second_chance', R.slotOf('endless'))).toBe(false);
    expect(game.adOffered('second_chance', R.slotOf('daily'))).toBe(true);
    expect(await game.watchAd('second_chance', R.slotOf('daily'))).toBe(true);
    expect(R.stuck(game.state, 'daily')).toBe(false);
    expect(game.state.quilts.daily.secondChanceUsed).toBe(true);
  });

  it('uses the tools for spools and refuses them without', async () => {
    const r = rig();
    const game = await started(r);
    game.open('endless');
    game.state.quilts.endless = quiltWith(STUCK, [['block', 0], ['block', 1], ['block', 2]]);
    expect(game.newPatches('endless')).toBe(false);
    expect(game.snip('endless', 1, 0)).toBe(false);
    game.state.spools = 100;
    expect(game.snip('endless', 1, 0)).toBe(true);
    expect(game.newPatches('endless')).toBe(true);
    expect(game.state.spools).toBe(100 - C.TOOL_COSTS.snip - C.TOOL_COSTS.newPatches);
    expect(r.sounds).toEqual(['snip', 'pick']);
  });

  it('pays commissions and sells fabric sets for spools', async () => {
    const r = rig();
    const game = await started(r);
    const c = game.state.commissions[1];
    if (!c) throw new Error('no commission');
    c.progress = R.commissionTarget(c);
    expect(game.claimCommission(1)).toBe(C.COMMISSION_REWARDS[0]);
    expect(game.claimCommission(1)).toBe(0);
    game.state.spools = C.FABRIC_COSTS.meadow;
    expect(game.buyFabric('meadow')).toBe(true);
    expect(game.chooseFabric('cottage')).toBe(true);
    expect(game.chooseFabric('candy')).toBe(false);
    expect(R.fabricInUse(game.state)).toBe('cottage');
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

describe('ads and purchases', () => {
  it('gives free spools only when the ad network confirms the ad, up to the daily limit', async () => {
    const r = rig();
    const game = await started(r);
    r.ads.next = 'skipped';
    expect(await game.watchAd('free_spools')).toBe(false);
    expect(game.state.spools).toBe(0);
    r.ads.next = 'rewarded';
    const limit = R.AD_LIMITS.perPlacement.free_spools;
    for (let i = 0; i < limit; i++) expect(await game.watchAd('free_spools')).toBe(true);
    expect(game.adOffered('free_spools')).toBe(false);
    expect(game.state.spools).toBe(limit * C.FREE_SPOOLS);
  });

  it('delivers spool packs, and the Sewing Kit with its fabric set once', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('spools_medium');
    await settle(game);
    expect(game.state.spools).toBe(350);
    await game.purchase('sewing_kit');
    await settle(game);
    expect(game.state.spools).toBe(550);
    expect(R.ownsFabric(game.state, 'meadow')).toBe(true);
    expect((await game.purchase('sewing_kit')).status).not.toBe('purchased');
    await settle(game);
    expect(game.state.spools).toBe(550);
  });

  it('shows ad breaks only after a few quilts and some minutes, and never after No Ad Breaks', async () => {
    const r = rig();
    const game = await started(r);
    r.clock.advance(10 * 60_000);
    for (let i = 0; i < C.AD_BREAKS_AFTER_QUILTS - 1; i++) {
      sew(game, 'endless', 5);
      game.finish('endless');
    }
    expect(await game.naturalBreak()).toBe(false);
    sew(game, 'endless', 5);
    game.finish('endless');
    expect(await game.naturalBreak()).toBe(true);
    expect(r.ads.interstitials).toBe(1);
    await game.purchase('remove_ads');
    await settle(game);
    r.clock.advance(60 * 60_000);
    expect(game.adBreakAllowed()).toBe(false);
  });

  it('gives No Ad Breaks owners the ad rewards without showing ads', async () => {
    const r = rig();
    const game = await started(r);
    await game.purchase('remove_ads');
    await settle(game);
    expect(await game.watchAd('free_spools')).toBe(true);
    expect(game.state.spools).toBe(C.FREE_SPOOLS);
    expect(r.ads.rewarded).toEqual([]);
  });

  it('loads a save copied from another phone', async () => {
    const r = rig();
    const game = await started(r);
    const other = createState(T0, 3);
    other.spools = 77;
    other.best = 4321;
    expect(await game.importSave(exportSave(saveFormat, other, T0))).toBe(true);
    expect(game.state.spools).toBe(77);
    expect(game.state.best).toBe(4321);
  });
});
