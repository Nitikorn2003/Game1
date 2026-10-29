import { describe, expect, it } from 'vitest';
import * as C from '../src/sim/content.js';
import * as R from '../src/sim/rules.js';
import { T0, at, newGame, withLodeling } from './helpers.js';

const HOUR = 3_600_000;

describe('eggs', () => {
  it('fill empty incubators from the basket and hatch on time', () => {
    const s = withLodeling();
    s.eggs = ['pebble', 'geode'];
    R.autoIncubate(s, T0);
    expect(s.incubators).toEqual([{ kind: 'pebble', startedAt: T0, readyAt: T0 + 180_000 }]);
    expect(s.eggs).toEqual(['geode']);
    expect(R.hatch(s, at(T0 + 179_000), 0)).toBeNull();
    expect(R.hatch(s, at(T0 + 180_000), 0)).not.toBeNull();
    expect(s.incubators[0]?.kind).toBe('geode');
    expect(s.stats.hatches).toBe(1);
  });

  it('hatch rarities close to the published odds', () => {
    const s = withLodeling();
    const counts: Record<C.Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < 20_000; i++) {
      s.incubators[0] = { kind: 'pebble', startedAt: T0, readyAt: T0 };
      const id = R.hatch(s, at(T0), 0);
      const rarity = C.speciesOf(id ?? '')?.rarity;
      if (rarity) counts[rarity] += 1;
    }
    expect(counts.common / 20_000).toBeCloseTo(0.7, 1);
    expect(counts.rare / 20_000).toBeCloseTo(0.25, 1);
    expect(counts.epic / 20_000).toBeGreaterThan(0.035);
    expect(counts.epic / 20_000).toBeLessThan(0.055);
    expect(counts.legendary).toBeGreaterThan(50);
    expect(counts.legendary).toBeLessThan(160);
  });

  it('turn duplicates into stars, and duplicates past five stars into gems', () => {
    const s = withLodeling();
    s.roster = { emberkit: { level: 3, stars: 4 }, drizzlet: { level: 1, stars: 0 }, mossling: { level: 1, stars: 0 }, zapling: { level: 1, stars: 0 } };
    s.roster.emberkit = { level: 3, stars: C.MAX_STARS };
    let gemsSeen = 0;
    for (let i = 0; i < 40; i++) {
      s.incubators[0] = { kind: 'starter', startedAt: T0, readyAt: T0 };
      const c = at(T0);
      R.hatch(s, c, 0);
      for (const e of c.events) if (e.type === 'hatch') gemsSeen += e.gems;
    }
    expect(s.roster.drizzlet?.stars).toBe(C.MAX_STARS);
    expect(s.roster.emberkit.level).toBe(3);
    expect(gemsSeen).toBeGreaterThan(0);
    expect(gemsSeen % C.RARITY_STATS.common.maxStarGems).toBe(0);
  });

  it('only add new creatures to the team while there is room', () => {
    const s = withLodeling();
    s.team = ['emberkit', 'x', 'y'].filter((id) => id in s.roster);
    s.roster.drizzlet = { level: 1, stars: 0 };
    s.roster.mossling = { level: 1, stars: 0 };
    s.team = ['emberkit', 'drizzlet', 'mossling'];
    s.incubators[0] = { kind: 'prism', startedAt: T0, readyAt: T0 };
    const id = R.hatch(s, at(T0), 0);
    expect(s.team).toHaveLength(3);
    expect(s.team).not.toContain(id);
    s.bestDepth = 20;
    expect(R.teamSlots(s)).toBe(4);
    expect(R.toggleTeam(s, id ?? '')).toBe(true);
    expect(R.toggleTeam(s, 'emberkit')).toBe(true);
    expect(s.team).not.toContain('emberkit');
  });

  it('stop dropping from rocks when the basket is full but never drop bought ones', () => {
    const s = withLodeling('emberkit', 1, 5);
    s.eggs = new Array<C.EggKind>(C.EGG_STORAGE).fill('pebble');
    s.incubators = [{ kind: 'geode', startedAt: T0, readyAt: T0 + HOUR }];
    const c = at(T0);
    for (let i = 0; i < 3000; i++) R.tap(s, c);
    expect(c.events.some((e) => e.type === 'egg_found')).toBe(false);
    expect(R.applySettlement(s, 'set-1', { egg_prism: 2 }, T0)).toBe(true);
    expect(s.eggs).toHaveLength(C.EGG_STORAGE + 2);
  });

  it('can be sped up with gems, an ad, or bought with gems', () => {
    const s = withLodeling();
    s.incubators = [{ kind: 'geode', startedAt: T0, readyAt: T0 + 20 * 60_000 }];
    expect(R.instantHatchGems(s, 0, T0)).toBe(10);
    expect(R.instantHatchGems(s, 0, T0 + 19 * 60_000 + 1)).toBe(1);
    s.gems = 9;
    expect(R.finishEggWithGems(s, 0, T0)).toBe(false);
    expect(R.grantAdReward(s, at(T0), 'egg_rush', 0)).toBe(true);
    expect(R.eggReady(s, 0, T0)).toBe(true);
    expect(R.adOffered(s, 'egg_rush', at(T0), 0)).toBe(false);
    s.gems = 1000;
    expect(R.buyEgg(s, 'starter', T0)).toBe(false);
    expect(R.buyEgg(s, 'prism', T0)).toBe(true);
    expect(s.gems).toBe(1000 - 320);
    expect(R.nextIncubatorPrice(s)).toBe(120);
    expect(R.buyIncubator(s, T0)).toBe(true);
    expect(R.buyIncubator(s, T0)).toBe(true);
    expect(R.buyIncubator(s, T0)).toBe(false);
    expect(s.incubators).toHaveLength(C.MAX_INCUBATORS);
  });
});

