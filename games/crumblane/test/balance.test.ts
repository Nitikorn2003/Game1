import { describe, expect, it } from 'vitest';
import { winRate } from '../src/sim/bot.js';
import { ZONES, dailyLevel, levelAt, levelsOf, seedOf, type ZoneId } from '../src/sim/levels.js';
import { DAY, dayAfter } from './helpers.js';

/**
 * Difficulty, measured with the bot in sim/bot.ts, a casual player who never plans ahead, never
 * uses a tool and does not see every tile, on deals it was not tuned on. The kinds of each level
 * were tuned so that the bot clears about this share of tries in each shop: nearly always in the
 * Bread Corner, and about six in ten in the Cake Hall, so a player who looks around and keeps a
 * tool for a tight spot clears most counters.
 */
const TARGETS: Readonly<Record<ZoneId, number>> = {
  bread: 0.98,
  cafe: 0.94,
  cookies: 0.88,
  cupcakes: 0.82,
  pies: 0.8,
  donuts: 0.75,
  chocolate: 0.68,
  cakes: 0.6,
};

const seeds = (key: string, n: number) => Array.from({ length: n }, (_, i) => seedOf(key, i));
const average = (xs: readonly number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
const zoneRate = (zone: ZoneId) => average(levelsOf(zone).map((n) => winRate(levelAt(n), seeds(`level:${String(n)}`, 8))));

describe('the difficulty', () => {
  const rates = Object.fromEntries(ZONES.map((zone) => [zone, zoneRate(zone)])) as Record<ZoneId, number>;

  it('lets the bot clear about the share of each shop’s counters the kinds were tuned for', () => {
    for (const zone of ZONES) {
      expect(rates[zone], zone).toBeGreaterThan(TARGETS[zone] - 0.15);
      expect(rates[zone], zone).toBeLessThan(Math.min(1.01, TARGETS[zone] + 0.15));
    }
  });

  it('asks for more as the shops go on', () => {
    expect(rates.cakes).toBeLessThan(rates.bread - 0.2);
    const first = average(ZONES.slice(0, 4).map((zone) => rates[zone]));
    const last = average(ZONES.slice(4).map((zone) => rates[zone]));
    expect(last).toBeLessThan(first - 0.08);
  });

  it('keeps the late shift about as hard as the later shops', () => {
    const late = average(Array.from({ length: 24 }, (_, i) => 97 + i * 3).map((n) => winRate(levelAt(n), seeds(`level:${String(n)}`, 4))));
    expect(late).toBeGreaterThan(0.45);
    expect(late).toBeLessThan(0.9);
  });

  it('makes the daily special a little kinder than the lane past its first shop', () => {
    const days = Array.from({ length: 30 }, (_, i) => dayAfter(DAY, i));
    const daily = average(days.map((day) => winRate(dailyLevel(day), seeds(`daily:${day}`, 4))));
    const lane = average(ZONES.slice(1).map((zone) => rates[zone]));
    expect(daily).toBeGreaterThan(lane);
    expect(daily).toBeLessThan(0.99);
  });
});
