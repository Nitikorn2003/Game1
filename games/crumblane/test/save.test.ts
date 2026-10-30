import { exportSave, importSave } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import { PASTRIES } from '../src/sim/counter.js';
import { TRAY } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import { createState, restoreState, saveFormat, type GameState } from '../src/sim/state.js';
import { DAY, T0, jam, playToWin } from './helpers.js';

/**
 * A game some way in: levels and a daily special cleared, and a round in progress with
 * pastries on the tray and up on the rack, a set boxed up by the whisk and the spatula used,
 * and a bought look.
 */
function played(): GameState {
  const s = createState(T0);
  R.startLevel(s, 1);
  playToWin(s);
  R.startLevel(s, 2);
  playToWin(s);
  R.openDaily(s, DAY);
  playToWin(s);
  R.startLevel(s, 3);
  jam(s);
  if (!R.buyRoom(s)) throw new Error('no room made');
  const r = s.current?.round;
  if (!r) throw new Error('no round');
  if (!R.take(s, r.rack[0] ?? -1)) throw new Error('nothing back from the rack');
  if (!R.applyTool(s, 'whisk')) throw new Error('no whisk');
  if (!R.applyTool(s, 'spatula')) throw new Error('no spatula');
  R.seeTip(s, 'tools');
  s.coins += 1000;
  R.buyLook(s, 'rain');
  R.setEntitlements(s, ['remove_ads']);
  R.grantAdReward(s, 'free_coins', T0, DAY, 0);
  s.settings.sound = false;
  return s;
}

const roundTrip = (s: GameState): GameState => restoreState(JSON.parse(JSON.stringify(s)) as Record<string, unknown>);

interface Data extends Record<string, unknown> {
  current: {
    mode: unknown;
    level: unknown;
    day: unknown;
    round: Record<string, unknown> & { kinds: unknown[]; at: unknown[]; tray: unknown[]; rack: unknown[]; taken: unknown[] };
  };
}

const dataOf = (s: GameState) => JSON.parse(JSON.stringify(s)) as Data;

