/**
 * Rice Field Art's economy and content. Seeds are the only currency: earned by growing
 * pictures, spent on hints, on hearts for a field that went wrong, and on looks, which change
 * only how the fields are drawn.
 */

/** Album fields are the pictures of the albums; a daily field is a new pattern every day. */
export const MODES = ['album', 'daily'] as const;
export type Mode = (typeof MODES)[number];

/** Each field starts with three hearts; a wrong move costs one. */
export const HEARTS = 3;
/** And one free hint. More cost an ad or seeds. */
export const FREE_HINTS = 1;

/** Help, in seeds, for when no ad is on offer. */
export const TOOL_COSTS = { hint: 25, hearts: 40 } as const;
export type Tool = keyof typeof TOOL_COSTS;

/** A grown album field pays a seed for every four cells, five at least. */
export function fieldSeeds(cells: number): number {
  return Math.max(5, Math.round(cells / 4));
}
/** Grown without a wrong move or a hint, a field pays half as much again. */
export function perfectBonus(seeds: number): number {
  return Math.round(seeds / 2);
}
export const DAILY_SEEDS = 40;
/** Growing every picture of an album. */
export const ALBUM_SEEDS = 100;
/** An album opens once this many pictures of the album before it have grown. */
export const OPEN_AFTER = 8;
/** Album fields kept in progress at once, which keeps the save small; starting one more lets the oldest go. */
export const MAX_OPEN_FIELDS = 12;

export const AD_PLACEMENTS = ['hint', 'hearts', 'double_seeds', 'free_seeds'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const FREE_SEEDS = 50;

export const ENTITLEMENTS = ['remove_ads', 'farmer_kit', 'field_collection'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

/** Ad breaks start once a player has grown this many fields. */
export const AD_BREAKS_AFTER_WINS = 3;

/** Looks: the scene around the fields, and what marks a cell left empty. The first of each is free. */
export const SCENES = ['terraces', 'golden', 'misty', 'snowy'] as const;
export type Scene = (typeof SCENES)[number];
export const MARKERS = ['pebble', 'frog', 'blossom', 'snail'] as const;
export type Marker = (typeof MARKERS)[number];
export type LookId = Scene | Marker;
export const LOOK_COSTS: Readonly<Record<LookId, number>> = {
  terraces: 0,
  golden: 600,
  misty: 800,
  snowy: 1000,
  pebble: 0,
  frog: 600,
  blossom: 800,
  snail: 1000,
};
/** The Farmer's Kit comes with this marker. */
export const FARMER_KIT_MARKER: Marker = 'frog';
