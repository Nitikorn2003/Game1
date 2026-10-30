/**
 * Lotus Canal's economy and content. Coins are the only currency: earned by clearing deals,
 * spent on help with a hard deal and on looks, which change only how the cards and the canal
 * are drawn.
 */

export const MODES = ['level', 'daily'] as const;
export type Mode = (typeof MODES)[number];

/** Each deal starts with this many free undos; more cost an ad or coins. */
export const FREE_UNDOS = 2;
export const MORE_UNDOS = 3;

/** Help, in coins, for when no ad is on offer. */
export const TOOL_COSTS = { moreUndos: 15, wild: 50, extraCards: 30 } as const;
export type Tool = keyof typeof TOOL_COSTS;
/** More cards can be added to a deal this many times. */
export const MAX_EXTRAS = 2;

/** A cleared level pays this much besides its pot, a little more every ten levels. */
export function levelCoins(level: number): number {
  return 10 + Math.min(10, Math.floor((level - 1) / 10));
}
/** Each card still in the stock when a deal is cleared. */
export const SPARE_COINS = 2;
export const DAILY_COINS = 40;
/** Reaching the end of a canal. */
export const CANAL_COINS = 100;

export const AD_PLACEMENTS = ['more_undos', 'wild', 'extra_cards', 'double_coins', 'free_coins'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const FREE_COINS = 50;

export const ENTITLEMENTS = ['remove_ads', 'market_kit', 'canal_collection'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

/** Ad breaks start once a player has cleared this many deals. */
export const AD_BREAKS_AFTER_WINS = 5;

/** Looks: card backs and scenes around the table. The first of each is free. */
export const CARD_BACKS = ['lotus', 'waves', 'elephant', 'kanok'] as const;
export type CardBack = (typeof CARD_BACKS)[number];
export const SCENES = ['morning', 'sunset', 'rain', 'lanterns'] as const;
export type Scene = (typeof SCENES)[number];
export type LookId = CardBack | Scene;
export const LOOK_COSTS: Readonly<Record<LookId, number>> = {
  lotus: 0,
  waves: 600,
  elephant: 800,
  kanok: 1000,
  morning: 0,
  sunset: 600,
  rain: 800,
  lanterns: 1000,
};
/** The Market Kit comes with these card backs. */
export const MARKET_KIT_BACK: CardBack = 'waves';

/**
 * The trip: each cleared level takes the boat one stop further, and every canal has ten
 * stops. Their names and postcards are in the string tables.
 */
export const STOPS_PER_CANAL = 10;
export const CANALS = ['landing', 'mango', 'kingfisher', 'coconut', 'orchid', 'teahouse', 'raintree', 'bridges', 'spice', 'heron', 'lantern', 'sunrise'] as const;
export type CanalId = (typeof CANALS)[number];
