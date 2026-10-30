/**
 * Crumb Lane's economy and content. Sugar is the only currency: earned by clearing counters
 * and the daily special, spent on tools, on making room when the tray is full, and on looks,
 * which change only how the bakery is drawn.
 */

/** Lane rounds are the levels of the lane and the late shift after it; a daily round is a new level every day. */
export const MODES = ['lane', 'daily'] as const;
export type Mode = (typeof MODES)[number];

/**
 * Tools, which take no room on the tray: the spatula puts the newest pastry on the tray back
 * where it came from, the rolling pin rolls the pastries on the counter into new places, and
 * the whisk whips up a set of three, taking the rest of its kind from anywhere on the counter.
 */
export const TOOLS = ['spatula', 'rollingpin', 'whisk'] as const;
export type Tool = (typeof TOOLS)[number];
export const TOOL_COSTS: Readonly<Record<Tool, number>> = { spatula: 80, rollingpin: 100, whisk: 120 };
/** What a new player's apron pocket holds. */
export const START_TOOLS: Readonly<Record<Tool, number>> = { spatula: 2, rollingpin: 1, whisk: 2 };
/** The most of one tool a pocket holds, so a save can never grow without end. */
export const MAX_TOOLS = 999;

/** Making room when the tray is full: three pastries go up to the cooling rack, for an ad or for sugar. */
export const MORE_ROOM_COST = 100;

/** A level cleared for the first time pays this, and as much again for each of its stars; cleared again, only for the stars it did not have. */
export const LEVEL_COINS = 10;
export const STAR_COINS = 10;
/** Every sprinkled pastry boxed up pays this, every time. */
export const SPRINKLE_COINS = 2;

/** Clearing every level of a shop opens it on the lane, and pays this and one of each tool. */
export const ZONE_COINS = 150;

/** The daily special pays this, and more for each day of a streak after the first, up to five days more. */
export const DAILY_COINS = 60;
export const STREAK_COINS = 10;
export const STREAK_DAYS = 5;

export const AD_PLACEMENTS = ['more_room', 'tool', 'double_coins', 'free_coins'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const FREE_COINS = 50;

export const ENTITLEMENTS = ['remove_ads', 'baker_kit', 'lane_collection'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

/** Ad breaks start once a player has cleared this many counters. */
export const AD_BREAKS_AFTER_WINS = 3;

/** Looks: the tiles the pastries sit on, and the season on the lane outside. The first of each is free. */
export const TILE_SETS = ['cream', 'willow', 'gingham', 'mint'] as const;
export type TileSet = (typeof TILE_SETS)[number];
export const SEASONS = ['spring', 'rain', 'autumn', 'snow'] as const;
export type Season = (typeof SEASONS)[number];
export type LookId = TileSet | Season;
export const LOOK_COSTS: Readonly<Record<LookId, number>> = {
  cream: 0,
  willow: 600,
  gingham: 800,
  mint: 1000,
  spring: 0,
  rain: 600,
  autumn: 800,
  snow: 1000,
};
/** The Baker's Kit comes with these tiles. */
export const BAKER_KIT_TILES: TileSet = 'gingham';

/** Notes on what is new, each shown at the first level that has it until the player has seen it. */
export const TIPS = ['tap', 'covered', 'stars', 'tools', 'bag', 'stack', 'box', 'sprinkles', 'more'] as const;
export type TipId = (typeof TIPS)[number];
export const TIP_LEVELS: Readonly<Record<TipId, number>> = {
  tap: 1,
  covered: 2,
  stars: 3,
  tools: 5,
  bag: 25,
  stack: 37,
  box: 49,
  sprinkles: 61,
  more: 73,
};
