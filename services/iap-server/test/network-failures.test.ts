import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Harness, LOG_ERROR, purchaseNotification } from './support/harness.js';

let h: Harness;

beforeAll(async () => {
  h = await Harness.start();
});
afterAll(async () => {
  await h.stop();
});
beforeEach(async () => {
  await h.reset({ playTimeoutMs: 400 });
});
afterEach(async () => {
  await h.pool.query('DROP TRIGGER IF EXISTS fail_ledger_insert ON wallet_ledger');
  await h.assertLedgerConsistent();
});

const MINUTE = 60_000;

describe('network failures while verifying', () => {
  it.each([
    ['HTTP 500', 500],
    ['HTTP 503', 503],
    ['HTTP 429 (quota)', 429],
    ['a connection reset', 'reset'],
    ['a timeout', 'hang'],
  ] as const)('tells the client to keep the purchase and retry after %s, then grants once', async (_label, failure) => {
    const token = await h.buy('player-a', 'gems_100');
    h.fake.failNext('get', failure);

    const failed = await h.verify('player-a', 'gems_100', token);

    expect(failed.status).toBe(503);
    expect(failed.body.error).toMatchObject({ code: 'upstream_unavailable', retryable: true });
    expect(await h.purchaseRow(token)).toBeUndefined();
    expect(await h.ledger()).toHaveLength(0);

    const retried = await h.verify('player-a', 'gems_100', token);
    expect(retried.body.status).toBe('granted');
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('flags a service account without Play Console access as an operator problem', async () => {
    const token = await h.buy('player-a', 'gems_100');
    h.fake.failNext('get', 403);

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(503);
    expect(res.body.error.retryable).toBe(true);
    expect(h.logs.messages(LOG_ERROR)).toContain(
      'Google Play Developer API rejected the service account; check its credentials and Play Console permissions',
    );
  });
});

describe('network failures while consuming or acknowledging', () => {
  it('keeps the grant when consume fails and retries it in the background', async () => {
    const token = await h.buy('player-a', 'gems_100');
    h.fake.failNext('consume', 503);

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.body.status).toBe('granted');
    let row = (await h.purchaseRow(token))!;
    expect(row).toMatchObject({ fulfillment_state: 'pending', fulfillment_attempts: 1 });
    expect(h.fake.purchases.get(token)!.consumed).toBe(false);

    expect(await h.service.runFulfillment()).toBe(0); // backing off
    h.clock.advance(MINUTE);
    expect(await h.service.runFulfillment()).toBe(1);

    row = (await h.purchaseRow(token))!;
    expect(row.fulfillment_state).toBe('done');
    expect(h.fake.purchases.get(token)!.consumed).toBe(true);
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('notices that a consume whose response was lost actually succeeded', async () => {
    const token = await h.buy('player-a', 'gems_100');
    h.fake.failNext('consume', 'lost-response');

    await h.verify('player-a', 'gems_100', token);
    expect(h.fake.purchases.get(token)!.consumed).toBe(true);
    expect((await h.purchaseRow(token))!.fulfillment_state).toBe('pending');

    h.clock.advance(MINUTE);
    await h.service.runFulfillment();

    expect((await h.purchaseRow(token))!.fulfillment_state).toBe('done');
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('retries acknowledging a non-consumable with growing delays', async () => {
    const token = await h.buy('player-a', 'remove_ads');
    h.fake.failNext('acknowledge', 'reset', 3);

    await h.verify('player-a', 'remove_ads', token);
    h.clock.advance(MINUTE);
    await h.service.runFulfillment();
    h.clock.advance(2 * MINUTE);
    await h.service.runFulfillment();
    const row = (await h.purchaseRow(token))!;
    expect(row.fulfillment_attempts).toBe(3);
    expect(row.fulfillment_next_attempt_at!.getTime() - h.clock.now().getTime()).toBeGreaterThan(MINUTE);

    h.clock.advance(3 * MINUTE);
    await h.service.runFulfillment();
    expect(h.fake.purchases.get(token)!.acknowledged).toBe(true);
    expect((await h.purchaseRow(token))!.fulfillment_state).toBe('done');
    expect((await h.wallet('player-a')).entitlements).toEqual(['remove_ads']);
  });

  it('gives up near the end of the three-day window and logs it for the operator', async () => {
    const token = await h.buy('player-a', 'gems_100');
    h.fake.failNext('consume', 503, 1000);
    await h.verify('player-a', 'gems_100', token);

    for (let i = 0; i < 400 && (await h.purchaseRow(token))!.fulfillment_state === 'pending'; i++) {
      h.clock.advance(16 * MINUTE);
      await h.service.runFulfillment();
    }

    expect((await h.purchaseRow(token))!.fulfillment_state).toBe('failed');
    expect(h.logs.messages(LOG_ERROR).some((m) => m.startsWith('gave up acknowledging'))).toBe(true);
  });

  it('stops trying to consume a purchase that was refunded in the meantime', async () => {
    const token = await h.buy('player-a', 'gems_100');
    h.fake.failNext('consume', 503);
    await h.verify('player-a', 'gems_100', token);
    h.fake.voidPurchase(token, { seenAtMs: Date.now() });

    h.clock.advance(MINUTE);
    await h.service.runFulfillment();

    expect((await h.purchaseRow(token))!).toMatchObject({ state: 'revoked', fulfillment_state: 'not_required' });
    expect(await h.balances('player-a')).toEqual({ gems: 0 });
  });
});

describe('database failures', () => {
  it('rolls back the whole grant when a write fails half way', async () => {
    const token = await h.buy('player-a', 'starter_pack');
    // Fail the second currency's ledger write, after the purchase row and first credit.
    await h.pool.query(`
      CREATE OR REPLACE FUNCTION fail_on_coins() RETURNS trigger AS $$
      BEGIN
        IF NEW.currency = 'gems' THEN RAISE EXCEPTION 'injected failure'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_ledger_insert BEFORE INSERT ON wallet_ledger FOR EACH ROW EXECUTE FUNCTION fail_on_coins();
    `);

    const failed = await h.verify('player-a', 'starter_pack', token);

    expect(failed.status).toBe(500);
    expect(failed.body.error).toEqual({ code: 'internal_error', message: 'Internal error.', retryable: true });
    expect(await h.purchaseRow(token)).toBeUndefined();
    expect(await h.ledger()).toHaveLength(0);
    expect(await h.balances('player-a')).toEqual({});
    expect(h.fake.purchases.get(token)!.consumed).toBe(false);

    await h.pool.query('DROP TRIGGER fail_ledger_insert ON wallet_ledger');
    const retried = await h.verify('player-a', 'starter_pack', token);
    expect(retried.body.status).toBe('granted');
    expect(await h.balances('player-a')).toEqual({ gems: 500, coins: 1000 });
  });

  it('answers 5xx to Pub/Sub when the database fails, so the notification is redelivered', async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.pool.query(`
      CREATE OR REPLACE FUNCTION fail_always() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'injected failure'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_ledger_insert BEFORE INSERT ON wallet_ledger FOR EACH ROW EXECUTE FUNCTION fail_always();
    `);

    const failed = await h.push(purchaseNotification(token), { messageId: 'm-db' });
    await h.pool.query('DROP TRIGGER fail_ledger_insert ON wallet_ledger');
    const redelivered = await h.push(purchaseNotification(token), { messageId: 'm-db' });

    expect(failed.status).toBe(500);
    expect(redelivered.body).toEqual({ outcome: 'processed' });
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });
});

describe('network failures in the refund sync', () => {
  it('does not advance its checkpoint after a failed page, so nothing is skipped', async () => {
    const tokens = await Promise.all(Array.from({ length: 5 }, () => h.buy('player-a', 'gems_100')));
    for (const token of tokens) await h.verify('player-a', 'gems_100', token);
    for (const token of tokens) h.fake.voidPurchase(token, { seenAtMs: Date.now() - 5000 });
    h.fake.pageSize = 2;
    const game = h.catalog.gameById('game1')!;

    // The first page succeeds and the second fails.
    h.fake.failNext('voided', 503, 1, 1);
    await expect(h.service.syncVoidedPurchases(game)).rejects.toMatchObject({ kind: 'transient', status: 503 });
    expect((await h.pool.query('SELECT 1 FROM play_sync_state')).rowCount).toBe(0);
    expect(await h.balances('player-a')).toEqual({ gems: 300 });

    const result = await h.createService().syncVoidedPurchases(game);

    expect(result).toEqual({ skipped: false, processed: 5 });
    expect(await h.balances('player-a')).toEqual({ gems: 0 });
    expect((await h.ledger()).filter((l) => l.reason === 'play_revocation')).toHaveLength(5);
  });
});
