import { exportSave, importSave } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import * as R from '../src/sim/rules.js';
import { createState, restoreState, saveFormat, type GameState } from '../src/sim/state.js';
import { DAY, T0, solveShelf } from './helpers.js';

/** A game some way in: shelves in progress with pours to undo and a hint, a result, a bought look. */
function played(): GameState {
  const s = createState(T0);
  for (let level = 1; level <= 4; level++) {
    R.openShelf(s, 'level', DAY);
    solveShelf(s);
  }
  const shelf = R.openShelf(s, 'level', DAY);
  if (!shelf) throw new Error('no shelf');
  const hint = R.findHint(shelf);
  if (hint) R.pour(s, 'level', hint[0], hint[1]);
  s.stardust += 1000;
  R.buyTool(s, 'level', 'extraJar');
  R.buyTool(s, 'level', 'hint');
  const daily = R.openShelf(s, 'daily', DAY);
  const first = daily && R.findHint(daily);
  if (first) R.pour(s, 'daily', first[0], first[1]);
  R.buyLook(s, 'aurora');
  R.setEntitlements(s, ['remove_ads']);
  R.grantAdReward(s, 'free_stardust', T0, DAY, 'level');
  s.settings.sound = false;
  return s;
}

const roundTrip = (s: GameState): GameState => restoreState(JSON.parse(JSON.stringify(s)) as Record<string, unknown>);

interface ShelfData {
  level: number;
  capacity: number;
  start: unknown[];
  jars: unknown[];
  history: { from: number; to: number; n: number }[];
  hint: unknown;
  day: unknown;
}

const dataOf = (s: GameState) => JSON.parse(JSON.stringify(s)) as { shelves: { level: ShelfData; daily: ShelfData } } & Record<string, unknown>;

describe('the save', () => {
  it('reads back exactly what it saved', () => {
    const s = played();
    expect(s.shelves.level?.history.length).toBeGreaterThan(0);
    expect(s.shelves.level?.extraJar).toBe(true);
    expect(s.shelves.level?.hint).not.toBeNull();
    expect(s.shelves.daily?.history).toHaveLength(1);
    expect(roundTrip(s)).toEqual(s);
  });

  it('goes through the save text a player can copy, and back', () => {
    const s = played();
    const back = importSave(saveFormat, exportSave(saveFormat, s, T0));
    expect(back.state).toEqual(s);
    expect(back.version).toBe(saveFormat.version);
  });

  it('drops a damaged shelf rather than half restoring it', () => {
    const s = played();
    const units = dataOf(s);
    // A unit that went missing, so a colour cannot be completed.
    units.shelves.level.jars = [...units.shelves.level.jars.slice(0, -2), [0], ...units.shelves.level.jars.slice(-1)];
    units.shelves.daily.day = 'yesterday';
    expect(restoreState(units).shelves).toEqual({ level: null, daily: null });

    for (const damage of [
      (d: ShelfData) => (d.capacity = 1),
      (d: ShelfData) => (d.jars = d.jars.slice(1)),
      (d: ShelfData) => (d.jars = [[99, 0, 0, 0], ...d.jars.slice(1)]),
      (d: ShelfData) => (d.start = 'jars' as unknown as unknown[]),
      (d: ShelfData) => (d.level = 2),
    ]) {
      const data = dataOf(s);
      damage(data.shelves.level);
      expect(restoreState(data).shelves.level).toBeNull();
    }
  });

  it('keeps the jars but forgets pours that do not lead to them, so Undo stays safe', () => {
    const s = played();
    const data = dataOf(s);
    const first = data.shelves.level.history[0];
    if (!first) throw new Error('no pour');
    data.shelves.level.history = [{ ...first, n: first.n + 1 }];
    data.shelves.level.hint = [0, 99];
    const back = restoreState(data).shelves.level;
    expect(back?.jars).toEqual(s.shelves.level?.jars);
    expect(back?.history).toEqual([]);
    expect(back?.hint).toBeNull();
    expect(R.undo({ ...s, shelves: { level: back ?? null, daily: null } }, 'level')).toBe(false);
  });

  it('replaces damaged fields with safe values', () => {
    const back = restoreState({
      stardust: 'lots',
      level: -3,
      looks: { jar: 'velvet', sky: 'aurora', bought: ['aurora', 'aurora', 'velvet'] },
      daily: { lastDone: 'soon', streak: -2 },
      stats: null,
      result: { mode: 'tournament', star: -4, constellation: 'dragon' },
    });
    expect(back.stardust).toBe(0);
    expect(back.level).toBe(1);
    expect(back.looks).toEqual({ jar: 'glass', sky: 'aurora', bought: ['aurora'] });
    expect(back.daily).toEqual({ lastDone: null, streak: 0, bestStreak: 0 });
    expect(back.stats).toEqual(createState(0).stats);
    expect(back.result).toMatchObject({ mode: 'level', star: null, constellation: null });
  });
});
