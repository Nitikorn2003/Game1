import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { T0, at, newGame, tapUntilDepth, withLodeling } from './helpers.js';

describe('a new game', () => {
  it('starts at depth 1 with a starter egg that hatches into a starter creature', () => {
    const s = newGame();
    expect(s.depth).toBe(1);
    expect(s.hp).toBe(C.BALANCE.baseBlockHp);
    expect(R.eggReady(s, 0, T0 + 9_000)).toBe(false);
    expect(R.hatch(s, at(T0 + 9_000), 0)).toBeNull();
    const c = at(T0 + 10_000);
    const species = R.hatch(s, c, 0);
    expect(C.STARTER_SPECIES).toContain(species);
    expect(s.team).toEqual([species]);
    expect(c.events).toContainEqual({ type: 'hatch', species, isNew: true, stars: 0, gems: 0 });
  });
});

describe('mining', () => {
  it('breaks rocks for ore and goes one depth down every ten rocks', () => {
    const s = newGame();
    const c = at(T0);
    for (let i = 0; i < 5; i++) R.tap(s, c);
    expect(s.block).toBe(1);
    expect(s.ore).toBeCloseTo(R.blockOre(1));
    expect(c.events.filter((e) => e.type === 'block')).toHaveLength(1);
    tapUntilDepth(s, 2);
    expect(s.depth).toBe(2);
    expect(s.block).toBe(0);
    // A critical last tap may already have chipped the first rock of depth 2.
    expect(s.hp).toBeGreaterThan(0);
    expect(s.hp).toBeLessThanOrEqual(R.blockHp(2));
    expect(s.stats.blocks).toBe(10);
  });

  it('lets the team mine on its own and carries overkill into the next rocks', () => {
    const s = withLodeling('emberkit', 40);
    const c = at(T0);
    R.step(s, c, 1);
    // 40 levels of a common deal far more than a few depth-1 rocks in one second.
    expect(s.stats.blocks).toBeGreaterThan(5);
    expect(s.depth).toBeGreaterThan(1);
  });

  it('never carries overkill from rocks into a Guardian', () => {
    const s = withLodeling('emberkit', 2000);
    s.depth = 5;
    s.hp = R.blockHp(5);
    const c = at(T0);
    R.step(s, c, 0.1);
    expect(s.guardian).not.toBeNull();
    expect(s.hp).toBe(R.guardianHp(5));
  });

  it('scales rock HP by bands and keeps it finite very deep', () => {
    expect(R.blockHp(2) / R.blockHp(1)).toBeCloseTo(1.36);
    expect(R.blockHp(82) / R.blockHp(81)).toBeCloseTo(1.25);
    expect(Number.isFinite(R.blockHp(5000))).toBe(true);
    expect(Number.isFinite(R.blockOre(5000))).toBe(true);
  });

  it('counts critical taps and their damage', () => {
    const s = newGame(3);
    s.gear.lamp = 26;
    expect(R.critChance(s)).toBeCloseTo(0.3);
    const c = at(T0);
    for (let i = 0; i < 2000; i++) R.tap(s, c);
    const hits = c.events.filter((e) => e.type === 'hit');
    const crits = hits.filter((e) => e.crit);
    expect(crits.length / hits.length).toBeGreaterThan(0.25);
    expect(crits.length / hits.length).toBeLessThan(0.35);
  });
});

