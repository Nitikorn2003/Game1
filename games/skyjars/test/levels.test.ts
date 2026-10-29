import { describe, expect, it } from 'vitest';
import * as J from '../src/sim/jars.js';
import { CAPACITY, MAX_COLOURS, TALL_CAPACITY, dailySpec, makeDaily, makeLevel, specOf } from '../src/sim/levels.js';

/** Plays a level's known solution on a copy and says whether it ends solved. */
function solvedBy(made: ReturnType<typeof makeLevel>): boolean {
  const p = J.copy(made.puzzle);
  const solution = J.solve(p);
  if (!solution) return false;
  for (const [from, to] of solution.moves) if (J.pour(p, from, to) === 0) return false;
  return J.solved(p);
}

describe('the levels', () => {
  it('starts with a level that teaches pouring in three pours', () => {
    const first = makeLevel(1);
    expect(first.par).toBe(3);
    expect(first.puzzle.jars).toEqual([[0, 0, 0, 1], [1, 1, 1, 0], []]);
    expect(solvedBy(first)).toBe(true);
  });

  it('adds a colour every five levels up to ten, with breathers and tall jars later on', () => {
    expect(specOf(2)).toEqual({ colours: 3, capacity: CAPACITY, empty: 2 });
    expect(specOf(6).colours).toBe(3);
    expect(specOf(7).colours).toBe(4);
    expect(specOf(29).colours).toBe(8);
    expect(specOf(30)).toEqual({ colours: 6, capacity: CAPACITY, empty: 2 });
    expect(specOf(36)).toEqual({ colours: 7, capacity: TALL_CAPACITY, empty: 2 });
    expect(specOf(37).colours).toBe(MAX_COLOURS);
    expect(specOf(501).colours).toBe(MAX_COLOURS);
    let last = 0;
    for (let level = 2; level < 30; level++) {
      expect(specOf(level).colours).toBeGreaterThanOrEqual(last);
      last = specOf(level).colours;
    }
  });

  it('makes the same shelf for a level every time', () => {
    expect(makeLevel(57)).toEqual(makeLevel(57));
    expect(makeLevel(57).puzzle.jars).not.toEqual(makeLevel(58).puzzle.jars);
  });

  it('makes only fair shelves: mixed, of the right size, and solvable', () => {
    const started = performance.now();
    for (let level = 1; level <= 300; level++) {
      const made = makeLevel(level);
      const spec = specOf(level);
      const p = made.puzzle;
      expect(J.wellFormed(p), `level ${String(level)}`).toBe(true);
      expect(J.colourCount(p)).toBe(spec.colours);
      expect(p.capacity).toBe(spec.capacity);
      expect(p.jars.length).toBeGreaterThanOrEqual(spec.colours + spec.empty);
      expect(p.jars.some((jar) => J.complete(jar, p.capacity)), `level ${String(level)} starts with a full jar`).toBe(false);
      expect(solvedBy(made), `level ${String(level)}`).toBe(true);
    }
    // Making a level is quick enough to do when it opens: all 300 take well under a second here.
    expect(performance.now() - started).toBeLessThan(5000);
  });

  it('deals the same daily sky to everyone on a day, and another one the next day', () => {
    expect(makeDaily('2026-10-29')).toEqual(makeDaily('2026-10-29'));
    expect(makeDaily('2026-10-29').puzzle.jars).not.toEqual(makeDaily('2026-10-30').puzzle.jars);
    for (let d = 1; d <= 60; d++) {
      const day = new Date(Date.UTC(2026, 10, d)).toISOString().slice(0, 10);
      const spec = dailySpec(day);
      expect(spec.colours).toBeGreaterThanOrEqual(7);
      expect(spec.colours).toBeLessThanOrEqual(9);
      const made = makeDaily(day);
      expect(J.colourCount(made.puzzle)).toBe(spec.colours);
      expect(solvedBy(made), day).toBe(true);
    }
  });
});
