import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction } from '../src/db/tx.js';
import { applyLedgerEntryOnce, spendCurrency } from '../src/wallet/ledger.js';
import { Harness, purchaseNotification, voidedNotification } from './support/harness.js';

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

describe('duplicate purchase requests', () => {
  it('answers a repeated request from its records without granting or calling Google again', async () => {
    const token = await h.buy('player-a', 'gems_100');

    const first = await h.verify('player-a', 'gems_100', token);
    const second = await h.verify('player-a', 'gems_100', token);

    expect(first.body.status).toBe('granted');
    expect(second.status).toBe(200);
    expect(second.body.status).toBe('already_granted');
    expect(second.body.wallet.balances).toEqual({ gems: 100 });
    expect(h.fake.count('get')).toBe(1);
    expect(h.fake.count('consume')).toBe(1);
    expect(await h.ledger()).toHaveLength(1);
  });

  it('grants exactly once when 25 identical requests arrive at the same time', async () => {
    const token = await h.buy('player-a', 'gems_100');

    const results = await Promise.all(Array.from({ length: 25 }, () => h.verify('player-a', 'gems_100', token)));

    expect(results.map((r) => r.status)).toEqual(Array(25).fill(200));
    const statuses = results.map((r) => r.body.status as string);
    expect(statuses.filter((s) => s === 'granted')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'already_granted')).toHaveLength(24);
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
    expect(await h.ledger()).toHaveLength(1);
    expect(h.fake.purchases.get(token)!.consumed).toBe(true);
    expect((await h.purchaseRow(token))!.fulfillment_state).toBe('done');
  });

  it('grants exactly once when client requests and notifications race', async () => {
    const token = await h.buy('player-a', 'starter_pack', { quantity: 2 });

    await Promise.all([
      ...Array.from({ length: 10 }, () => h.verify('player-a', 'starter_pack', token)),
      ...Array.from({ length: 10 }, () => h.push(purchaseNotification(token, { sku: 'starter_pack' }))),
    ]);

    expect(await h.balances('player-a')).toEqual({ gems: 1000, coins: 2000 });
    expect(await h.ledger()).toHaveLength(2);
  });

  it('is not fooled by the same purchase submitted to a second game', async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.verify('player-a', 'gems_100', token);

    const res = await h.verify('player-a', 'gems_100', token, 'game2');

    expect(res.status).toBe(422);
    expect((await h.wallet('player-a', 'game2')).balances).toEqual({});
  });
});

describe('duplicate currency grants', () => {
  it('lets each ledger idempotency key move a balance only once', async () => {
    const entry = {
      gameId: 'game1',
      playerId: 'player-a',
      currency: 'gems',
      delta: 100,
      reason: 'play_purchase' as const,
      idempotencyKey: 'play:grant:test',
    };

    const results = await Promise.all(
      Array.from({ length: 10 }, () => withTransaction(h.pool, (tx) => applyLedgerEntryOnce(tx, entry))),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('has a database constraint that refuses a second ledger row for the same key', async () => {
    const insert = () =>
      h.pool.query(
        `INSERT INTO wallet_ledger (game_id, player_id, currency, delta, reason, idempotency_key)
         VALUES ('game1', 'player-a', 'gems', 100, 'play_purchase', 'play:grant:1')`,
      );
    await insert();
    await expect(insert()).rejects.toMatchObject({ code: '23505', constraint: 'wallet_ledger_idempotency' });
    // The direct inserts bypassed the balance on purpose; tidy up for the invariant check.
    await h.pool.query('DELETE FROM wallet_ledger');
  });

  it('refuses to mark a purchase granted without an owner, product, quantity and grant', async () => {
    await expect(
      h.pool.query(
        `INSERT INTO play_purchases (game_id, package_name, purchase_token, state) VALUES ('game1', 'p', 't', 'granted')`,
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'play_purchases_granted_is_complete' });
  });

  it('grants once when every entry point processes the same purchase at the same time', async () => {
    const token = await h.buy('player-a', 'gems_100');
    // Give the background jobs something to look at, too.
    await h.verify('player-a', 'gems_100', token);
    const row = (await h.purchaseRow(token))!;
    await h.pool.query(
      `UPDATE play_purchases SET fulfillment_state = 'pending', fulfillment_next_attempt_at = now() - interval '1 minute'
       WHERE id = $1`,
      [row.id],
    );
    h.fake.purchases.get(token)!.consumed = false;

    await Promise.all([
      ...Array.from({ length: 5 }, () => h.verify('player-a', 'gems_100', token)),
      ...Array.from({ length: 5 }, () => h.push(purchaseNotification(token))),
      h.service.runFulfillment(),
      h.service.runPendingRechecks(),
      h.service.syncVoidedPurchases(h.catalog.gameById('game1')!),
      h.createService().runFulfillment(),
    ]);

    expect(await h.balances('player-a')).toEqual({ gems: 100 });
    expect(await h.ledger()).toHaveLength(1);
    expect((await h.purchaseRow(token))!.fulfillment_state).toBe('done');
  });

  it('claws back once when refund signals are duplicated across both sources', async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.verify('player-a', 'gems_100', token);
    const orderId = h.fake.purchases.get(token)!.orderId!;
    h.fake.voidPurchase(token, { seenAtMs: h.clock.now().getTime() - 1000 });

    await Promise.all([
      ...Array.from({ length: 5 }, () => h.push(voidedNotification(token, { orderId }))),
      h.service.syncVoidedPurchases(h.catalog.gameById('game1')!),
      h.createService().syncVoidedPurchases(h.catalog.gameById('game1')!),
    ]);

    expect(await h.balances('player-a')).toEqual({ gems: 0 });
    expect((await h.ledger()).map((l) => l.delta)).toEqual([100, -100]);
  });

  it('spends each spend request once and never below zero', async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.verify('player-a', 'gems_100', token);
    const spend = (key: string, amount: number) =>
      spendCurrency(h.pool, { gameId: 'game1', playerId: 'player-a', currency: 'gems', amount, idempotencyKey: key });

    const same = await Promise.all(Array.from({ length: 5 }, () => spend('order-1', 30)));
    expect(same.filter((r) => r.status === 'spent')).toHaveLength(1);
    expect(same.filter((r) => r.status === 'duplicate')).toHaveLength(4);

    const different = await Promise.all(Array.from({ length: 5 }, (_, i) => spend(`order-${i + 2}`, 30)));
    expect(different.filter((r) => r.status === 'spent')).toHaveLength(2);
    expect(different.filter((r) => r.status === 'insufficient_funds')).toHaveLength(3);
    expect(await h.balances('player-a')).toEqual({ gems: 10 });
  });
});
