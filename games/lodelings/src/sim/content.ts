/**
 * Everything that defines Lodelings as a game, as data: creatures, eggs, gear, skills,
 * relics, quests and achievements. Rules live in rules.ts; this file only holds numbers
 * and names, so balancing is a data change.
 */

/**
 * The numbers that set the game's pace. They are one object so that the balancing tool can
 * try variations; the game itself never changes them.
 */
export const BALANCE = {
  baseBlockHp: 5,
  /** Block HP grows by this factor per depth, in bands, so late numbers stay readable. */
  hpGrowth: [
    [80, 1.36],
    [200, 1.25],
    [600, 1.16],
    [Infinity, 1.08],
  ] as [upToDepth: number, growth: number][],
  /** Ore per block, as a share of its HP. */
  orePerHp: 1.2,
  /** Deeper rock is richer per HP, which makes descending worth it. */
  oreRichness: 1.012,
  /**
   * The first depths pay extra ore, fading out with depth, so a new player can buy the first
   * upgrades within seconds: depth 1 pays (1 + shallowBonus) times, about e times less each
   * `shallowDepths` deeper.
   */
  shallowBonus: 12,
  shallowDepths: 3,
  levelCostGrowth: 1.1,
  /** Lodeling damage doubles at every multiple of this many levels. */
  levelMilestone: 25,
  guardianHpFactor: 10,
  guardianSeconds: 30,
  /**
   * Relic Dust for a run: dustScale x (rock HP at the run's deepest point / rock HP at the
   * first depth that allows resurfacing) ^ dustPower. Tying dust to HP keeps every run worth
   * about the same number of extra depths, instead of runs paying less and less.
   */
  dustScale: 8,
  dustPower: 0.5,
  /** Every Relic Dust ever earned adds this much to all damage, even after it is spent. */
  dustDamageBonus: 0.05,
};

export const ELEMENTS = ['ember', 'tide', 'grove', 'volt'] as const;
export type Element = (typeof ELEMENTS)[number];

/** Each element beats the next one in this cycle: fire burns plants, plants ground lightning... */
const BEATS: Record<Element, Element> = { ember: 'grove', grove: 'volt', volt: 'tide', tide: 'ember' };

export const ADVANTAGE = 1.6;
export const DISADVANTAGE = 0.7;

export function elementMultiplier(attacker: Element, defender: Element | null): number {
  if (defender === null) return 1;
  if (BEATS[attacker] === defender) return ADVANTAGE;
  if (BEATS[defender] === attacker) return DISADVANTAGE;
  return 1;
}

/** The element that beats `element`, which is what a Guardian of that element is weak to. */
export function weaknessOf(element: Element): Element {
  return ELEMENTS.find((e) => BEATS[e] === element) ?? 'ember';
}

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_STATS: Record<Rarity, { dps: number; levelCost: number; maxStarGems: number }> = {
  common: { dps: 1, levelCost: 600, maxStarGems: 2 },
  rare: { dps: 3, levelCost: 1500, maxStarGems: 5 },
  epic: { dps: 9, levelCost: 4000, maxStarGems: 15 },
  legendary: { dps: 30, levelCost: 11_000, maxStarGems: 50 },
};
export const MAX_STARS = 5;
export const STAR_BONUS = 0.5;

export type BodyShape = 'round' | 'oval' | 'pear' | 'marquise' | 'trillion' | 'cushion' | 'hex' | 'heart';
export type Eyes = 'round' | 'sleepy' | 'sparkle' | 'fierce';
export type Feature =
  | 'flame'
  | 'ears'
  | 'quills'
  | 'horns'
  | 'rays'
  | 'drop'
  | 'shell'
  | 'fin'
  | 'coral'
  | 'crest'
  | 'leaf'
  | 'leaves'
  | 'thorns'
  | 'fern'
  | 'branches'
  | 'wings'
  | 'bolt'
  | 'sparks'
  | 'zigzag'
  | 'catears';

export interface Species {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  shape: BodyShape;
  eyes: Eyes;
  feature: Feature;
  /** Main body hue in degrees; light and shadow tones are derived from it. */
  hue: number;
}

