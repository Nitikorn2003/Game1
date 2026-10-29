import { localDayKey } from '@game1/engine';
import * as R from '../src/sim/rules.js';
import { createState, type GameState } from '../src/sim/state.js';

export const T0 = Date.UTC(2026, 9, 29, 3, 0, 0);

export function newGame(seed = 1): GameState {
  return createState(T0, seed, R.blockHp(1));
}

export function at(ms: number): R.Ctx {
  return R.ctx(ms, localDayKey(ms, 0));
}

/** A game with one owned Lodeling in the team. */
export function withLodeling(id = 'emberkit', level = 1, seed = 1): GameState {
  const s = newGame(seed);
  s.incubators = [null];
  s.roster[id] = { level, stars: 0 };
  s.team = [id];
  return s;
}

/** Taps until the depth changes or `limit` taps were made. */
export function tapUntilDepth(s: GameState, depth: number, now = T0, limit = 100_000): number {
  let taps = 0;
  while (s.depth < depth && taps < limit) {
    R.tap(s, at(now));
    taps += 1;
  }
  return taps;
}