describe('offline time', () => {
  it('pays nothing for short gaps and caps long ones', () => {
    const s = withLodeling('emberkit', 20);
    s.lastSeenAt = T0;
    expect(R.offlineEarnings(s, T0 + 59_000)).toBeNull();
    const oneHour = R.offlineEarnings(s, T0 + HOUR);
    const perSecond = R.idleOrePerSecond(s, T0) * C.OFFLINE_EFFICIENCY;
    expect(oneHour?.seconds).toBe(3600);
    expect(oneHour?.ore).toBeCloseTo(perSecond * 3600);
    const week = R.offlineEarnings(s, T0 + 7 * 24 * HOUR);
    expect(week?.seconds).toBe(C.OFFLINE_BASE_SECONDS);
    s.relics.hourglass = 3;
    expect(R.offlineEarnings(s, T0 + 7 * 24 * HOUR)?.seconds).toBe(C.OFFLINE_BASE_SECONDS + 3 * 3600);
  });

  it('earns nothing for a clock turned back', () => {
    const s = withLodeling('emberkit', 20);
    s.lastSeenAt = T0;
    expect(R.returnFromOffline(s, at(T0 - 5 * HOUR))).toBeNull();
    expect(s.lastSeenAt).toBe(T0);
  });

  it('doubles for the part of the gap a blessing was active', () => {
    const s = withLodeling('emberkit', 20);
    s.lastSeenAt = T0;
    const plain = R.offlineEarnings(s, T0 + HOUR)?.ore ?? 0;
    s.blessingUntil = T0 + 30 * 60_000;
    expect(R.offlineEarnings(s, T0 + HOUR)?.ore).toBeCloseTo(plain * 1.5);
  });

  it('loses a Guardian fight that ran out while away and waits for the player to collect', () => {
    const s = withLodeling('emberkit', 20);
    s.depth = 5;
    s.guardian = { endsAt: T0 + 10_000, maxHp: R.guardianHp(5), retried: false };
    s.lastSeenAt = T0;
    const c = at(T0 + 2 * HOUR);
    const report = R.returnFromOffline(s, c);
    expect(s.guardian).toBeNull();
    expect(s.farming).toBe(true);
    expect(report).not.toBeNull();
    const ore = s.ore;
    // A second return before collecting adds the new time to the same report.
    s.lastSeenAt = T0 + 2 * HOUR;
    R.returnFromOffline(s, at(T0 + 3 * HOUR));
    expect(s.offline?.seconds).toBe(2 * 3600 + 3600);
    R.collectOffline(s, T0 + 3 * HOUR, false);
    expect(s.ore).toBeGreaterThan(ore);
    expect(s.offline).toBeNull();
    expect(R.collectOffline(s, T0 + 3 * HOUR, false)).toBeNull();
  });

  it('can be doubled once with a rewarded ad', () => {
    const s = withLodeling('emberkit', 20);
    s.lastSeenAt = T0;
    R.returnFromOffline(s, at(T0 + HOUR));
    const ore = s.offline?.ore ?? 0;
    expect(R.adOffered(s, 'offline_double', at(T0 + HOUR))).toBe(true);
    expect(R.grantAdReward(s, at(T0 + HOUR), 'offline_double')).toBe(true);
    expect(s.ore).toBeCloseTo(ore * 2);
    expect(R.grantAdReward(s, at(T0 + HOUR), 'offline_double')).toBe(false);
  });

  it('finds a few eggs at most', () => {
    const s = withLodeling('solferno', 300, 9);
    s.lastSeenAt = T0;
    const report = R.offlineEarnings(s, T0 + 2 * HOUR);
    expect(report?.eggs.length).toBeLessThanOrEqual(C.OFFLINE_MAX_EGGS);
    expect(report?.eggs.length).toBeGreaterThan(0);
  });
});

