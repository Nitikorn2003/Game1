import type { CatalogItem } from '@game1/platform';
import type { GameIdentity } from '@game1/shell';

/**
 * Real-money products. The same ids must exist in Google Play Console and in the purchase
 * server's catalog (services/iap-server/config); the server, not this file, decides what a
 * purchase grants. Test prices only show in the browser version, where nothing is charged.
 * Nothing sold is random.
 */
export const CATALOG: readonly CatalogItem[] = [
  { id: 'coins_small', kind: 'consumable', grants: { coins: 500 }, testPrice: '$0.99' },
  { id: 'coins_medium', kind: 'consumable', grants: { coins: 3000 }, testPrice: '$4.99' },
  { id: 'coins_large', kind: 'consumable', grants: { coins: 7000 }, testPrice: '$9.99' },
  // One-time products: Google Play never sells them twice to the same account.
  { id: 'keeper_kit', kind: 'non_consumable', grants: { coins: 1000, rainbow: 5, bomb: 5, sunbeam: 5 }, entitlement: 'keeper_kit', testPrice: '$1.99' },
  { id: 'remove_ads', kind: 'non_consumable', entitlement: 'remove_ads', testPrice: '$2.99' },
  { id: 'meadow_collection', kind: 'non_consumable', entitlement: 'meadow_collection', testPrice: '$3.99' },
];

export const COIN_PACKS = ['coins_small', 'coins_medium', 'coins_large'] as const;
export type CoinPack = (typeof COIN_PACKS)[number];

export function catalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((p) => p.id === id);
}

/** The game to the purchase server (its id there and its catalog) and to the browser's storage. */
export const GAME: GameIdentity = { gameId: 'bloomhive', catalog: CATALOG, storagePrefix: 'bloomhive:' };