export const SPECIES: readonly Species[] = [
  { id: 'emberkit', name: 'Emberkit', element: 'ember', rarity: 'common', shape: 'round', eyes: 'round', feature: 'flame', hue: 14 },
  { id: 'flintpup', name: 'Flintpup', element: 'ember', rarity: 'common', shape: 'cushion', eyes: 'sleepy', feature: 'ears', hue: 26 },
  { id: 'pyrrhite', name: 'Pyrrhite', element: 'ember', rarity: 'rare', shape: 'trillion', eyes: 'fierce', feature: 'flame', hue: 2 },
  { id: 'scorchquill', name: 'Scorchquill', element: 'ember', rarity: 'rare', shape: 'marquise', eyes: 'round', feature: 'quills', hue: 34 },
  { id: 'magmaw', name: 'Magmaw', element: 'ember', rarity: 'epic', shape: 'hex', eyes: 'fierce', feature: 'horns', hue: 354 },
  { id: 'solferno', name: 'Solferno', element: 'ember', rarity: 'legendary', shape: 'round', eyes: 'sparkle', feature: 'rays', hue: 42 },
  { id: 'drizzlet', name: 'Drizzlet', element: 'tide', rarity: 'common', shape: 'pear', eyes: 'round', feature: 'drop', hue: 200 },
  { id: 'pearlop', name: 'Pearlop', element: 'tide', rarity: 'common', shape: 'round', eyes: 'sleepy', feature: 'shell', hue: 188 },
  { id: 'brinefin', name: 'Brinefin', element: 'tide', rarity: 'rare', shape: 'oval', eyes: 'round', feature: 'fin', hue: 212 },
  { id: 'coralynx', name: 'Coralynx', element: 'tide', rarity: 'rare', shape: 'cushion', eyes: 'sparkle', feature: 'coral', hue: 176 },
  { id: 'tidalisk', name: 'Tidalisk', element: 'tide', rarity: 'epic', shape: 'marquise', eyes: 'fierce', feature: 'crest', hue: 222 },
  { id: 'leviathorn', name: 'Leviathorn', element: 'tide', rarity: 'legendary', shape: 'hex', eyes: 'fierce', feature: 'horns', hue: 234 },
  { id: 'mossling', name: 'Mossling', element: 'grove', rarity: 'common', shape: 'round', eyes: 'round', feature: 'leaf', hue: 108 },
  { id: 'sproutle', name: 'Sproutle', element: 'grove', rarity: 'common', shape: 'pear', eyes: 'sleepy', feature: 'leaves', hue: 88 },
  { id: 'thornacle', name: 'Thornacle', element: 'grove', rarity: 'rare', shape: 'trillion', eyes: 'fierce', feature: 'thorns', hue: 128 },
  { id: 'fernwhisk', name: 'Fernwhisk', element: 'grove', rarity: 'rare', shape: 'oval', eyes: 'sparkle', feature: 'fern', hue: 96 },
  { id: 'oakenshard', name: 'Oakenshard', element: 'grove', rarity: 'epic', shape: 'hex', eyes: 'round', feature: 'branches', hue: 140 },
  { id: 'verdragon', name: 'Verdragon', element: 'grove', rarity: 'legendary', shape: 'marquise', eyes: 'fierce', feature: 'wings', hue: 152 },
  { id: 'zapling', name: 'Zapling', element: 'volt', rarity: 'common', shape: 'trillion', eyes: 'round', feature: 'bolt', hue: 50 },
  { id: 'fizzbit', name: 'Fizzbit', element: 'volt', rarity: 'common', shape: 'round', eyes: 'sparkle', feature: 'sparks', hue: 58 },
  { id: 'voltail', name: 'Voltail', element: 'volt', rarity: 'rare', shape: 'oval', eyes: 'round', feature: 'zigzag', hue: 270 },
  { id: 'staticat', name: 'Staticat', element: 'volt', rarity: 'rare', shape: 'cushion', eyes: 'sleepy', feature: 'catears', hue: 282 },
  { id: 'thundrake', name: 'Thundrake', element: 'volt', rarity: 'epic', shape: 'marquise', eyes: 'fierce', feature: 'horns', hue: 262 },
  { id: 'stormquartz', name: 'Stormquartz', element: 'volt', rarity: 'legendary', shape: 'heart', eyes: 'sparkle', feature: 'sparks', hue: 46 },
];

export type SpeciesId = string;

const speciesById = new Map(SPECIES.map((s) => [s.id, s]));

export function speciesOf(id: SpeciesId): Species | undefined {
  return speciesById.get(id);
}

export const EGG_KINDS = ['starter', 'pebble', 'geode', 'prism'] as const;
export type EggKind = (typeof EGG_KINDS)[number];

export const EGGS: Record<EggKind, { hatchSeconds: number; odds: Record<Rarity, number>; gemPrice: number | null }> = {
  starter: { hatchSeconds: 10, odds: { common: 1, rare: 0, epic: 0, legendary: 0 }, gemPrice: null },
  pebble: { hatchSeconds: 3 * 60, odds: { common: 70, rare: 25, epic: 4.5, legendary: 0.5 }, gemPrice: 30 },
  geode: { hatchSeconds: 20 * 60, odds: { common: 30, rare: 50, epic: 17, legendary: 3 }, gemPrice: 100 },
  prism: { hatchSeconds: 60 * 60, odds: { common: 0, rare: 50, epic: 38, legendary: 12 }, gemPrice: 320 },
};
/** The starter egg always hatches one of these, so the first creature can fight any early Guardian. */
export const STARTER_SPECIES = ['emberkit', 'drizzlet', 'mossling', 'zapling'] as const;
export const EGG_STORAGE = 12;
export const INCUBATOR_PRICES = [120, 360] as const;
export const MAX_INCUBATORS = 1 + INCUBATOR_PRICES.length;
/** Gems to finish an egg now: one per started two minutes left. */
export const INSTANT_HATCH_SECONDS_PER_GEM = 120;