describe('daily reward, quests and achievements', () => {
  it('gives one reward per calendar day in a seven day cycle', () => {
    const s = withLodeling();
    expect(R.claimDaily(s, at(T0))).toEqual({ kind: 'gems', amount: 15 });
    expect(R.claimDaily(s, at(T0 + 3 * HOUR))).toBeNull();
    expect(R.claimDaily(s, at(T0 - 24 * HOUR))).toBeNull();
    const kinds = [];
    for (let day = 1; day <= 7; day++) kinds.push(R.claimDaily(s, at(T0 + day * 24 * HOUR))?.kind);
    expect(kinds).toEqual(['egg', 'gems', 'ore_minutes', 'egg', 'gems', 'egg', 'gems']);
    expect(s.daily.claims).toBe(8);
  });

  it('turns a daily egg into gems when the basket is full', () => {
    const s = withLodeling();
    s.daily.claims = 1;
    s.eggs = new Array<C.EggKind>(C.EGG_STORAGE).fill('pebble');
    s.incubators = [{ kind: 'pebble', startedAt: T0, readyAt: T0 + HOUR }];
    R.claimDaily(s, at(T0));
    expect(s.eggs).toHaveLength(C.EGG_STORAGE);
    expect(s.gems).toBe(10);
  });

  it('hands out three quests per day, the same for a player all day, and pays for them', () => {
    const s = withLodeling();
    expect(R.refreshQuests(s, '2026-10-29')).toBe(true);
    const quests = structuredClone(s.daily.quests);
    expect(quests).toHaveLength(3);
    expect(new Set(quests.map((q) => q.metric)).size).toBe(3);
    expect(R.refreshQuests(s, '2026-10-29')).toBe(false);
    const other = withLodeling();
    other.createdAt = T0 + 1;
    R.refreshQuests(other, '2026-10-29');
    R.refreshQuests(s, '2026-10-30');
    expect(R.claimQuest(s, 0)).toBe(false);
    for (const q of s.daily.quests) R.bumpQuest(s, q.metric, q.target + 50);
    expect(s.daily.quests.every((q) => q.progress === q.target)).toBe(true);
    expect(R.claimQuestBonus(s, T0)).toBe(false);
    expect([0, 1, 2].map((i) => R.claimQuest(s, i))).toEqual([true, true, true]);
    expect(R.claimQuest(s, 0)).toBe(false);
    expect(R.claimQuestBonus(s, T0)).toBe(true);
    expect(R.claimQuestBonus(s, T0)).toBe(false);
    expect(s.gems).toBe(3 * C.QUEST_GEMS + C.QUEST_BONUS_GEMS);
  });

  it('pays achievement tiers one at a time', () => {
    const s = withLodeling();
    s.stats.blocks = 1500;
    expect(R.achievementReady(s, 'blocks')).toBe(true);
    expect(R.claimAchievement(s, 'blocks')).toBe(5);
    expect(R.claimAchievement(s, 'blocks')).toBe(10);
    expect(R.claimAchievement(s, 'blocks')).toBe(0);
    expect(R.achievementTarget(s, 'blocks')).toBe(10_000);
    s.stats.resurfaces = 100;
    for (let i = 0; i < 5; i++) R.claimAchievement(s, 'resurfaces');
    expect(R.achievementTarget(s, 'resurfaces')).toBeNull();
  });
});

