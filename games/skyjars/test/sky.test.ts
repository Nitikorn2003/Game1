import { describe, expect, it } from 'vitest';
import { CONSTELLATIONS } from '../src/sim/content.js';
import { TOTAL_STARS, current, figureOf, locate, starsLit } from '../src/sim/sky.js';

describe('the sky atlas', () => {
  it('counts its stars constellation by constellation', () => {
    expect(TOTAL_STARS).toBe(191);
    expect(locate(0)).toEqual({ index: 0, star: 0 });
    expect(locate(2)).toEqual({ index: 0, star: 2 });
    expect(locate(3)).toEqual({ index: 1, star: 0 });
    expect(locate(TOTAL_STARS - 1)).toEqual({ index: CONSTELLATIONS.length - 1, star: 9 });
    expect(locate(TOTAL_STARS)).toBeNull();
    expect(locate(-1)).toBeNull();
    expect(starsLit(500)).toBe(TOTAL_STARS);
    expect(current(0)).toEqual({ index: 0, star: 0 });
    expect(current(TOTAL_STARS)).toBeNull();
  });

  it.each(CONSTELLATIONS.map((c) => c.id))('draws %s the same way every time, with its stars apart and joined', (id) => {
    const figure = figureOf(id);
    const stars = CONSTELLATIONS.find((c) => c.id === id)?.stars ?? 0;
    expect(figure.points).toHaveLength(stars);
    expect(figure.lines).toHaveLength(stars - 1);
    for (const [x, y] of figure.points) {
      expect(x).toBeGreaterThanOrEqual(0.1);
      expect(x).toBeLessThanOrEqual(0.9);
      expect(y).toBeGreaterThanOrEqual(0.1);
      expect(y).toBeLessThanOrEqual(0.9);
    }
    for (let a = 0; a < stars; a++) {
      for (let b = a + 1; b < stars; b++) {
        const [ax, ay] = figure.points[a] ?? [0, 0];
        const [bx, by] = figure.points[b] ?? [0, 0];
        expect(Math.hypot(ax - bx, ay - by)).toBeGreaterThan(0.08);
      }
    }
    // Star k joins a star lit before it, so a constellation grows as one figure.
    figure.lines.forEach(([from, to], i) => {
      expect(to).toBe(i + 1);
      expect(from).toBeLessThan(to);
    });
    expect(JSON.stringify(figureOf(id))).toBe(JSON.stringify(figure));
  });
});
