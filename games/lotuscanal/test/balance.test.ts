import { Rng } from '@game1/engine';
import { describe, expect, it } from 'vitest';
import { makeDaily, makeLevel } from '../src/sim/levels.js';
import { apply, playable, startTable, won, type Dealt } from '../src/sim/table.js';

/**
 * Difficulty, measured with a careless player who plays any card that fits and draws when
 * none does. Every deal can be cleared by careful play (deal.test.ts); these numbers say how
 * much a careless play costs as the levels go on.
 */
function carelessWins(dealt: Dealt, rng: Rng): boolean {
  const t = startTable(dealt);
  for (;;) {
    if (won(t)) return true;
    const options = playable(t);
    if (options.length > 0) apply(t, { kind: 'play', spot: rng.pick(options) });
    else if (!apply(t, { kind: 'draw' })) return false;
  }
}

function winRate(levels: readonly [number, number]): number {
  let wins = 0;
  let games = 0;
  for (let level = levels[0]; level <= levels[1]; level++) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const dealt = makeLevel(level, attempt).dealt;
      const rng = new Rng(level * 31 + attempt);
      for (let game = 0; game < 8; game++) {
        games += 1;
        if (carelessWins(dealt, rng)) wins += 1;
      }
    }
  }
  return wins / games;
}

describe('the difficulty', () => {
  const opening = winRate([1, 10]);
  const early = winRate([11, 30]);
  const later = winRate([31, 120]);

  it('lets even a careless player clear most of the first levels', () => {
    expect(opening).toBeGreaterThan(0.55);
  });

  it('asks for more care as the levels go on, without becoming a matter of luck', () => {
    expect(early).toBeLessThan(opening);
    expect(later).toBeLessThan(opening - 0.08);
    expect(later).toBeGreaterThan(0.35);
  });

  it('makes the daily deal about as hard as the early levels', () => {
    let wins = 0;
    let games = 0;
    for (let d = 0; d < 30; d++) {
      const day = new Date(Date.UTC(2026, 9, 1) + d * 86_400_000).toISOString().slice(0, 10);
      const dealt = makeDaily(day, 0).dealt;
      const rng = new Rng(d);
      for (let game = 0; game < 8; game++) {
        games += 1;
        if (carelessWins(dealt, rng)) wins += 1;
      }
    }
    expect(wins / games).toBeGreaterThan(later - 0.05);
    expect(wins / games).toBeLessThan(opening + 0.05);
  });
});
