import type { CatalogItem } from '@game1/platform';

/**
 * Real-money products. The same ids must exist in Google Play Console and in the purchase
 * server's catalog; the server, not this file, decides what a purchase grants.
 * Test prices only show in the browser version, where nothing is charged.
 */
export const CATALOG: readonly CatalogItem[] = [
  { id: 'gems_small', kind: 'consumable', grants: { gems: 100 }, testPrice: '$0.99' },
  { id: 'gems_medium', kind: 'consumable', grants: { gems: 550 }, testPrice: '$4.99' },
  { id: 'gems_large', kind: 'consumable', grants: { gems: 1200 }, testPrice: '$9.99' },
  { id: 'gems_huge', kind: 'consumable', grants: { gems: 2600 }, testPrice: '$19.99' },
  // One-time products: Google Play never sells them twice to the same account.
  { id: 'starter_pack', kind: 'non_consumable', grants: { gems: 300, egg_prism: 1 }, entitlement: 'starter_pack', testPrice: '$2.99' },
  { id: 'remove_ads', kind: 'non_consumable', entitlement: 'remove_ads', testPrice: '$3.99' },
  { id: 'ore_doubler', kind: 'non_consumable', entitlement: 'ore_doubler', testPrice: '$4.99' },
];

export const GEM_PACKS = ['gems_small', 'gems_medium', 'gems_large', 'gems_huge'] as const;
export type GemPack = (typeof GEM_PACKS)[number];
export const OFFERS = ['starter_pack', 'remove_ads', 'ore_doubler'] as const;
export type Offer = (typeof OFFERS)[number];

export function catalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((p) => p.id === id);
}
