/**
 * Bloom Hive's economy and content. Honey is the only currency: earned by reaching levels and
 * the daily meadow, spent on tools, on five more pollen for a round that ran out, and on looks,
 * which change only how the meadow is drawn.
 */

/** Meadow rounds are the levels of the meadow and the wild after it; a daily round is a new level every day. */
export const MODES = ['meadow', 'daily'] as const;
export type Mode = (typeof MODES)[number];

/**
 * Tools, shot instead of pollen and taking none: the rainbow takes the colour that makes the
 * biggest group where it sticks, the bomb pops every bud within two of where it sticks, and the
 * sunbeam pops every bud on its way up to the branch.
 */
export const TOOLS = ['rainbow', 'bomb', 'sunbeam'] as const;
export type Tool = (typeof TOOLS)[number];
export const TOOL_COSTS: Readonly<Record<Tool, number>> = { rainbow: 80, bomb: 100, sunbeam: 120 };
/** What a new player's pouch holds. */
export const START_TOOLS: Readonly<Record<Tool, number>> = { rainbow: 2, bomb: 2, sunbeam: 1 };
/** The most of one tool a pouch holds, so a save can never grow without end. */
export const MAX_TOOLS = 999;

/** Five more pollen for a round that ran out: for an ad, or for honey. */
export const MORE_SHOTS_COST = 100;

/** A level reached for the first time pays this, and as much again for each of its stars; reached again, only for the stars it did not have. */
export const LEVEL_COINS = 10;
export const STAR_COINS = 10;

/** Reaching every level of a zone makes its flower bloom in Pip's garden, and pays this and one of each tool. */
export const ZONE_COINS = 150;

/** The daily meadow pays this, and more for each day of a streak after the first, up to five days more. */
export const DAILY_COINS = 60;
export const STREAK_COINS = 10;
export const STREAK_DAYS = 5;

export const AD_PLACEMENTS = ['more_shots', 'tool', 'double_coins', 'free_coins'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const FREE_COINS = 50;

export const ENTITLEMENTS = ['remove_ads', 'keeper_kit', 'meadow_collection'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

/** Ad breaks start once a player has reached this many levels. */
export const AD_BREAKS_AFTER_WINS = 3;

/** Looks: the sky over the meadow, and Pip's hat. The first of each is free. */
export const SKIES = ['morning', 'sunset', 'rain', 'starry'] as const;
export type Sky = (typeof SKIES)[number];
export const HATS = ['leaf', 'straw', 'flowers', 'beanie'] as const;
export type Hat = (typeof HATS)[number];
export type LookId = Sky | Hat;
export const LOOK_COSTS: Readonly<Record<LookId, number>> = {
  morning: 0,
  sunset: 600,
  rain: 800,
  starry: 1000,
  leaf: 0,
  straw: 600,
  flowers: 800,
  beanie: 1000,
};
/** The Keeper's Kit comes with this hat. */
export const KEEPER_KIT_HAT: Hat = 'straw';

/** Notes on what is new, each shown at the first level that has it until the player has seen it. */
export const TIPS = ['aim', 'bank', 'swap', 'jar', 'top', 'wax', 'honey', 'puff', 'butterfly', 'six'] as const;
export type TipId = (typeof TIPS)[number];
export const TIP_LEVELS: Readonly<Record<TipId, number>> = {
  aim: 1,
  bank: 2,
  swap: 3,
  jar: 5,
  top: 13,
  wax: 25,
  honey: 37,
  puff: 49,
  butterfly: 61,
  six: 73,
};
