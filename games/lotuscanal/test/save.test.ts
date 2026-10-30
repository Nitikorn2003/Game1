import { exportSave, importSave } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import { botChoice } from '../src/sim/bot.js';
import * as R from '../src/sim/rules.js';
import { createState, restoreState, saveFormat, type GameState } from '../src/sim/state.js';
import { clearDeal, DAY, T0 } from './helpers.js';

/** A game some way in: deals in progress with moves to undo and help bought, a result, a bought look. */
function played(): GameState {
  const s = createState(T0);
  for (let level = 1; level <= 3; level++) {
    R.openDeal(s, 'level', DAY);
    clearDeal(s);
  }
  const deal = R.openDeal(s, 'level', DAY);
  if (!deal) throw new Error('no deal');
  for (let i = 0; i < 4; i++) {
    const spot = botChoice(R.tableOf(deal));
    if (spot === null) R.draw(s, 'level');
    else R.play(s, 'level', spot, DAY);
  }
  s.coins += 1000;
  R.buyTool(s, 'level', 'wild');
  R.openDeal(s, 'daily', DAY);
  R.draw(s, 'daily');
  R.buyLook(s, 'rain');
  R.setEntitlements(s, ['remove_ads']);
  R.grantAdReward(s, 'free_coins', T0, DAY, 'level');
  s.settings.sound = false;
  return s;
}

const roundTrip = (s: GameState): GameState => restoreState(JSON.parse(JSON.stringify(s)) as Record<string, unknown>);

interface DealData {
  level: number;
  day: unknown;
  dealt: { layout: unknown; cards: unknown[]; stock: unknown[]; reserve: unknown[] };
  moves: unknown[];
  extras: unknown;
}

const dataOf = (s: GameState) => JSON.parse(JSON.stringify(s)) as { deals: { level: DealData; daily: DealData } } & Record<string, unknown>;

describe('the save', () => {
  it('reads back exactly what it saved', () => {
    const s = played();
    expect(s.deals.level?.moves.length).toBe(5);
    expect(s.deals.daily?.moves).toEqual([{ kind: 'draw' }]);
    expect(roundTrip(s)).toEqual(s);
    // And the results of a cleared level that finished a canal.
    const t = createState(T0);
    for (let level = 1; level <= 10; level++) {
      R.openDeal(t, 'level', DAY);
      clearDeal(t);
    }
    expect(t.result?.canal).toBe('landing');
    expect(roundTrip(t)).toEqual(t);
  });

  it('goes through the save text a player can copy, and back', () => {
    const s = played();
    const back = importSave(saveFormat, exportSave(saveFormat, s, T0));
    expect(back.state).toEqual(s);
    expect(back.version).toBe(saveFormat.version);
  });

  it('drops a damaged deal rather than half restoring it', () => {
    const s = played();
    for (const damage of [
      (d: DealData) => (d.dealt.layout = 'spiral'),
      (d: DealData) => (d.dealt.cards = d.dealt.cards.slice(1)),
      (d: DealData) => (d.dealt.cards = [d.dealt.stock[0], ...d.dealt.cards.slice(1)]),
      (d: DealData) => (d.dealt.stock = []),
      (d: DealData) => (d.dealt.reserve = [60]),
      (d: DealData) => (d.level = 2),
    ]) {
      const data = dataOf(s);
      damage(data.deals.level);
      expect(restoreState(data).deals.level).toBeNull();
    }
    const data = dataOf(s);
    data.deals.daily.day = 'yesterday';
    expect(restoreState(data).deals.daily).toBeNull();
  });

  it('keeps the moves only as far as they can be made, so Undo stays safe', () => {
    const s = played();
    const data = dataOf(s);
    data.deals.level.moves = [...data.deals.level.moves.slice(0, 2), { kind: 'play', spot: 99 }, ...data.deals.level.moves.slice(2)];
    const back = restoreState(data).deals.level;
    expect(back?.moves).toEqual(s.deals.level?.moves.slice(0, 2));
    data.deals.level.moves = [{ kind: 'fly' }, { kind: 'draw' }];
    expect(restoreState(data).deals.level?.moves).toEqual([]);
  });

  it('replaces damaged fields with safe values', () => {
    const back = restoreState({
      coins: 'lots',
      level: -3,
      looks: { back: 'velvet', scene: 'rain', bought: ['rain', 'rain', 'velvet'] },
      daily: { lastDone: 'soon', streak: -2 },
      tries: { level: { key: 7, lost: -1 } },
      stats: null,
      result: { mode: 'tournament', won: 'yes', canal: 'amazon' },
    });
    expect(back.coins).toBe(0);
    expect(back.level).toBe(1);
    expect(back.looks).toEqual({ back: 'lotus', scene: 'rain', bought: ['rain'] });
    expect(back.daily).toEqual({ lastDone: null, streak: 0, bestStreak: 0 });
    expect(back.tries).toEqual(createState(0).tries);
    expect(back.stats).toEqual(createState(0).stats);
    expect(back.result).toMatchObject({ mode: 'level', won: false, canal: null });
  });
});
