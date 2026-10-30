import type { CatalogItem } from '@game1/platform';
import type { GameIdentity } from '@game1/shell';

/**
 * Real-money products. The same ids must exist in Google Play Console and in the purchase
 * server's catalog (services/iap-server/config); the server, not this file, decides what a
 * purchase grants. Test prices only show in the browser version, where nothing is charged.
 * Nothing sold is random.
 */
export const CATALOG: readonly CatalogItem[] = [
  { id: 'stardust_small', kind: 'consumable', grants: { stardust: 100 }, testPrice: '$0.99' },
  { id: 'stardust_medium', kind: 'consumable', grants: { stardust: 600 }, testPrice: '$4.99' },
  { id: 'stardust_large', kind: 'consumable', grants: { stardust: 1400 }, testPrice: '$9.99' },
  // One-time products: Google Play never sells them twice to the same account.
  { id: 'night_kit', kind: 'non_consumable', grants: { stardust: 300 }, entitlement: 'night_kit', testPrice: '$1.99' },
  { id: 'remove_ads', kind: 'non_consumable', entitlement: 'remove_ads', testPrice: '$2.99' },
  { id: 'sky_collection', kind: 'non_consumable', entitlement: 'sky_collection', testPrice: '$3.99' },
];

export const STARDUST_PACKS = ['stardust_small', 'stardust_medium', 'stardust_large'] as const;
export type StardustPack = (typeof STARDUST_PACKS)[number];

export function catalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((p) => p.id === id);
}

/** The game to the purchase server (its id there and its catalog) and to the browser's storage. */
export const GAME: GameIdentity = { gameId: 'skyjars', catalog: CATALOG, storagePrefix: 'skyjars:' };
