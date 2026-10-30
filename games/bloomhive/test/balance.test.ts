import { describe, expect, it } from 'vitest';
import { winRate } from '../src/sim/bot.js';
import { ZONES, dailyLevel, levelAt, levelsOf, seedOf, type ZoneId } from '../src/sim/levels.js';
import { DAY, dayAfter } from './helpers.js';

/**
 * Difficulty, measured with the bot in sim/bot.ts, a player who never plans ahead and never uses
 * a tool, on colours it was not tuned on. The pollen of each level was tuned so that the bot
 * reaches the goals on about this share of tries in each zone: nearly always on the clover lawn,
 * and a little more than half the time in the Queen's garden, so a player who thinks ahead has
 * pollen to spare.
 */
const TARGETS: Readonly<Record<ZoneId, number>> = {
  clover: 0.97,
  sunflower: 0.85,
  hollow: 0.8,
  orchard: 0.75,
  dandelion: 0.72,
  butterfly: 0.68,
  moonlit: 0.64,
  queen: 0.6,
};

const seeds = (key: string, n: number) => Array.from({ length: n }, (_, i) => seedOf(key, i));
const average = (xs: readonly number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
const zoneRate = (zone: ZoneId) => average(levelsOf(zone).map((n) => winRate(levelAt(n), seeds(`level:${String(n)}`, 8))));

describe('the difficulty', () => {
  const rates = Object.fromEntries(ZONES.map((zone) => [zone, zoneRate(zone)])) as Record<ZoneId, number>;

  it('lets the bot reach about the share of each zone’s levels the pollen was tuned for', () => {
    for (const zone of ZONES) {
      expect(rates[zone], zone).toBeGreaterThan(TARGETS[zone] - 0.15);
      expect(rates[zone], zone).toBeLessThan(Math.min(1.01, TARGETS[zone] + 0.15));
    }
  });

  it('asks for more as the zones go on', () => {
    expect(rates.queen).toBeLessThan(rates.clover - 0.2);
    const first = average(ZONES.slice(0, 4).map((zone) => rates[zone]));
    const last = average(ZONES.slice(4).map((zone) => rates[zone]));
    expect(last).toBeLessThan(first - 0.08);
  });

  it('keeps the wild meadow about as hard as the later zones', () => {
    const wild = average(Array.from({ length: 24 }, (_, i) => 97 + i * 3).map((n) => winRate(levelAt(n), seeds(`level:${String(n)}`, 4))));
    expect(wild).toBeGreaterThan(0.45);
    expect(wild).toBeLessThan(0.9);
  });

  it('makes the daily meadow a little kinder than the meadow past its first zone', () => {
    const days = Array.from({ length: 30 }, (_, i) => dayAfter(DAY, i));
    const daily = average(days.map((day) => winRate(dailyLevel(day), seeds(`daily:${day}`, 4))));
    expect(daily).toBeGreaterThan(0.7);
    expect(daily).toBeLessThan(0.99);
  });
});
