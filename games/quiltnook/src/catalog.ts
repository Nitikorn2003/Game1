import type { CatalogItem } from '@game1/platform';
import type { GameIdentity } from '@game1/shell';

/**
 * Real-money products. The same ids must exist in Google Play Console and in the purchase
 * server's catalog (services/iap-server/config); the server, not this file, decides what a
 * purchase grants. Test prices only show in the browser version, where nothing is charged.
 * Nothing sold is random.
 */
export const CATALOG: readonly CatalogItem[] = [
  { id: 'spools_small', kind: 'consumable', grants: { spools: 60 }, testPrice: '$0.99' },
  { id: 'spools_medium', kind: 'consumable', grants: { spools: 350 }, testPrice: '$4.99' },
  { id: 'spools_large', kind: 'consumable', grants: { spools: 800 }, testPrice: '$9.99' },
  // One-time products: Google Play never sells them twice to the same account.
  { id: 'sewing_kit', kind: 'non_consumable', grants: { spools: 200 }, entitlement: 'sewing_kit', testPrice: '$1.99' },
  { id: 'remove_ads', kind: 'non_consumable', entitlement: 'remove_ads', testPrice: '$2.99' },
  { id: 'fabric_chest', kind: 'non_consumable', entitlement: 'fabric_chest', testPrice: '$3.99' },
];

export const SPOOL_PACKS = ['spools_small', 'spools_medium', 'spools_large'] as const;
export type SpoolPack = (typeof SPOOL_PACKS)[number];

export function catalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((p) => p.id === id);
}

/** The game to the purchase server (its id there and its catalog) and to the browser's storage. */
export const GAME: GameIdentity = { gameId: 'quiltnook', catalog: CATALOG, storagePrefix: 'quiltnook:' };
