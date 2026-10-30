import { describe, expect, it } from 'vitest';
import { botPick, botPlay, winRate } from '../src/sim/bot.js';
import { levelAt, seedOf } from '../src/sim/levels.js';
import { copyRound, isWon, startRound, take } from '../src/sim/round.js';
import { levelWith, roundWith, row } from './helpers.js';

describe('the bot', () => {
  it('finishes a set when it can, and otherwise starts one it can see the rest of', () => {
    const level = levelWith(row(9));
    const r = roundWith([0, 1, 2, 0, 1, 2, 0, 1, 2]);
    expect(botPick(r, level)).toBe(0);
    take(r, level, 0);
    take(r, level, 3);
    expect(botPick(r, level)).toBe(6);
  });

  it('takes nothing from a full tray or a cleared counter', () => {
    const level = levelWith(row(21), { kinds: 7 });
    const r = roundWith(Array.from({ length: 21 }, (_, i) => i % 7));
    for (let tile = 0; tile < 7; tile++) take(r, level, tile);
    expect(botPick(r, level)).toBeNull();
    const done = roundWith([0, 0, 0]);
    const flat = levelWith(row(3));
    for (let tile = 0; tile < 3; tile++) take(done, flat, tile);
    expect(isWon(done)).toBe(true);
    expect(botPick(done, flat)).toBeNull();
  });

  it('seeing every tile, as the hint does, clears the first shop’s counters', () => {
    for (let n = 1; n <= 12; n++) {
      const level = levelAt(n);
      for (let k = 0; k < 4; k++) {
        const r = copyRound(startRound(level, seedOf(`level:${String(n)}`, k)));
        for (let i = 0; i < level.slots.length; i++) {
          const tile = botPick(r, level);
          if (tile === null) break;
          take(r, level, tile);
        }
        expect(isWon(r), `level ${String(n)}, try ${String(k)}`).toBe(true);
      }
    }
  });

  it('plays a deal the same way every time', () => {
    const level = levelAt(40);
    expect(botPlay(level, 5)).toEqual(botPlay(level, 5));
    expect(winRate(level, [])).toBe(0);
  });
});
