import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spendCurrency } from '../src/wallet/ledger.js';
import { GAME1_PACKAGE, Harness, LOG_ERROR, newPurchaseToken, purchaseNotification, voidedNotification } from './support/harness.js';

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

const FULL = 1;
const PARTIAL = 2;

async function grantedPurchase(productId: string, init = {}): Promise<{ token: string; orderId: string }> {
  const token = await h.buy('player-a', productId, init);
  const res = await h.verify('player-a', productId, token);
  expect(res.body.status).toBe('granted');
  return { token, orderId: h.fake.purchases.get(token)!.orderId! };
}

function spend(amount: number, key: string) {
  return spendCurrency(h.pool, { gameId: 'game1', playerId: 'player-a', currency: 'gems', amount, idempotencyKey: key });
}

describe('refunds and revoked purchases', () => {
  it('claws back currency on a full refund notification', async () => {
    const { token, orderId } = await grantedPurchase('gems_100');
    h.fake.voidPurchase(token, { seenAtMs: Date.now() });

    const res = await h.push(voidedNotification(token, { orderId, refundType: FULL }));

    expect(res.body.outcome).toBe('processed');
    expect(await h.balances('player-a')).toEqual({ gems: 0 });
    expect((await h.ledger()).map((l) => [l.reason, l.delta])).toEqual([
      ['play_purchase', 100],
      ['play_revocation', -100],
    ]);
    const row = (await h.purchaseRow(token))!;
    expect(row).toMatchObject({ state: 'revoked', revoked_quantity: 1 });
    expect((await h.verify('player-a', 'gems_100', token)).body.status).toBe('revoked');
  });

  it('lets the balance go negative when refunded currency was already spent, and blocks spending', async () => {
    const { token, orderId } = await grantedPurchase('gems_100');
    expect((await spend(60, 'sword')).status).toBe('spent');
    h.fake.voidPurchase(token, { seenAtMs: Date.now() });

    await h.push(voidedNotification(token, { orderId }));

    expect(await h.balances('player-a')).toEqual({ gems: -60 });
    expect(await spend(1, 'potion')).toEqual({ status: 'insufficient_funds', balance: -60 });
  });

  it('claws back only the refunded units of a partial (quantity-based) refund', async () => {
    const { token, orderId } = await grantedPurchase('gems_100', { quantity: 3 });

    h.fake.voidPurchase(token, { quantity: 1, seenAtMs: Date.now() });
    await h.push(voidedNotification(token, { orderId, refundType: PARTIAL }));
    expect(await h.balances('player-a')).toEqual({ gems: 200 });

    // A replay of the same refund changes nothing.
    await h.push(voidedNotification(token, { orderId, refundType: PARTIAL }));
    expect(await h.balances('player-a')).toEqual({ gems: 200 });

    h.fake.voidPurchase(token, { quantity: 1, seenAtMs: Date.now() + 1 });
    await h.push(voidedNotification(token, { orderId, refundType: PARTIAL }));
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
    expect((await h.purchaseRow(token))!).toMatchObject({ state: 'granted', revoked_quantity: 2 });

    h.fake.voidPurchase(token, { quantity: 1, seenAtMs: Date.now() + 2 });
    await h.push(voidedNotification(token, { orderId, refundType: PARTIAL }));
    expect(await h.balances('player-a')).toEqual({ gems: 0 });
    expect((await h.purchaseRow(token))!.state).toBe('revoked');
  });

  it('revokes a refunded non-consumable', async () => {
    const { token, orderId } = await grantedPurchase('remove_ads');
    h.fake.voidPurchase(token, { seenAtMs: Date.now() });

    await h.push(voidedNotification(token, { orderId }));

    expect((await h.wallet('player-a')).entitlements).toEqual([]);
    const ent = await h.pool.query('SELECT state, revoked_at FROM entitlements');
    expect(ent.rows[0]).toMatchObject({ state: 'revoked' });
  });

  it('keeps an entitlement that is still backed by a second, unrefunded purchase', async () => {
    const first = await grantedPurchase('remove_ads');
    // Same player, bought again from a second Google account on another device.
    const second = await grantedPurchase('remove_ads');

    h.fake.voidPurchase(second.token, { seenAtMs: Date.now() });
    await h.push(voidedNotification(second.token, { orderId: second.orderId }));
    expect((await h.wallet('player-a')).entitlements).toEqual(['remove_ads']);

    h.fake.voidPurchase(first.token, { seenAtMs: Date.now() });
    await h.push(voidedNotification(first.token, { orderId: first.orderId }));
    expect((await h.wallet('player-a')).entitlements).toEqual([]);
  });

  it('never grants a purchase whose refund arrived before the purchase itself', async () => {
    const token = await h.buy('player-a', 'gems_100');
    const orderId = h.fake.purchases.get(token)!.orderId!;
    h.fake.voidPurchase(token, { seenAtMs: Date.now() });
    // Simulate the stale view a client can have: Google still returns PURCHASED for a moment.
    h.fake.purchases.get(token)!.state = 'PURCHASED';

    await h.push(voidedNotification(token, { orderId }));
    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.body.status).toBe('canceled');
    expect(await h.ledger()).toHaveLength(0);
    expect(h.fake.count('consume')).toBe(0);
  });

  it('does not grant units that were refunded before the grant', async () => {
    const token = await h.buy('player-a', 'gems_100', { quantity: 3 });
    h.fake.voidPurchase(token, { quantity: 2, seenAtMs: Date.now() });

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.body.status).toBe('granted');
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('claws back a refund whose notification was lost, through the voided purchases sync', async () => {
    const { token } = await grantedPurchase('gems_100');
    h.fake.voidPurchase(token, { seenAtMs: Date.now() - 1000 });
    const game = h.catalog.gameById('game1')!;

    expect(await h.service.syncVoidedPurchases(game)).toEqual({ skipped: false, processed: 1 });
    expect(await h.balances('player-a')).toEqual({ gems: 0 });

    // The next run re-reads an overlapping window but claws back nothing twice.
    expect((await h.service.syncVoidedPurchases(game)).processed).toBe(1);
    expect(await h.balances('player-a')).toEqual({ gems: 0 });
    const call = h.fake.calls.find((c) => c.op === 'voided')!;
    expect(call.query).toMatchObject({ type: '0', includeQuantityBasedPartialRefund: 'true' });
  });

  it('reads every page of the voided purchases list', async () => {
    const purchases = [];
    for (let i = 0; i < 5; i++) purchases.push(await grantedPurchase('gems_100'));
    for (const p of purchases) h.fake.voidPurchase(p.token, { seenAtMs: Date.now() - 1000 });
    h.fake.pageSize = 2;

    const result = await h.service.syncVoidedPurchases(h.catalog.gameById('game1')!);

    expect(result.processed).toBe(5);
    expect(h.fake.count('voided')).toBe(3);
    expect(await h.balances('player-a')).toEqual({ gems: 0 });
  });

  it('applies partial refunds reported by the voided purchases sync', async () => {
    const { token } = await grantedPurchase('gems_100', { quantity: 4 });
    h.fake.voidPurchase(token, { quantity: 3, seenAtMs: Date.now() - 1000 });

    await h.service.syncVoidedPurchases(h.catalog.gameById('game1')!);

    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('skips the sync on one instance while another holds the lock', async () => {
    const game = h.catalog.gameById('game1')!;
    const [a, b] = await Promise.all([h.service.syncVoidedPurchases(game), h.createService().syncVoidedPurchases(game)]);
    expect([a.skipped, b.skipped].sort()).toEqual([false, true]);
  });

  it('logs chargeback reviews for a human to handle within 24 hours', async () => {
    const res = await h.push({
      version: '1.0',
      packageName: GAME1_PACKAGE,
      eventTimeMillis: String(Date.now()),
      pendingRefundReviewNotification: { orderId: 'GPA.1234' },
    });
    expect(res.body.outcome).toBe('processed');
    expect(h.logs.messages(LOG_ERROR).some((m) => m.startsWith('chargeback review requested'))).toBe(true);
  });
});

describe('purchases that fail validation (rejected)', () => {
  async function rejectedPurchase(): Promise<string> {
    const token = newPurchaseToken();
    h.fake.addPurchase(token, { productId: 'gems_100', obfuscatedAccountId: 'unknown-account' });
    await h.push(purchaseNotification(token));
    expect((await h.purchaseRow(token))!.state).toBe('rejected');
    return token;
  }

  it('holds them by default: no grant, no acknowledgement and no refund call', async () => {
    const token = await rejectedPurchase();
    expect(h.fake.count('refund')).toBe(0);
    expect(h.fake.purchases.get(token)).toMatchObject({ consumed: false, acknowledged: false });
  });

  it('refunds and revokes them once when the operator enables the refund policy', async () => {
    await h.reset({ policy: { rejectedPurchasePolicy: 'refund' } });
    const token = await rejectedPurchase();
    // A second notification for the same purchase does not refund it again.
    await h.push(purchaseNotification(token));

    expect(h.fake.refunds).toEqual([{ orderId: h.fake.purchases.get(token)!.orderId, revoke: true }]);
    expect((await h.purchaseRow(token))!.refund_requested_at).not.toBeNull();
    expect(await h.ledger()).toHaveLength(0);
  });

  it('never grants a purchase after asking Google to refund it', async () => {
    await h.reset({ policy: { rejectedPurchasePolicy: 'refund' } });
    const token = await rejectedPurchase();
    // Even if Google were to report it as purchased and properly bound afterwards.
    const accountId = await h.billingAccount('player-a');
    Object.assign(h.fake.purchases.get(token)!, { state: 'PURCHASED', obfuscatedAccountId: accountId, refundableQuantity: 1 });

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(422);
    expect(await h.ledger()).toHaveLength(0);
  });

  it('lets an operator refund a held purchase explicitly, once', async () => {
    const token = await rejectedPurchase();
    const id = (await h.purchaseRow(token))!.id;

    const [a, b] = await Promise.all([h.service.refundRejectedPurchase(id), h.service.refundRejectedPurchase(id)]);

    expect([a, b].sort()).toEqual(['already_requested', 'refund_requested']);
    expect(h.fake.refunds).toHaveLength(1);
  });

  it('refuses to refund a purchase that was granted', async () => {
    const { token } = await grantedPurchase('gems_100');
    const id = (await h.purchaseRow(token))!.id;

    await expect(h.service.refundRejectedPurchase(id)).rejects.toThrow('only rejected purchases are refunded');
    expect(h.fake.refunds).toHaveLength(0);
  });

  it('releases the refund claim when the refund call fails, so it can be retried', async () => {
    const token = await rejectedPurchase();
    const id = (await h.purchaseRow(token))!.id;
    h.fake.failNext('refund', 503);

    await expect(h.service.refundRejectedPurchase(id)).rejects.toMatchObject({ kind: 'transient' });
    expect((await h.purchaseRow(token))!.refund_requested_at).toBeNull();
    expect(await h.service.refundRejectedPurchase(id)).toBe('refund_requested');
  });
});
