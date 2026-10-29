/**
 * Sky Jars' economy and content. Stardust is the only currency: earned by solving, spent on
 * help with a hard shelf and on looks, which change only how the jars and the sky are drawn.
 */

export const MODES = ['level', 'daily'] as const;
export type Mode = (typeof MODES)[number];

/** Each shelf starts with this many free undos; more cost an ad or stardust. */
export const UNDOS_PER_SHELF = 5;
export const MORE_UNDOS = 5;

/** Help, in stardust, for when no ad is on offer. */
export const TOOL_COSTS = { moreUndos: 10, extraJar: 40, hint: 15 } as const;
export type Tool = keyof typeof TOOL_COSTS;

/** A solved level pays this much, a little more every ten levels. */
export function levelStardust(level: number): number {
  return 10 + Math.min(10, Math.floor((level - 1) / 10));
}
/** Solved without undo, hint or extra jar. */
export const CLEAN_BONUS = 5;
/** Lighting the last star of a constellation. */
export const CONSTELLATION_STARDUST = 50;
export const DAILY_STARDUST = 30;

export const AD_PLACEMENTS = ['extra_jar', 'more_undos', 'hint', 'double_stardust', 'free_stardust'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const FREE_STARDUST = 25;

export const ENTITLEMENTS = ['remove_ads', 'night_kit', 'sky_collection'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

/** Ad breaks start once a player has solved this many levels. */
export const AD_BREAKS_AFTER_LEVELS = 6;

/**
 * Starlight colours. Each has its own symbol, drawn on every unit, so colours can be told apart
 * without seeing colour at all.
 */
export const COLOURS = [
  { id: 'rose', fill: '#ff6f91', glow: '#ffc2d1', symbol: 'heart' },
  { id: 'amber', fill: '#ffb547', glow: '#ffe2ad', symbol: 'sun' },
  { id: 'lemon', fill: '#f3e75a', glow: '#fff8bd', symbol: 'star' },
  { id: 'mint', fill: '#5fe0a4', glow: '#c4f7de', symbol: 'leaf' },
  { id: 'aqua', fill: '#45d4e8', glow: '#bff3fa', symbol: 'drop' },
  { id: 'sky', fill: '#6c9dff', glow: '#cddcff', symbol: 'moon' },
  { id: 'violet', fill: '#a77bff', glow: '#ddcdff', symbol: 'diamond' },
  { id: 'peony', fill: '#ee7bf0', glow: '#f9cdfa', symbol: 'flower' },
  { id: 'pearl', fill: '#e9edf7', glow: '#ffffff', symbol: 'ring' },
  { id: 'coral', fill: '#ff8a5c', glow: '#ffd2bf', symbol: 'wave' },
] as const;
export type ColourId = (typeof COLOURS)[number]['id'];
export type SymbolName = (typeof COLOURS)[number]['symbol'];

/** Looks: jar styles and skies. The first of each is free. */
export const JAR_STYLES = ['glass', 'lantern', 'shell', 'crystal'] as const;
export type JarStyle = (typeof JAR_STYLES)[number];
export const SKIES = ['twilight', 'moonrise', 'aurora', 'meteors'] as const;
export type Sky = (typeof SKIES)[number];
export type LookId = JarStyle | Sky;
export const LOOK_COSTS: Readonly<Record<LookId, number>> = {
  glass: 0,
  lantern: 250,
  shell: 300,
  crystal: 400,
  twilight: 0,
  moonrise: 300,
  aurora: 350,
  meteors: 450,
};
/** The Night Kit comes with these jars. */
export const NIGHT_KIT_JARS: JarStyle = 'lantern';

/**
 * The sky atlas: every solved level lights the next star, and constellations fill one after
 * another. Their names and stories are in the string tables.
 */
export const CONSTELLATIONS = [
  { id: 'kettle', stars: 3 },
  { id: 'boat', stars: 4 },
  { id: 'fox', stars: 5 },
  { id: 'lantern', stars: 5 },
  { id: 'moth', stars: 6 },
  { id: 'teacup', stars: 6 },
  { id: 'kite', stars: 7 },
  { id: 'snail', stars: 7 },
  { id: 'owl', stars: 8 },
  { id: 'bell', stars: 8 },
  { id: 'whale', stars: 8 },
  { id: 'key', stars: 8 },
  { id: 'heron', stars: 9 },
  { id: 'umbrella', stars: 9 },
  { id: 'acorn', stars: 9 },
  { id: 'violin', stars: 9 },
  { id: 'turtle', stars: 10 },
  { id: 'windmill', stars: 10 },
  { id: 'hare', stars: 10 },
  { id: 'crown', stars: 10 },
  { id: 'bicycle', stars: 10 },
  { id: 'lighthouse', stars: 10 },
  { id: 'comet', stars: 10 },
  { id: 'door', stars: 10 },
] as const;
export type ConstellationId = (typeof CONSTELLATIONS)[number]['id'];
