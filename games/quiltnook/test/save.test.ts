import { exportSave, importSave } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import * as R from '../src/sim/rules.js';
import { createState, restoreState, saveFormat, type GameState } from '../src/sim/state.js';
import { DAY, T0, greedyBot, sewQuilt } from './helpers.js';

/** A game some way in: quilts in progress with something to undo, a result, a bought set. */
function played(): GameState {
  const s = createState(T0, 11);
  sewQuilt(R.openQuilt(s, 'endless', DAY), greedyBot, 30);
  R.finishQuilt(s, 'endless');
  sewQuilt(R.openQuilt(s, 'endless', DAY), greedyBot, 12);
  sewQuilt(R.openQuilt(s, 'daily', DAY), greedyBot, 9);
  s.spools += 500;
  R.buyFabric(s, 'sunset');
  R.setEntitlements(s, ['remove_ads']);
  R.grantAdReward(s, 'free_spools', T0, DAY, 'endless');
  s.settings.sound = false;
  return s;
}

const roundTrip = (s: GameState): GameState => restoreState(JSON.parse(JSON.stringify(s)) as Record<string, unknown>);

describe('the save', () => {
  it('reads back exactly what it saved', () => {
    const s = played();
    expect(s.quilts.endless?.undo).not.toBeNull();
    expect(s.quilts.daily).not.toBeNull();
    expect(roundTrip(s)).toEqual(s);
  });

  it('goes through the save text a player can copy, and back', () => {
    const s = played();
    const back = importSave(saveFormat, exportSave(saveFormat, s, T0));
    expect(back.state).toEqual(s);
    expect(back.version).toBe(saveFormat.version);
  });

  it('drops a damaged quilt rather than half restoring it', () => {
    const s = played();
    const data = JSON.parse(JSON.stringify(s)) as { quilts: { endless: { board: number[] }; daily: { day: unknown } } };
    data.quilts.endless.board = data.quilts.endless.board.slice(1);
    data.quilts.daily.day = 'yesterday';
    const back = restoreState(data);
    expect(back.quilts).toEqual({ endless: null, daily: null });
  });

  it('keeps fabrics and shapes to the ones the game knows', () => {
    const s = played();
    const data = JSON.parse(JSON.stringify(s)) as {
      quilts: { endless: { board: number[]; tray: unknown[] } };
      fabrics: { chosen: string; bought: string[] };
    };
    data.quilts.endless.board[0] = 9;
    data.quilts.endless.tray = [{ shape: 'toString', fabric: 0 }, { shape: 'dot', fabric: 12 }, 'x'];
    data.fabrics = { chosen: 'velvet', bought: ['sunset', 'sunset', 'velvet'] };
    const back = restoreState(data);
    expect(back.quilts.endless?.board[0]).toBe(3);
    expect(back.quilts.endless?.tray).toEqual([null, { shape: 'dot', fabric: 3 }, null]);
    expect(back.fabrics).toEqual({ chosen: 'cottage', bought: ['sunset'] });
  });

  it('falls back to the starting commissions when the list is damaged', () => {
    const start = createState(T0, 1).commissions;
    const twice = restoreState({ commissions: [{ kind: 'seams' }, { kind: 'seams' }, { kind: 'perfect' }] });
    expect(twice.commissions).toEqual(start);
    const unknown = restoreState({ commissions: [{ kind: 'seams' }, { kind: 'knitting' }, { kind: 'perfect' }] });
    expect(unknown.commissions).toEqual(start);
    const good = restoreState({ commissions: [{ kind: 'daily', tier: 9, progress: 2 }, { kind: 'seams' }, { kind: 'perfect' }] });
    expect(good.commissions[0]).toEqual({ kind: 'daily', tier: 2, progress: 2 });
  });

  it('turns any damaged field into a safe value', () => {
    const s = restoreState({ spools: 'lots', best: -5, stats: null, daily: { lastDone: 42, streak: 'x' }, result: { mode: 'sideways', score: 10 }, shop: 7, quilts: 3 });
    const blank = createState(0, 1);
    expect(s.spools).toBe(0);
    expect(s.best).toBe(0);
    expect(s.stats).toEqual(blank.stats);
    expect(s.daily).toEqual(blank.daily);
    expect(s.result).toEqual({ mode: 'endless', score: 10, newBest: false, spools: 0, doubled: false });
    expect(s.shop).toEqual(blank.shop);
    expect(s.quilts).toEqual({ endless: null, daily: null });
  });

  it('keeps spools a refund took below zero', () => {
    expect(restoreState({ spools: -120 }).spools).toBe(-120);
  });

  it('names its game and version', () => {
    expect(saveFormat.game).toBe('quiltnook');
    expect(saveFormat.version).toBe(1);
  });
});