export const BLOCKS_PER_DEPTH = 10;
export const GUARDIAN_EVERY = 5;
export const GUARDIAN_ORE_FACTOR = 12;
export const GUARDIAN_RETRY_BONUS_SECONDS = 15;
export const GUARDIAN_FIRST_WIN_GEMS = 3;
export const GUARDIAN_EGG_CHANCE = 0.15;


export const BLOCK_EGG_CHANCE = 0.008;
export const BLOCK_GEM_CHANCE = 0.003;

export const TEAM_SLOTS_BASE = 3;
/** Extra team slots open when the player first reaches these depths. */
export const TEAM_SLOT_DEPTHS = [20, 45] as const;

export const CRIT_MULTIPLIER = 4;
export const MAX_TAPS_PER_SECOND = 25;

export const GEAR_IDS = ['pick', 'lamp', 'cart', 'echo'] as const;
export type GearId = (typeof GEAR_IDS)[number];

export const GEAR: Record<GearId, { base: number; growth: number; max: number }> = {
  /** Tap damage: (1 + 2 x level), doubled every 25 levels. */
  pick: { base: 500, growth: 1.1, max: Infinity },
  /** Critical tap chance: 4% + 1% per level. */
  lamp: { base: 2500, growth: 1.25, max: 26 },
  /** Ore from rock: +15% per level. */
  cart: { base: 4000, growth: 1.15, max: Infinity },
  /** Each tap also deals 2% per level of the team's damage per second. */
  echo: { base: 15_000, growth: 1.2, max: 25 },
};

export const SKILL_IDS = ['dynamite', 'frenzy', 'goldrush', 'rally'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const SKILLS: Record<SkillId, { unlockDepth: number; cooldownSeconds: number; durationSeconds: number }> = {
  /** Instant blast: 25 taps' worth, or 8 seconds of team damage, whichever is more. */
  dynamite: { unlockDepth: 3, cooldownSeconds: 40, durationSeconds: 0 },
  /** 10 free taps a second. */
  frenzy: { unlockDepth: 8, cooldownSeconds: 120, durationSeconds: 10 },
  /** Triple ore. */
  goldrush: { unlockDepth: 15, cooldownSeconds: 180, durationSeconds: 20 },
  /** Team damage x2.5. */
  rally: { unlockDepth: 22, cooldownSeconds: 200, durationSeconds: 20 },
};
export const DYNAMITE_TAPS = 25;
export const DYNAMITE_TEAM_SECONDS = 8;
export const FRENZY_TAPS_PER_SECOND = 10;
export const GOLDRUSH_MULTIPLIER = 3;
export const RALLY_MULTIPLIER = 2.5;
export const SKILL_RESET_GEMS = 15;

export const RELIC_IDS = ['pick', 'heart', 'map', 'hourglass', 'fortune', 'hearth', 'bane'] as const;
export type RelicId = (typeof RELIC_IDS)[number];

export const RELICS: Record<RelicId, { base: number; growth: number; max: number; perLevel: number }> = {
  /** +40% tap damage per level. */
  pick: { base: 1, growth: 1.15, max: Infinity, perLevel: 0.4 },
  /** +30% team damage per level. */
  heart: { base: 2, growth: 1.15, max: Infinity, perLevel: 0.3 },
  /** +25% ore per level. */
  map: { base: 2, growth: 1.18, max: Infinity, perLevel: 0.25 },
  /** +1 hour of offline time per level. */
  hourglass: { base: 3, growth: 1.6, max: 10, perLevel: 3600 },
  /** +12% egg finds per level. */
  fortune: { base: 3, growth: 1.5, max: 15, perLevel: 0.12 },
  /** -5% hatching time per level. */
  hearth: { base: 4, growth: 1.5, max: 12, perLevel: 0.05 },
  /** +2 seconds against Guardians per level. */
  bane: { base: 3, growth: 1.45, max: 15, perLevel: 2 },
};
export const RESURFACE_MIN_DEPTH = 30;

export const OFFLINE_BASE_SECONDS = 2 * 3600;
export const OFFLINE_EFFICIENCY = 0.5;
export const OFFLINE_MAX_EGGS = 3;
/** Gaps shorter than this are simulated normally instead of shown as offline earnings. */
export const OFFLINE_MIN_SECONDS = 60;

export type DailyReward =
  | { kind: 'gems'; amount: number }
  | { kind: 'egg'; egg: EggKind }
  | { kind: 'ore_minutes'; minutes: number };

export const DAILY_REWARDS: readonly DailyReward[] = [
  { kind: 'gems', amount: 15 },
  { kind: 'egg', egg: 'pebble' },
  { kind: 'gems', amount: 20 },
  { kind: 'ore_minutes', minutes: 20 },
  { kind: 'egg', egg: 'geode' },
  { kind: 'gems', amount: 30 },
  { kind: 'egg', egg: 'prism' },
];

export const QUEST_METRICS = ['taps', 'blocks', 'guardians', 'hatches', 'levels', 'skills', 'gear'] as const;
export type QuestMetric = (typeof QUEST_METRICS)[number];
export const QUEST_TARGETS: Record<QuestMetric, number> = {
  taps: 300,
  blocks: 120,
  guardians: 2,
  hatches: 2,
  levels: 25,
  skills: 6,
  gear: 15,
};
export const QUESTS_PER_DAY = 3;
export const QUEST_GEMS = 10;
export const QUEST_BONUS_GEMS = 10;

export const ACHIEVEMENT_IDS = ['blocks', 'depth', 'guardians', 'hatches', 'species', 'taps', 'resurfaces'] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];
export const ACHIEVEMENTS: Record<AchievementId, { tiers: readonly number[]; gems: readonly number[] }> = {
  blocks: { tiers: [100, 1000, 10_000, 100_000], gems: [5, 10, 20, 40] },
  depth: { tiers: [10, 25, 50, 100, 200, 400], gems: [5, 10, 20, 30, 50, 80] },
  guardians: { tiers: [1, 10, 50, 250], gems: [5, 10, 25, 50] },
  hatches: { tiers: [1, 10, 50, 200], gems: [5, 10, 25, 50] },
  species: { tiers: [4, 8, 16, 24], gems: [10, 20, 40, 100] },
  taps: { tiers: [500, 5000, 50_000, 500_000], gems: [5, 10, 20, 40] },
  resurfaces: { tiers: [1, 5, 25], gems: [20, 40, 80] },
};

