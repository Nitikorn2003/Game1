/**
 * Tide Garden's economy and content. Sand dollars are the only currency: earned by reaching
 * levels and the daily dive, spent on tools, on five more moves for a dive that ran out, and
 * on looks, which change only how the reef is drawn.
 */

/** Reef dives are the levels of the reef and the open sea after it; a daily dive is a new level every day. */
export const MODES = ['reef', 'daily'] as const;
export type Mode = (typeof MODES)[number];

/** Tools, kept in the diver's bag: the claw clears one cell, the tide a row, and the hermit crab swaps any two neighbours. None takes a move. */
export const TOOLS = ['claw', 'tide', 'crab'] as const;
export type Tool = (typeof TOOLS)[number];
export const TOOL_COSTS: Readonly<Record<Tool, number>> = { claw: 80, tide: 120, crab: 100 };
/** What a new diver's bag holds. */
export const START_TOOLS: Readonly<Record<Tool, number>> = { claw: 3, tide: 1, crab: 2 };
/** The most of one tool a bag holds, so a save can never grow without end. */
export const MAX_TOOLS = 999;

/** Five more moves for a dive that ran out: for an ad, or for sand dollars. */
export const MORE_MOVES_COST = 100;

/** A level reached for the first time pays this, and as much again for each of its stars; reached again, only for the stars it did not have. */
export const LEVEL_COINS = 10;
export const STAR_COINS = 10;

/** Reaching every level of a zone brings its creature home, and pays this and one of each tool. */
export const ZONE_COINS = 150;

/** The daily dive pays this, and more for each day of a streak after the first, up to five days more. */
export const DAILY_COINS = 60;
export const STREAK_COINS = 10;
export const STREAK_DAYS = 5;

export const AD_PLACEMENTS = ['more_moves', 'tool', 'double_coins', 'free_coins'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const FREE_COINS = 50;

export const ENTITLEMENTS = ['remove_ads', 'diver_kit', 'reef_collection'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

/** Ad breaks start once a player has reached this many levels. */
export const AD_BREAKS_AFTER_WINS = 3;

/** Looks: the water the reef is drawn in, and the buddy who swims beside the board. The first of each is free. */
export const WATERS = ['sunlit', 'sunset', 'moonlit', 'glow'] as const;
export type Water = (typeof WATERS)[number];
export const BUDDIES = ['clownfish', 'seal', 'manta', 'seadragon'] as const;
export type Buddy = (typeof BUDDIES)[number];
export type LookId = Water | Buddy;
export const LOOK_COSTS: Readonly<Record<LookId, number>> = {
  sunlit: 0,
  sunset: 600,
  moonlit: 800,
  glow: 1000,
  clownfish: 0,
  seal: 600,
  manta: 800,
  seadragon: 1000,
};
/** The Diver's Kit comes with this buddy. */
export const DIVER_KIT_BUDDY: Buddy = 'seal';

/** Notes on what is new, each shown at the first level that has it until the player has seen it. */
export const TIPS = ['swap', 'specials', 'sand', 'kelp', 'rock', 'turtle', 'wreck', 'caves'] as const;
export type TipId = (typeof TIPS)[number];
export const TIP_LEVELS: Readonly<Record<TipId, number>> = { swap: 1, specials: 2, sand: 13, kelp: 25, rock: 37, turtle: 49, wreck: 61, caves: 73 };