describe('Guardians', () => {
  function atGuardian() {
    const s = withLodeling('drizzlet', 1);
    s.depth = 5;
    s.maxDepth = 5;
    s.bestDepth = 5;
    s.block = 8;
    s.hp = 0.0001;
    return s;
  }

  it('appear after nine rocks on every fifth depth with a timer', () => {
    const s = atGuardian();
    const c = at(T0);
    R.tap(s, c);
    expect(s.guardian).toEqual({ endsAt: T0 + 30_000, maxHp: R.guardianHp(5), retried: false });
    expect(c.events).toContainEqual({ type: 'guardian_start', depth: 5 });
  });

  it('send the player back to mining when time runs out, until they challenge again', () => {
    const s = atGuardian();
    R.tap(s, at(T0));
    const c = at(T0 + 30_000);
    R.step(s, c, 0.1);
    expect(s.guardian).toBeNull();
    expect(s.farming).toBe(true);
    expect(s.depth).toBe(5);
    expect(c.events).toContainEqual({ type: 'guardian_lost', depth: 5 });
    // While farming, the rocks loop instead of starting the Guardian again.
    s.block = 8;
    s.hp = 0.0001;
    R.tap(s, at(T0 + 31_000));
    expect(s.guardian).toBeNull();
    expect(s.block).toBe(0);
    expect(R.startGuardian(s, at(T0 + 32_000))).toBe(true);
    expect(s.guardian?.endsAt).toBe(T0 + 62_000);
  });

  it('pay ore, first-win gems and a geode on tens, and only pay the gems once', () => {
    const s = atGuardian();
    s.depth = 10;
    s.maxDepth = 10;
    R.tap(s, at(T0));
    s.hp = 0.0001;
    const gemsBefore = s.gems;
    const c = at(T0 + 1000);
    R.tap(s, c);
    const won = c.events.find((e) => e.type === 'guardian_won');
    expect(won).toMatchObject({ depth: 10, gems: 3, egg: 'geode', first: true });
    expect(s.depth).toBe(11);
    expect(s.gems - gemsBefore).toBe(3);
    expect(s.guardiansBeaten).toEqual([10]);
    // Beating the same Guardian again after resurfacing pays no first-win gems.
    s.depth = 10;
    s.block = 8;
    s.hp = 0.0001;
    s.eggs = new Array<C.EggKind>(C.EGG_STORAGE).fill('pebble');
    R.tap(s, at(T0 + 2000));
    s.hp = 0.0001;
    const before = s.gems;
    const again = at(T0 + 3000);
    R.tap(s, again);
    const second = again.events.find((e) => e.type === 'guardian_won');
    if (second?.type !== 'guardian_won') throw new Error('the Guardian was not beaten');
    expect(second.first).toBe(false);
    // No first-win gems; a geode that does not fit in the full basket becomes 5 gems.
    expect([0, 5]).toContain(second.gems);
    expect(s.gems - before).toBe(second.gems);
  });

  it('take element advantage into account', () => {
    expect(C.elementMultiplier('tide', 'ember')).toBe(C.ADVANTAGE);
    expect(C.elementMultiplier('ember', 'tide')).toBe(C.DISADVANTAGE);
    expect(C.elementMultiplier('ember', 'volt')).toBe(1);
    expect(C.weaknessOf('ember')).toBe('tide');
    for (const e of C.ELEMENTS) expect(C.elementMultiplier(C.weaknessOf(e), e)).toBe(C.ADVANTAGE);
    const s = withLodeling('drizzlet', 10);
    const rock = R.teamDps(s, T0, null);
    expect(R.teamDps(s, T0, 'ember')).toBeCloseTo(rock * C.ADVANTAGE);
    expect(R.teamDps(s, T0, 'volt')).toBeCloseTo(rock * C.DISADVANTAGE);
  });

  it('cycle elements and names', () => {
    expect(R.guardianElement(5)).toBe('tide');
    expect(R.guardianElement(10)).toBe('grove');
    expect(R.guardianElement(20)).toBe('ember');
    expect(R.guardianName(20)).toBe('Slagback');
    expect(R.guardianName(5)).toBe('Tidewall Golem');
  });

  it('can be retried with extra time after a loss through a rewarded ad', () => {
    const s = atGuardian();
    R.tap(s, at(T0));
    R.step(s, at(T0 + 30_000), 0.1);
    expect(R.adOffered(s, 'guardian_retry', at(T0 + 31_000))).toBe(true);
    expect(R.grantAdReward(s, at(T0 + 31_000), 'guardian_retry')).toBe(true);
    expect(s.guardian).toEqual({ endsAt: T0 + 31_000 + 45_000, maxHp: R.guardianHp(5), retried: true });
    expect(R.adOffered(s, 'guardian_retry', at(T0 + 32_000))).toBe(false);
  });
});

