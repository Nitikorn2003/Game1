/**
 * Quilt Nook's economy and content. Spools are the only currency: earned by playing, spent on
 * tools that rescue a quilt and on fabric sets, which change only how the patches look.
 */

/** Tools, in spools. */
export const TOOL_COSTS = { unpick: 15, newPatches: 10, snip: 8 } as const;
export type Tool = keyof typeof TOOL_COSTS;

/** A finished quilt pays a spool for every this many points. */
export const POINTS_PER_SPOOL = 100;

export const AD_PLACEMENTS = ['second_chance', 'free_spools', 'double_spools'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const FREE_SPOOLS = 20;

export const ENTITLEMENTS = ['remove_ads', 'sewing_kit', 'fabric_chest'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

/** Fabric sets: every set has four fabrics, each with its own pattern so they differ without colour too. */
export const FABRIC_SETS = ['cottage', 'meadow', 'indigo', 'sunset', 'candy', 'woodland'] as const;
export type FabricSetId = (typeof FABRIC_SETS)[number];
export const FABRIC_COSTS: Readonly<Record<FabricSetId, number>> = { cottage: 0, meadow: 150, indigo: 200, sunset: 250, candy: 300, woodland: 400 };
/** The Sewing Kit comes with this set. */
export const SEWING_KIT_SET: FabricSetId = 'meadow';

/** The daily quilt: the same start for everyone on a day, and a score to reach. */
export const DAILY_SPOOLS = 25;
export const DAILY_TARGETS = [700, 850, 1000, 1150, 1300] as const;

/**
 * Commissions: three at a time from the quilt book. Counting ones add up what finished quilts
 * did; `score` and `streak` ask for one quilt that reaches the target.
 */
export const COMMISSION_KINDS = ['seams', 'perfect', 'doubles', 'patches', 'score', 'streak', 'daily'] as const;
export type CommissionKind = (typeof COMMISSION_KINDS)[number];
export const BEST_OF: readonly CommissionKind[] = ['score', 'streak'];
export const COMMISSION_TARGETS: Readonly<Record<CommissionKind, readonly [number, number, number]>> = {
  seams: [20, 40, 80],
  perfect: [2, 4, 6],
  doubles: [2, 4, 6],
  patches: [50, 100, 200],
  score: [600, 1000, 1500],
  streak: [4, 7, 10],
  daily: [1, 2, 3],
};
export const COMMISSION_REWARDS = [15, 25, 40] as const;
export const COMMISSION_SLOTS = 3;
/** Every this many claimed commissions, the new ones get a tier harder. */
export const COMMISSIONS_PER_TIER = 6;

/** Ad breaks start once a player has finished this many quilts. */
export const AD_BREAKS_AFTER_QUILTS = 3;