export interface Biome {
  id: string;
  fromDepth: number;
  /** Rock, vein and background hues; the art derives full palettes from them. */
  rockHue: number;
  veinHue: number;
  skyHue: number;
}

export const BIOMES: readonly Biome[] = [
  { id: 'rootworn', fromDepth: 1, rockHue: 28, veinHue: 45, skyHue: 30 },
  { id: 'glowcap', fromDepth: 25, rockHue: 190, veinHue: 160, skyHue: 200 },
  { id: 'magma', fromDepth: 50, rockHue: 8, veinHue: 30, skyHue: 352 },
  { id: 'rimefrost', fromDepth: 75, rockHue: 205, veinHue: 185, skyHue: 215 },
  { id: 'prism', fromDepth: 100, rockHue: 280, veinHue: 320, skyHue: 270 },
  { id: 'hushdeep', fromDepth: 125, rockHue: 250, veinHue: 200, skyHue: 245 },
];
/** After the last biome the six repeat, one "cycle" deeper each time. */
export const BIOME_CYCLE_DEPTHS = 150;

export const GUARDIAN_NAMES: Record<Element, readonly string[]> = {
  ember: ['Cinder Warden', 'Slagback', 'Furnace Tyrant', 'Pyre Colossus'],
  tide: ['Tidewall Golem', 'Brinehulk', 'Undertow Matron', 'Abyss Sentinel'],
  grove: ['Bramble Colossus', 'Mossback Elder', 'Rootbound Titan', 'Thornmother'],
  volt: ['Sparkjaw', 'Coil Sentinel', 'Thunderhide', 'Storm Monolith'],
};

/** Rewarded ad placements: the player always chooses to watch, for a clear reward. */
export const AD_PLACEMENTS = ['offline_double', 'guardian_retry', 'egg_rush', 'blessing', 'gem_crate'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const AD_DAILY_LIMITS: Record<AdPlacement, number> = {
  offline_double: 10,
  guardian_retry: 10,
  egg_rush: 6,
  blessing: 8,
  gem_crate: 3,
};
export const AD_REWARDED_DAILY_TOTAL = 30;
export const EGG_RUSH_SECONDS = 20 * 60;
export const BLESSING_SECONDS = 15 * 60;
export const BLESSING_MAX_SECONDS = 60 * 60;
export const BLESSING_MULTIPLIER = 2;
export const GEM_CRATE_GEMS = 8;

/** Entitlements bought with real money; the server is the source of truth for them. */
export const ENTITLEMENTS = ['remove_ads', 'ore_doubler'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];
export const ORE_DOUBLER_MULTIPLIER = 2;