describe('spending ore', () => {
  it('levels Lodelings at geometric prices and buys the most it can with max', () => {
    const s = withLodeling('emberkit', 1);
    const base = C.RARITY_STATS.common.levelCost;
    expect(R.levelCost(s, 'emberkit', 1)).toBeCloseTo(base);
    expect(R.levelCost(s, 'emberkit', 2)).toBeCloseTo(base + base * C.BALANCE.levelCostGrowth);
    expect(R.levelUp(s, 'emberkit', 1)).toBe(0);
    s.ore = base * 16;
    const bought = R.levelUp(s, 'emberkit', 'max');
    expect(bought).toBeGreaterThan(5);
    expect(s.ore).toBeGreaterThanOrEqual(0);
    expect(R.levelCost(s, 'emberkit', 1)).toBeGreaterThan(s.ore);
    expect(s.roster.emberkit?.level).toBe(1 + bought);
    expect(R.levelUp(s, 'nobody', 1)).toBe(0);
  });

  it('doubles creature damage at every 25 levels and adds stars', () => {
    expect(R.memberDps('emberkit', 24, 0)).toBe(24);
    expect(R.memberDps('emberkit', 25, 0)).toBe(50);
    expect(R.memberDps('solferno', 1, 2)).toBe(60);
    expect(R.memberDps('unknown', 10, 0)).toBe(0);
  });

  it('stops gear at its maximum level', () => {
    const s = newGame();
    s.ore = 1e30;
    expect(R.buyGear(s, 'lamp', 'max')).toBe(26);
    expect(R.buyGear(s, 'lamp', 1)).toBe(0);
    expect(R.gearCost(s, 'lamp', 1)).toBe(Infinity);
    expect(R.buyGear(s, 'echo', 30)).toBe(0);
    expect(R.buyGear(s, 'echo', 25)).toBe(25);
  });

  it('makes taps stronger with the pick and echo', () => {
    const s = withLodeling('emberkit', 10);
    const before = R.tapDamage(s, T0);
    s.gear.pick = 10;
    expect(R.tapDamage(s, T0)).toBeCloseTo(before + 20);
    s.gear.echo = 5;
    expect(R.tapDamage(s, T0)).toBeCloseTo(21 + 0.1 * R.teamDps(s, T0));
  });
});

describe('skills', () => {
  it('unlock by depth and respect cooldowns', () => {
    const s = withLodeling('emberkit', 5);
    expect(R.castSkill(s, at(T0), 'dynamite')).toBe(false);
    s.bestDepth = 3;
    expect(R.castSkill(s, at(T0), 'dynamite')).toBe(true);
    expect(R.castSkill(s, at(T0 + 39_000), 'dynamite')).toBe(false);
    expect(R.castSkill(s, at(T0 + 40_000), 'dynamite')).toBe(true);
    expect(s.stats.skills).toBe(2);
  });

  it('deal their effects', () => {
    const s = withLodeling('emberkit', 30);
    s.bestDepth = 30;
    const c = at(T0);
    const dps = R.teamDps(s, T0);
    R.castSkill(s, c, 'dynamite');
    const blast = c.events.find((e) => e.type === 'hit' && e.source === 'dynamite');
    expect(blast?.type === 'hit' && blast.amount).toBeCloseTo(Math.max(25 * R.tapDamage(s, T0), 8 * dps));
    R.castSkill(s, c, 'rally');
    expect(R.teamDps(s, T0 + 1000)).toBeCloseTo(dps * C.RALLY_MULTIPLIER);
    expect(R.teamDps(s, T0 + 20_000)).toBeCloseTo(dps);
    const ore = R.oreMultiplier(s, T0);
    R.castSkill(s, c, 'goldrush');
    expect(R.oreMultiplier(s, T0 + 1)).toBeCloseTo(ore * 3);
  });

  it('frenzy taps ten times a second for ten seconds', () => {
    const s = withLodeling('emberkit', 1);
    s.team = [];
    s.bestDepth = 8;
    R.castSkill(s, at(T0), 'frenzy');
    let hits = 0;
    for (let i = 1; i <= 120; i++) {
      const c = at(T0 + i * 100);
      R.step(s, c, 0.1);
      hits += c.events.filter((e) => e.type === 'hit' && e.source === 'frenzy').length;
    }
    expect(hits).toBe(100);
    expect(s.stats.taps).toBe(0);
  });

  it('can be reset with gems only while one is cooling down', () => {
    const s = withLodeling('emberkit', 1);
    s.bestDepth = 3;
    s.gems = 100;
    expect(R.resetSkills(s, T0)).toBe(false);
    R.castSkill(s, at(T0), 'dynamite');
    expect(R.resetSkills(s, T0 + 1)).toBe(true);
    expect(s.gems).toBe(100 - C.SKILL_RESET_GEMS);
    expect(R.castSkill(s, at(T0 + 2), 'dynamite')).toBe(true);
  });
});
