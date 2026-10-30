import type { CatalogItem } from '@game1/platform';
import type { GameIdentity } from '@game1/shell';

/**
 * Real-money products. The same ids must exist in Google Play Console and in the purchase
 * server's catalog (services/iap-server/config); the server, not this file, decides what a
 * purchase grants. Test prices only show in the browser version, where nothing is charged.
 */
export const CATALOG: readonly CatalogItem[] = [
  { id: 'coins_small', kind: 'consumable', grants: { coins: 500 }, testPrice: '$0.99' },
  // One-time products: Google Play never sells them twice to the same account.
  { id: 'remove_ads', kind: 'non_consumable', entitlement: 'remove_ads', testPrice: '$2.99' },
];

/** The game to the purchase server (its id there and its catalog) and to the browser's storage. */
export const GAME: GameIdentity = { gameId: 'starter', catalog: CATALOG, storagePrefix: 'starter:' };
