import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/catalog.js';

interface ServerProduct {
  productId: string;
  type: 'consumable' | 'non_consumable';
  grants?: Record<string, number>;
  entitlement?: string;
}

const serverCatalog = JSON.parse(readFileSync(new URL('../../../services/iap-server/config/catalog.example.json', import.meta.url), 'utf8')) as {
  games: { gameId: string; products: ServerProduct[] }[];
};

describe('the product catalog', () => {
  it('matches what the purchase server grants for each product', () => {
    const server = serverCatalog.games.find((g) => g.gameId === 'lodelings');
    expect(server).toBeDefined();
    const fromServer = (server?.products ?? []).map((p) => ({ id: p.productId, kind: p.type, grants: p.grants, entitlement: p.entitlement }));
    const fromGame = CATALOG.map((p) => ({ id: p.id, kind: p.kind, grants: p.grants, entitlement: p.entitlement }));
    expect(fromGame).toEqual(fromServer);
  });
});
