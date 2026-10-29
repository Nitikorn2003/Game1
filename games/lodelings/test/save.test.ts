import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave, exportSave, importSave } from '@game1/engine';
import { ATTENTIVE, newBotGame, playActive } from '../src/sim/bot.js';
import * as R from '../src/sim/rules.js';
import { restoreState, saveFormat, type GameState } from '../src/sim/state.js';

const format = saveFormat(R.blockHp);

function roundTrip(state: GameState): GameState {
  return decodeSave(format, encodeSave(format, state, 1, 0)).state;
}

describe('Lodelings saves', () => {
  it('restore a played game exactly', () => {
    const state = newBotGame(11);
    playActive(state, 20 * 60);
    expect(roundTrip(state)).toEqual(JSON.parse(JSON.stringify(state)));
  });

  it('continue identically after a save and reload in the middle of play', () => {
    const straight = newBotGame(5);
    playActive(straight, 10 * 60);
    const reloaded = roundTrip(straight);
    playActive(straight, 10 * 60);
    playActive(reloaded, 10 * 60);
    expect(JSON.stringify(reloaded)).toBe(JSON.stringify(straight));
  });

  it('repair damaged or edited values instead of loading them', () => {
    const state = newBotGame(2);
    playActive(state, 5 * 60);
    const data = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    Object.assign(data, {
      ore: null,
      gems: 'lots',
      depth: -4,
      hp: 1e300,
      team: ['emberkit', 'emberkit', 'not_a_creature', 'drizzlet'],
      eggs: ['pebble', 'golden', 7],
      roster: { ...(data.roster as object), fake: { level: 1e9, stars: 9 } },
      gear: { pick: -3, lamp: 400, cart: 'x' },
      relics: { hourglass: 99 },
      settings: { sound: 'yes', locale: 'fr', numbers: 'roman' },
      guardian: { endsAt: 'soon', maxHp: -1 },
      incubators: [{ kind: 'dragon', startedAt: 5, readyAt: 1 }, 'x', null, null, null],
    });
    const repaired = restoreState(data, R.blockHp);
    expect(repaired.ore).toBe(0);
    expect(repaired.gems).toBe(0);
    expect(repaired.depth).toBe(1);
    expect(repaired.hp).toBe(R.blockHp(1));
    expect(repaired.roster.fake).toBeUndefined();
    expect(new Set(repaired.team).size).toBe(repaired.team.length);
    expect(repaired.team.every((id) => id in repaired.roster)).toBe(true);
    expect(repaired.eggs).toEqual(['pebble']);
    expect(repaired.gear).toEqual({ pick: 0, lamp: 26, cart: 0, echo: 0 });
    expect(repaired.relics.hourglass).toBe(10);
    expect(repaired.settings).toEqual({ sound: true, haptics: true, numbers: 'short', locale: 'auto' });
    expect(repaired.guardian).toBeNull();
    expect(repaired.incubators).toEqual([{ kind: 'pebble', startedAt: 5, readyAt: 5 }, null, null]);
  });

  it('keep each settlement with its amounts, and read the ids-only list of early test saves', () => {
    const state = newBotGame(3);
    R.applySettlement(state, 'abc-123', { gems: 550, egg_prism: 1, nothing: 0 }, 1000);
    expect(roundTrip(state).shop.settled).toEqual([{ id: 'abc-123', amounts: { gems: 550, egg_prism: 1 }, at: 1000 }]);

    const data = JSON.parse(JSON.stringify(state)) as { shop: { settled: unknown[] } };
    data.shop.settled = ['old-1', 'old-1', 'bad id!', { id: 'new-1', amounts: { gems: 1.5, eggs: 2 }, at: 5 }, { amounts: {} }];
    expect(restoreState(data, R.blockHp).shop.settled).toEqual([
      { id: 'old-1', amounts: {}, at: 0 },
      { id: 'new-1', amounts: { eggs: 2 }, at: 5 },
    ]);
  });

  it('fill in everything missing from an almost empty save', () => {
    const repaired = restoreState({ createdAt: 1000 }, R.blockHp);
    expect(repaired.depth).toBe(1);
    expect(repaired.team).toEqual([]);
    expect(repaired.incubators).toEqual([null]);
    expect(Object.keys(repaired.gear)).toEqual(['pick', 'lamp', 'cart', 'echo']);
  });

  it('export to text a player can paste back', () => {
    const state = newBotGame(3);
    playActive(state, 3 * 60);
    const text = exportSave(format, state, 0);
    expect(text.startsWith('lodelings:')).toBe(true);
    expect(importSave(format, text).state).toEqual(JSON.parse(JSON.stringify(state)));
  });
});

describe('pace (balance regression guard)', () => {
  it('moves a fast, attentive player through the early game in minutes', () => {
    const r = playActive(newBotGame(7), 60 * 60);
    expect(r.reached.get(10)).toBeLessThan(5 * 60);
    expect(r.reached.get(30)).toBeGreaterThan(5 * 60);
    expect(r.reached.get(30)).toBeLessThan(30 * 60);
    expect(r.resurfaces[0]?.seconds).toBeLessThan(60 * 60);
  });

  it('lets a slow tapper reach depth 30 within 45 minutes', () => {
    const r = playActive(newBotGame(7), 45 * 60, { ...ATTENTIVE, tapsPerSecond: 2 });
    expect(r.reached.get(30)).toBeDefined();
  });

  it('keeps progressing for 12 hours without stalls or broken numbers', () => {
    const state = newBotGame(13);
    const r = playActive(state, 12 * 3600);
    expect(r.nonFinite).toEqual([]);
    expect(state.bestDepth).toBeGreaterThan(150);
    const times = r.resurfaces.map((x) => x.seconds);
    const gaps = times.slice(1).map((t, i) => t - (times[i] ?? 0));
    expect(Math.max(...gaps)).toBeLessThan(2 * 3600);
  }, 60_000);

  it('rewards an idle player who checks in a few minutes at a time', () => {
    const state = newBotGame(21);
    let offlineOre = 0;
    for (let session = 0; session < 18; session++) {
      if (session > 0) {
        const now = state.lastSeenAt + 3 * 3600 * 1000;
        const report = R.returnFromOffline(state, R.ctx(now, '2026-01-01'));
        offlineOre += report?.ore ?? 0;
        R.collectOffline(state, now, false);
      }
      playActive(state, 5 * 60);
    }
    expect(offlineOre).toBeGreaterThan(0);
    expect(state.bestDepth).toBeGreaterThanOrEqual(30);
  }, 60_000);
});
