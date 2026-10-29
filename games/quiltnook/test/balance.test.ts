import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import * as Q from '../src/sim/quilt.js';
import { greedyBot, median, randomBot, sewQuilt } from './helpers.js';

/**
 * The game's balance, measured with play-bots on fixed seeds. The greedy bot looks one patch
 * ahead, like a player who does not plan; people who plan do better. If a change to the rules
 * moves these numbers, the targets and prices in content.ts need another look.
 */
const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i);
const greedy = SEEDS.map((seed) => sewQuilt(Q.newQuilt('endless', null, seed), greedyBot));
const careless = SEEDS.map((seed) => sewQuilt(Q.newQuilt('endless', null, seed), randomBot(seed)));
const share = (quilts: readonly Q.Quilt[], pass: (q: Q.Quilt) => boolean) => quilts.filter(pass).length / quilts.length;
const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

describe('the balance', () => {
  it('lets a quilt last: dozens of patches for a player who looks one patch ahead', () => {
    expect(median(greedy.map((q) => q.patches))).toBeGreaterThanOrEqual(40);
    expect(median(greedy.map((q) => q.patches))).toBeLessThan(300);
    // Even placing patches anywhere gives a short game, not an instant loss.
    expect(median(careless.map((q) => q.patches))).toBeGreaterThanOrEqual(10);
  });

  it('rewards care: thinking ahead scores far more than placing patches anywhere', () => {
    expect(median(greedy.map((q) => q.score))).toBeGreaterThan(5 * median(careless.map((q) => q.score)));
  });

  it('pays enough spools a quilt for a tool now and then', () => {
    const spools = greedy.map((q) => Math.floor(q.score / C.POINTS_PER_SPOOL) + q.spools);
    expect(median(spools)).toBeGreaterThanOrEqual(C.TOOL_COSTS.snip / 2);
    expect(median(spools)).toBeLessThanOrEqual(3 * C.TOOL_COSTS.unpick);
  });

  it('sets daily targets that take an effort, without being out of reach', () => {
    const easiest = Math.min(...C.DAILY_TARGETS);
    const hardest = Math.max(...C.DAILY_TARGETS);
    expect(share(greedy, (q) => q.score >= easiest)).toBeGreaterThanOrEqual(0.4);
    expect(share(greedy, (q) => q.score >= easiest)).toBeLessThan(0.9);
    expect(share(greedy, (q) => q.score >= hardest)).toBeGreaterThanOrEqual(0.2);
  });

  it('asks the first commissions for what a few quilts do', () => {
    const counting = { seams: (q: Q.Quilt) => q.seams, perfect: (q: Q.Quilt) => q.perfect, doubles: (q: Q.Quilt) => q.doubles, patches: (q: Q.Quilt) => q.patches };
    for (const [kind, count] of Object.entries(counting)) {
      const target = C.COMMISSION_TARGETS[kind as keyof typeof counting][0];
      expect(mean(greedy.map(count)) * 3, kind).toBeGreaterThanOrEqual(target);
    }
    // Best-of commissions: one quilt in four reaches the first target, one in ten the last.
    expect(share(greedy, (q) => q.score >= C.COMMISSION_TARGETS.score[0])).toBeGreaterThanOrEqual(0.25);
    expect(share(greedy, (q) => q.bestStreak >= C.COMMISSION_TARGETS.streak[0])).toBeGreaterThanOrEqual(0.25);
    expect(share(greedy, (q) => q.score >= C.COMMISSION_TARGETS.score[2])).toBeGreaterThanOrEqual(0.1);
    expect(share(greedy, (q) => q.bestStreak >= C.COMMISSION_TARGETS.streak[2])).toBeGreaterThanOrEqual(0.1);
  });
});
