import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GAME2_PACKAGE, Harness, newPurchaseToken, purchaseNotification } from './support/harness.js';

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

describe('invalid purchase tokens', () => {
  it('rejects a token that Google does not know, without storing anything', async () => {
    await h.billingAccount('player-a');
    const token = newPurchaseToken();

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({
      code: 'invalid_purchase_token',
      message: 'Google Play does not recognise this purchase.',
      retryable: false,
    });
    expect(h.fake.count('get')).toBe(1);
    expect(await h.purchaseRow(token)).toBeUndefined();
    expect(await h.ledger()).toHaveLength(0);
  });

  it.each([
    ['empty', ''],
    ['too short', 'abc'],
    ['whitespace', 'abc def ghi jkl'],
    ['control characters', 'abcdefgh\u0000ijkl'],
    ['non-ASCII', 'abcdefghéijkl'],
    ['too long', 'a'.repeat(4097)],
  ])('rejects a malformed token (%s) before calling Google', async (_label, token) => {
    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
    expect(h.fake.calls).toHaveLength(0);
  });

  it('rejects non-string and missing fields', async () => {
    for (const body of [{}, { productId: 'gems_100' }, { productId: 'gems_100', purchaseToken: 12345678 }, [], null]) {
      const res = await h.call('POST', '/v1/games/game1/purchases/google-play', {
        playerId: 'player-a',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.status).toBe(400);
    }
    const text = await h.call('POST', '/v1/games/game1/purchases/google-play', { playerId: 'player-a', body: 'token' });
    expect(text.status).toBe(415);
    expect(h.fake.calls).toHaveLength(0);
  });

  it('cannot use path characters in a token to reach another Google API resource', async () => {
    const token = 'abcdefgh/../../voidedpurchases';

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(422);
    // The official client percent-encodes the token, so it arrives as one path segment.
    expect(h.fake.calls).toEqual([{ op: 'get', token, query: {} }]);
  });

  it('rejects a real purchase from a different app', async () => {
    const token = await h.buy('player-a', 'gems_100', { packageName: GAME2_PACKAGE });

    const res = await h.verify('player-a', 'gems_100', token, 'game1');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_purchase_token');
    expect(h.fake.purchases.get(token)!.consumed).toBe(false);
  });

  it('rejects a token presented for a different product than the one bought', async () => {
    const token = await h.buy('player-a', 'gems_100');

    const res = await h.verify('player-a', 'starter_pack', token);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('product_mismatch');
    expect(h.fake.purchases.get(token)!.consumed).toBe(false);
    expect(await h.ledger()).toHaveLength(0);
  });

  it('rejects a product id that is not sold in the game without calling Google', async () => {
    const token = await h.buy('player-a', 'gems_100');

    const res = await h.verify('player-a', 'gems_9999', token);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('unknown_product');
    expect(h.fake.calls).toHaveLength(0);
  });

  it('rejects an unknown game', async () => {
    const res = await h.verify('player-a', 'gems_100', newPurchaseToken(), 'no-such-game');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('unknown_game');
  });

  it('holds, without granting or acknowledging, a paid purchase of a product missing from the catalog', async () => {
    const token = await h.buy('player-a', 'legacy_gems');

    const res = await h.push(purchaseNotification(token, { sku: 'legacy_gems' }));

    expect(res.status).toBe(200);
    const row = (await h.purchaseRow(token))!;
    expect(row).toMatchObject({ state: 'rejected', rejection_reason: 'unknown_product' });
    // Left unacknowledged, so Google refunds the buyer automatically after three days.
    expect(h.fake.purchases.get(token)).toMatchObject({ consumed: false, acknowledged: false });
    expect(h.fake.count('refund')).toBe(0);
    expect(await h.ledger()).toHaveLength(0);
  });

  it.each([
    ['a rental', { rental: true }, 'unsupported_rental'],
    ['several line items', { lineItemCount: 2 }, 'unsupported_line_items'],
    ['a quantity above the limit', { quantity: 10_001 }, 'invalid_quantity'],
  ])('rejects %s', async (_label, init, reason) => {
    const token = await h.buy('player-a', 'gems_100', init);

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('purchase_rejected');
    expect((await h.purchaseRow(token))!.rejection_reason).toBe(reason);
    expect(await h.ledger()).toHaveLength(0);
    expect(h.fake.purchases.get(token)!.consumed).toBe(false);
  });

  it('rejects a multi-quantity purchase of a non-consumable', async () => {
    const token = await h.buy('player-a', 'remove_ads', { quantity: 2 });

    const res = await h.verify('player-a', 'remove_ads', token);

    expect(res.status).toBe(422);
    expect((await h.purchaseRow(token))!.rejection_reason).toBe('invalid_quantity');
    expect((await h.wallet('player-a')).entitlements).toEqual([]);
  });

  it('rejects license-tester purchases when test purchases are not allowed', async () => {
    await h.reset({ policy: { allowTestPurchases: false } });
    const token = await h.buy('player-a', 'gems_100', { test: true });

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(422);
    expect((await h.purchaseRow(token))!.rejection_reason).toBe('test_purchase_not_allowed');
    expect(await h.ledger()).toHaveLength(0);
  });

  it('grants a held purchase if the operator changes the policy and the player retries', async () => {
    await h.reset({ policy: { allowTestPurchases: false } });
    const token = await h.buy('player-a', 'gems_100', { test: true });
    expect((await h.verify('player-a', 'gems_100', token)).status).toBe(422);

    // Restart with the new setting; the database is kept.
    await h.configure({ policy: { allowTestPurchases: true } });
    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.body.status).toBe('granted');
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });
});