describe('the save', () => {
  it('reads back exactly what it saved', () => {
    const s = played();
    expect(s.stars).toEqual([3, 3]);
    expect(s.current).toMatchObject({ mode: 'lane', level: 3 });
    const r = s.current?.round;
    expect(r?.rack.length).toBeGreaterThan(0);
    expect(r?.tray.length).toBeGreaterThan(0);
    expect(r?.sets).toBe(1);
    expect(r?.continues).toBe(1);
    expect(roundTrip(s)).toEqual(s);
    // And the results of a round.
    const t = createState(T0);
    R.startLevel(t, 1);
    playToWin(t);
    expect(t.result).not.toBeNull();
    expect(roundTrip(t)).toEqual(t);
  });

  it('goes through the save text a player can copy, and back', () => {
    const s = played();
    const back = importSave(saveFormat, exportSave(saveFormat, s, T0));
    expect(back.state).toEqual(s);
    expect(back.version).toBe(saveFormat.version);
  });

  it('plays a restored round on exactly as the saved one would have', () => {
    const s = played();
    const t = roundTrip(s);
    for (let i = 0; i < 6; i++) {
      const tile = R.hintTile(s);
      expect(R.hintTile(t)).toBe(tile);
      if (tile === null) break;
      expect(R.take(t, tile)).toEqual(R.take(s, tile));
      expect(t.current?.round).toEqual(s.current?.round);
    }
    expect(R.applyTool(t, 'rollingpin')).toEqual(R.applyTool(s, 'rollingpin'));
    expect(t.current?.round).toEqual(s.current?.round);
  });

  it('lets go of a round whose pastries cannot be: of no kind, too many or too few, or three of a kind left on the tray', () => {
    const s = played();
    const back = (change: (round: Data['current']['round']) => void) => {
      const data = dataOf(s);
      change(data.current.round);
      return restoreState(data).current;
    };
    expect(back(() => undefined)).not.toBeNull();
    expect(back((r) => r.kinds.pop())).toBeNull();
    expect(back((r) => (r.kinds[0] = 16))).toBeNull();
    expect(back((r) => (r.kinds[0] = 'donut'))).toBeNull();
    expect(back((r) => (r.at = r.at.slice(1)))).toBeNull();
    // One pastry turned into another leaves a set short.
    expect(
      back((r) => {
        const i = r.at.indexOf('counter');
        r.kinds[i] = ((r.kinds[i] as number) + 1) % PASTRIES.length;
      }),
    ).toBeNull();
    // A tile on the tray that the tray does not list, or more on the tray than it holds.
    expect(back((r) => (r.tray = r.tray.slice(1)))).toBeNull();
    expect(
      back((r) => {
        r.at = r.at.map((p) => (p === 'counter' ? 'tray' : p));
      }),
    ).toBeNull();
  });

  it('lets go of a round with three of a kind on the tray, which would have been boxed up', () => {
    const s = createState(T0);
    R.startLevel(s, 1);
    const data = dataOf(s);
    const r = data.current.round;
    const kind = r.kinds[0];
    const three = r.kinds.flatMap((k, i) => (k === kind ? [i] : []));
    for (const t of three) r.at[t] = 'tray';
    r.tray = three;
    expect(restoreState(data).current).toBeNull();
    // Two of them are fine.
    r.at[three[2] as number] = 'counter';
    r.tray = three.slice(0, 2);
    expect(restoreState(data).current?.round.tray).toEqual(three.slice(0, 2));
  });

  it('lets go of a round it cannot read, one at a level not open, and one already cleared', () => {
    const s = played();
    const broken = dataOf(s);
    broken.current.round.kinds = [];
    expect(restoreState(broken).current).toBeNull();
    const closed = dataOf(s);
    closed.current.level = 50;
    expect(restoreState(closed).current).toBeNull();
    const daily = dataOf(s);
    daily.current.mode = 'daily';
    daily.current.day = 'not a day';
    expect(restoreState(daily).current).toBeNull();
    const won = dataOf(s);
    won.current.round.at = won.current.round.at.map(() => 'gone');
    won.current.round.tray = [];
    won.current.round.rack = [];
    expect(restoreState(won).current).toBeNull();
    // The rest of the save is kept.
    expect(restoreState(won).stars).toEqual([3, 3]);
  });

  it('counts the sets and sprinkles from the tiles boxed up, and rebuilds where the tray’s pastries came from', () => {
    const s = played();
    const data = dataOf(s);
    data.current.round.sets = 40;
    data.current.round.sprinkled = 12;
    data.current.round.taken = [{ tile: 'x' }, 7];
    data.current.round.peak = 99;
    const r = restoreState(data).current?.round;
    expect(r?.sets).toBe(s.current?.round.sets);
    expect(r?.sprinkled).toBe(0);
    expect(r?.taken).toEqual(r?.tray.map((tile) => ({ tile, from: 'counter' })));
    expect(r?.peak).toBe(TRAY);
    data.current.round.peak = 0;
    expect(restoreState(data).current?.round.peak).toBe(r?.tray.length);
  });

  it('keeps stars between one and three, and a pocket between empty and full', () => {
    const data = dataOf(played());
    data.stars = [3, 0, 9, 'x'];
    data.tools = { spatula: -4, rollingpin: 1e9, whisk: 'many' };
    const back = restoreState(data);
    expect(back.stars).toEqual([3, 1, 3, 1]);
    expect(back.tools).toEqual({ spatula: 0, rollingpin: C.MAX_TOOLS, whisk: C.START_TOOLS.whisk });
  });

  it('starts over cleanly from a save that is all junk', () => {
    const junk = { coins: 'lots', stars: 'all', current: 7, daily: [], result: 'won', tools: null, looks: 3, tips: [1, 'bag', 'nope'], stats: 'x' };
    const s = restoreState(junk);
    expect(s.coins).toBe(0);
    expect(s.stars).toEqual([]);
    expect(s.current).toBeNull();
    expect(s.result).toBeNull();
    expect(s.tools).toEqual(C.START_TOOLS);
    expect(s.looks).toEqual({ tiles: 'cream', season: 'spring', bought: [] });
    expect(s.tips).toEqual(['bag']);
  });

  it('can owe sugar after a refund', () => {
    const data = dataOf(played());
    data.coins = -300;
    expect(restoreState(data).coins).toBe(-300);
  });
});
