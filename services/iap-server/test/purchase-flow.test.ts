import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Harness } from './support/harness.js';

let h: Harness;

beforeAll(async () => {
  h = await Harness.start();
});
afterAll(async () => {
  await h.stop();
});
beforeEach(async () => {
  await h.reset();
});
afterEach(async () => {
  await h.assertLedgerConsistent();
});

describe('server-verified purchase flow', () => {
  it('credits a consumable once Google confirms it, then consumes it', async () => {
    const token = await h.buy('player-a', 'gems_100');

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'granted',
      productId: 'gems_100',
      quantity: 1,
      wallet: { balances: { gems: 100 }, entitlements: [] },
    });
    expect(h.fake.purchases.get(token)!.consumed).toBe(true);
    expect(h.fake.count('get')).toBe(1);
    expect(h.fake.count('consume')).toBe(1);
    expect(h.fake.count('acknowledge')).toBe(0);
    const row = (await h.purchaseRow(token))!;
    expect(row).toMatchObject({ state: 'granted', player_id: 'player-a', fulfillment_state: 'done', is_test: true });
    expect(await h.events(row.id)).toEqual(['granted', 'consumed']);
  });

  it('uses the quantity and grants that Google and the catalog report', async () => {
    const token = await h.buy('player-a', 'starter_pack', { quantity: 3 });

    const res = await h.verify('player-a', 'starter_pack', token);

    expect(res.body.status).toBe('granted');
    expect(res.body.quantity).toBe(3);
    expect(await h.balances('player-a')).toEqual({ gems: 1500, coins: 3000 });
    expect(await h.ledger('player-a')).toHaveLength(2);
  });

  it('activates a non-consumable entitlement and acknowledges instead of consuming', async () => {
    const token = await h.buy('player-a', 'remove_ads');

    const res = await h.verify('player-a', 'remove_ads', token);

    expect(res.body.status).toBe('granted');
    expect(res.body.wallet.entitlements).toEqual(['remove_ads']);
    expect(h.fake.purchases.get(token)).toMatchObject({ acknowledged: true, consumed: false });
    expect(h.fake.count('consume')).toBe(0);
    expect(h.fake.count('acknowledge')).toBe(1);
  });

  it('refuses requests that try to report the payment result themselves', async () => {
    const token = await h.buy('player-a', 'gems_100');

    const res = await h.call('POST', '/v1/games/game1/purchases/google-play', {
      playerId: 'player-a',
      body: { productId: 'gems_100', purchaseToken: token, purchaseState: 'PURCHASED', quantity: 50 },
    });

    expect(res.status).toBe(400);
    expect(h.fake.count('get')).toBe(0);
    expect(await h.ledger()).toHaveLength(0);
  });

  it('does not grant when the client says the payment succeeded but Google says it is pending', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(await h.ledger()).toHaveLength(0);
  });

  it('serves the wallet of the signed-in player only', async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.verify('player-a', 'gems_100', token);

    expect((await h.wallet('player-a')).balances).toEqual({ gems: 100 });
    expect((await h.wallet('player-b')).balances).toEqual({});
    const spoof = await h.call('GET', '/v1/games/game1/wallet?playerId=player-a', { playerId: 'player-b' });
    expect(spoof.body.balances).toEqual({});
  });

  it('keeps wallets separate per game', async () => {
    const token = await h.buy('player-a', 'gems_100', {}, 'game2');
    const res = await h.verify('player-a', 'gems_100', token, 'game2');

    expect(res.body.status).toBe('granted');
    expect((await h.wallet('player-a', 'game2')).balances).toEqual({ gems: 100 });
    expect((await h.wallet('player-a', 'game1')).balances).toEqual({});
  });

  it('answers health and readiness probes', async () => {
    expect((await h.call('GET', '/healthz')).status).toBe(200);
    expect((await h.call('GET', '/readyz')).status).toBe(200);
  });
});
