import type { CatalogItem } from '@game1/platform';
import type { GameIdentity } from '@game1/shell';

/**
 * Real-money products. The same ids must exist in Google Play Console and in the purchase
 * server's catalog (services/iap-server/config); the server, not this file, decides what a
 * purchase grants. Test prices only show in the browser version, where nothing is charged.
 * Nothing sold is random.
 */
export const CATALOG: readonly CatalogItem[] = [
  { id: 'seeds_small', kind: 'consumable', grants: { seeds: 500 }, testPrice: '$0.99' },
  { id: 'seeds_medium', kind: 'consumable', grants: { seeds: 3000 }, testPrice: '$4.99' },
  { id: 'seeds_large', kind: 'consumable', grants: { seeds: 7000 }, testPrice: '$9.99' },
  // One-time products: Google Play never sells them twice to the same account.
  { id: 'farmer_kit', kind: 'non_consumable', grants: { seeds: 1000 }, entitlement: 'farmer_kit', testPrice: '$1.99' },
  { id: 'remove_ads', kind: 'non_consumable', entitlement: 'remove_ads', testPrice: '$2.99' },
  { id: 'field_collection', kind: 'non_consumable', entitlement: 'field_collection', testPrice: '$3.99' },
];

export const SEED_PACKS = ['seeds_small', 'seeds_medium', 'seeds_large'] as const;
export type SeedPack = (typeof SEED_PACKS)[number];

export function catalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((p) => p.id === id);
}

/** The game to the purchase server (its id there and its catalog) and to the browser's storage. */
export const GAME: GameIdentity = { gameId: 'ricefield', catalog: CATALOG, storagePrefix: 'ricefield:' };
