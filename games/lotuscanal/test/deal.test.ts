import { describe, expect, it } from 'vitest';
import { botPlay } from '../src/sim/bot.js';
import { DECK_SIZE } from '../src/sim/cards.js';
import { makeDeal, RESERVE, type Made } from '../src/sim/deal.js';
import { LAYOUTS, LAYOUT_IDS, parseLayout } from '../src/sim/layouts.js';
import { dailySpec, isBreather, levelSpec, makeDaily, makeLevel } from '../src/sim/levels.js';
import { replay, won } from '../src/sim/table.js';

const LEVELS = Array.from({ length: 150 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 9, 1) + i * 86_400_000).toISOString().slice(0, 10));

describe('the layouts', () => {
  it.each(LAYOUT_IDS)('%s fits a phone and starts with several cards face up', (id) => {
    const layout = LAYOUTS[id];
    // At most ten cards across and four card heights down.
    expect(layout.width).toBeLessThanOrEqual(20);
    expect(layout.height).toBeLessThanOrEqual(8);
    expect(layout.spots.length).toBeGreaterThanOrEqual(20);
    expect(layout.coveredBy.filter((on) => on.length === 0).length).toBeGreaterThanOrEqual(6);
    // Something lies on every card that is not on the bottom line.
    const bottom = Math.max(...layout.spots.map((s) => s.row));
    layout.spots.forEach((spot, i) => {
      for (const on of layout.coveredBy[i] ?? []) expect(layout.spots[on]?.row).toBe(spot.row + 1);
      if (spot.row < bottom) expect(layout.coveredBy[i]?.length, `${id} spot ${String(i)}`).toBeGreaterThan(0);
    });
  });

  it('lays each card on the cards half a card above it, as in three peaks', () => {
    const peaks = LAYOUTS.peaks3;
    expect(peaks.spots).toHaveLength(28);
    expect(peaks.coveredBy.filter((on) => on.length === 0)).toHaveLength(10);
    // The three tips each lie under two cards.
    expect(peaks.coveredBy.slice(0, 3).map((on) => on.length)).toEqual([2, 2, 2]);
    // The last card of the bottom line lies only on the last card of the line above.
    expect(peaks.covers[27]).toEqual([17]);
  });

  it('refuses a drawing it cannot read', () => {
    expect(() => parseLayout('peaks2', ['oo'])).toThrow(/on top of each other/);
    expect(() => parseLayout('peaks2', ['o x'])).toThrow(/"x"/);
  });
});

/** Every card of a deal, which must all differ. */
function allCards(made: Made): number[] {
  return [...made.dealt.cards, ...made.dealt.stock, ...made.dealt.reserve];
}

describe('dealing', () => {
  const levels = LEVELS.map((level) => ({ level, spec: levelSpec(level), made: makeLevel(level, 0) }));
  const dailies = DAYS.map((day) => ({ day, spec: dailySpec(day), made: makeDaily(day, 0) }));
  const every = [...levels, ...dailies];

  it('deals each card of the deck at most once', () => {
    for (const { made } of every) {
      const cards = allCards(made);
      expect(new Set(cards).size).toBe(cards.length);
      expect(cards.every((c) => Number.isInteger(c) && c >= 0 && c < DECK_SIZE)).toBe(true);
    }
  });

  it('gives the stock its runs and spare cards, and keeps ten cards back for More cards', () => {
    for (const { spec, made } of every) {
      expect(made.dealt.cards).toHaveLength(LAYOUTS[spec.layout].spots.length);
      expect(made.dealt.stock).toHaveLength(spec.runs + spec.spare);
      expect(made.dealt.reserve).toHaveLength(RESERVE);
    }
  });

  it('makes every deal one that can be cleared, with its spare cards left over', () => {
    for (const { spec, made } of every) {
      const { table, made: count } = replay(made.dealt, made.way);
      expect(count).toBe(made.way.length);
      expect(won(table)).toBe(true);
      expect(table.stock).toHaveLength(spec.spare);
    }
  });

  it('keeps only deals that a careful player who sees just the face-up cards clears', () => {
    for (const { made } of every) expect(botPlay(made.dealt).won).toBe(true);
  });

  it('deals the same for the same level, and anew after a lost deal', () => {
    expect(makeLevel(12, 0)).toEqual(makeLevel(12, 0));
    expect(makeLevel(12, 1).dealt).not.toEqual(makeLevel(12, 0).dealt);
    expect(makeDaily('2026-10-29', 0)).toEqual(makeDaily('2026-10-29', 0));
    expect(makeDaily('2026-10-30', 0).dealt).not.toEqual(makeDaily('2026-10-29', 0).dealt);
  });

  it('refuses a deal that needs more cards than a deck has', () => {
    expect(() => makeDeal({ layout: 'peaks4', runs: 20, spare: 5 }, 1)).toThrow(/more cards than a deck has/);
    expect(() => makeDeal({ layout: 'peaks2', runs: 0, spare: 2 }, 1)).toThrow();
  });

  it('starts gently: the first ten levels each bring a new shape, with more spare cards than later', () => {
    const opening = LEVELS.slice(0, 10).map((level) => levelSpec(level));
    expect(new Set(opening.map((spec) => spec.layout)).size).toBe(10);
    const late = LEVELS.slice(80).filter((level) => !isBreather(level));
    expect(Math.min(...opening.map((spec) => spec.spare))).toBeGreaterThan(Math.max(...late.map((level) => levelSpec(level).spare)));
  });
});