describe('resurfacing', () => {
  it('needs depth 30 and pays more the deeper the run went', () => {
    const s = withLodeling('emberkit', 100);
    s.maxDepth = 29;
    expect(R.resurfaceDust(s)).toBe(0);
    expect(R.resurface(s, T0)).toBe(0);
    s.maxDepth = 30;
    expect(R.resurfaceDust(s)).toBe(C.BALANCE.dustScale);
    const at40 = (s.maxDepth = 40, R.resurfaceDust(s));
    const at60 = (s.maxDepth = 60, R.resurfaceDust(s));
    expect(at40).toBeGreaterThan(C.BALANCE.dustScale);
    expect(at60).toBeGreaterThan(at40 * 5);
  });

  it('starts a new run but keeps creatures, stars, gems, relics and best depth', () => {
    const s = withLodeling('emberkit', 100);
    s.roster.emberkit = { level: 100, stars: 3 };
    s.depth = 41;
    s.maxDepth = 41;
    s.bestDepth = 41;
    s.ore = 1e9;
    s.gems = 77;
    s.gear.pick = 50;
    s.relics.heart = 2;
    s.skills.rally = { readyAt: T0 + HOUR, activeUntil: T0 + 10_000 };
    const dust = R.resurface(s, T0);
    expect(dust).toBeGreaterThan(0);
    expect(s).toMatchObject({ depth: 1, block: 0, maxDepth: 1, bestDepth: 41, ore: 0, gems: 77, dust, lifetimeDust: dust });
    expect(s.roster.emberkit).toEqual({ level: 1, stars: 3 });
    expect(s.gear.pick).toBe(0);
    expect(s.relics.heart).toBe(2);
    expect(s.skills.rally).toEqual({ readyAt: T0, activeUntil: 0 });
    expect(R.skillUnlocked(s, 'rally')).toBe(true);
  });

  it('sells relics for dust up to their limits', () => {
    const s = withLodeling();
    s.dust = 3;
    expect(R.relicCost(s, 'heart')).toBe(2);
    expect(R.buyRelic(s, 'heart')).toBe(true);
    expect(R.buyRelic(s, 'heart')).toBe(false);
    s.dust = 1e12;
    s.relics.hourglass = C.RELICS.hourglass.max;
    expect(R.relicCost(s, 'hourglass')).toBe(Infinity);
    expect(R.buyRelic(s, 'hourglass')).toBe(false);
  });

  it('makes every lifetime dust add damage even after it is spent', () => {
    const s = withLodeling('emberkit', 10);
    const before = R.teamDps(s, T0);
    s.lifetimeDust = 20;
    expect(R.teamDps(s, T0)).toBeCloseTo(before * (1 + 20 * C.BALANCE.dustDamageBonus));
  });
});

