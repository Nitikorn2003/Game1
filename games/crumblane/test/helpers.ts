import type { Slot } from '../src/sim/counter.js';
import { dealOf, type Level, type Place, type Round } from '../src/sim/round.js';
import * as R from '../src/sim/rules.js';
import type { GameState, RoundResult } from '../src/sim/state.js';

export const T0 = Date.UTC(2026, 9, 30, 3, 0, 0);
export const DAY = '2026-10-30';

/** The day after `day`, or `n` days after it. */
export function dayAfter(day: string, n = 1): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Tiles side by side on the bottom layer, from the left: nothing covers any of them. */
export function row(n: number, y = 0, z = 0): Slot[] {
  return Array.from({ length: n }, (_, i) => ({ x: 2 * i, y, z }));
}

/** A level of these tiles and nothing special, unless asked. */
export function levelWith(slots: readonly Slot[], extra: Partial<Omit<Level, 'slots'>> = {}): Level {
  return {
    slots,
    kinds: 3,
    bags: slots.map(() => false),
    locks: slots.map(() => 0),
    sprinkles: slots.map(() => false),
    mix: 0.5,
    dig: 0.3,
    ...extra,
  };
}

/** A round with these pastries, every tile on the counter. */
export function roundWith(kinds: readonly number[]): Round {
  return {
    kinds: [...kinds],
    at: kinds.map((): Place => 'counter'),
    tray: [],
    rack: [],
    taken: [],
    peak: 0,
    sets: 0,
    sprinkled: 0,
    continues: 0,
    rolls: 0,
    seed: 1,
  };
}

/** The pastries of tiles, by kind. */
export const kindsOf = (r: Round, tiles: readonly number[]): number[] => tiles.map((t) => r.kinds[t] ?? -1);

/** How many of each pastry are still to box up, wherever they are. */
export function pastriesLeft(r: Round): Record<number, number> {
  const count: Record<number, number> = {};
  r.at.forEach((p, i) => {
    if (p !== 'gone') count[r.kinds[i] ?? -1] = (count[r.kinds[i] ?? -1] ?? 0) + 1;
  });
  return count;
}

/** Clears the counter of the round in progress along the way its deal was made: three stars. */
export function playToWin(s: GameState): RoundResult {
  const c = s.current;
  if (!c) throw new Error('no round in progress');
  const level = R.currentLevel(s);
  if (!level) throw new Error('no level');
  for (const tile of dealOf(level, c.round.seed).order) {
    if (c.round.at[tile] !== 'counter') continue;
    const took = R.take(s, tile);
    if (!took) throw new Error(`tile ${String(tile)} could not be taken`);
    if (took.result) return took.result;
  }
  throw new Error('the counter was not cleared');
}

/** Whisks up the rest of the round in progress, a set at a time, with whisks enough for it. */
export function whiskToWin(s: GameState): RoundResult {
  s.tools.whisk = 999;
  for (let i = 0; i < 100 && s.current; i++) {
    const use = R.applyTool(s, 'whisk');
    if (!use) throw new Error('the whisk did nothing');
    if (use.result) return use.result;
  }
  throw new Error('the counter was not cleared');
}

/**
 * Fills the tray of the round in progress with pastries from the counter, two of a kind at
 * most so that none box up, wherever they are: a full tray, the newest pastry last.
 */
export function jam(s: GameState): number[] {
  const r = s.current?.round;
  if (!r) throw new Error('no round in progress');
  const moved: number[] = [];
  const onTray = (kind: number) => r.tray.filter((t) => r.kinds[t] === kind).length;
  for (let i = 0; i < r.at.length && r.tray.length < 7; i++) {
    const kind = r.kinds[i] ?? -1;
    if (r.at[i] !== 'counter' || onTray(kind) >= 2) continue;
    r.at[i] = 'tray';
    const last = r.tray.findLastIndex((t) => r.kinds[t] === kind);
    r.tray.splice(last < 0 ? r.tray.length : last + 1, 0, i);
    r.taken.push({ tile: i, from: 'counter' });
    moved.push(i);
  }
  r.peak = Math.max(r.peak, r.tray.length);
  if (!R.isStuck(s)) throw new Error('the tray is not full');
  return moved;
}

/** A save in which every level before `n` was cleared, with `stars` stars each. */
export function reachedTo(s: GameState, n: number, stars = 3): GameState {
  s.stars = new Array<number>(n - 1).fill(stars);
  return s;
}