describe('ads', () => {
  it('limit rewarded ads per placement and per day, and reset the next day', () => {
    const s = withLodeling();
    for (let i = 0; i < C.AD_DAILY_LIMITS.gem_crate; i++) expect(R.grantAdReward(s, at(T0), 'gem_crate')).toBe(true);
    expect(R.grantAdReward(s, at(T0), 'gem_crate')).toBe(false);
    expect(s.gems).toBe(C.AD_DAILY_LIMITS.gem_crate * C.GEM_CRATE_GEMS);
    expect(R.adsLeft(s, 'gem_crate', at(T0 + 24 * HOUR).day)).toBe(C.AD_DAILY_LIMITS.gem_crate);
    expect(R.grantAdReward(s, at(T0 + 24 * HOUR), 'gem_crate')).toBe(true);
  });

  it('stack blessings up to one hour', () => {
    const s = withLodeling();
    for (let i = 0; i < 4; i++) expect(R.grantAdReward(s, at(T0), 'blessing')).toBe(true);
    expect(s.blessingUntil).toBe(T0 + HOUR);
    expect(R.adOffered(s, 'blessing', at(T0))).toBe(false);
    expect(R.oreMultiplier(s, T0)).toBeCloseTo(R.lastingOreMultiplier(s) * 2);
  });

  it('show interstitials rarely, never early and never to Remove Ads owners', () => {
    const s = withLodeling();
    const session = T0;
    s.bestDepth = 20;
    const later = at(T0 + 10 * 60_000);
    expect(R.interstitialAllowed(s, at(T0 + 60_000), session)).toBe(false);
    expect(R.interstitialAllowed(s, later, session)).toBe(true);
    R.recordInterstitial(s, later);
    expect(R.interstitialAllowed(s, at(later.now + 60_000), session)).toBe(false);
    expect(R.interstitialAllowed(s, at(later.now + 6 * 60_000), session)).toBe(true);
    s.ads.lastRewardedAt = later.now + 6 * 60_000 - 1000;
    expect(R.interstitialAllowed(s, at(later.now + 6 * 60_000), session)).toBe(false);
    s.ads.lastRewardedAt = 0;
    R.setEntitlements(s, ['remove_ads']);
    expect(R.interstitialAllowed(s, at(later.now + 6 * 60_000), session)).toBe(false);
    s.shop.entitlements = [];
    s.bestDepth = 5;
    expect(R.interstitialAllowed(s, at(later.now + 6 * 60_000), session)).toBe(false);
  });
});

describe('purchases', () => {
  it('apply each server settlement once', () => {
    const s = withLodeling();
    expect(R.applySettlement(s, 'abc', { gems: 550, egg_prism: 1, coins: 9 }, T0)).toBe(true);
    expect(s.gems).toBe(550);
    expect(s.incubators[0]?.kind).toBe('prism');
    expect(R.applySettlement(s, 'abc', { gems: 550 }, T0)).toBe(false);
    expect(s.gems).toBe(550);
  });

  it('take back refunded gems, which blocks spending while the balance is negative', () => {
    const s = withLodeling();
    R.applySettlement(s, 'buy', { gems: 100 }, T0);
    s.gems -= 90; // spent
    R.applySettlement(s, 'refund', { gems: -100 }, T0);
    expect(s.gems).toBe(-90);
    expect(R.buyEgg(s, 'pebble', T0)).toBe(false);
    expect(R.resetSkills(s, T0)).toBe(false);
  });

  it('keep only known entitlements and remember at most 50 settlements', () => {
    const s = newGame();
    R.setEntitlements(s, ['ore_doubler', 'free_money']);
    expect(s.shop.entitlements).toEqual(['ore_doubler']);
    expect(R.lastingOreMultiplier(s)).toBe(2);
    for (let i = 0; i < 60; i++) R.applySettlement(s, `id-${i}`, { gems: 1 }, T0);
    expect(s.shop.settled).toHaveLength(50);
    expect(s.gems).toBe(60);
  });
});
