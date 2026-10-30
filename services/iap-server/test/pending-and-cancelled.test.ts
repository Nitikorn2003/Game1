import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Harness, ONE_TIME_PRODUCT_CANCELED, purchaseNotification } from './support/harness.js';

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

const MINUTE = 60_000;

describe('pending purchases', () => {
  it('reports pending without granting, consuming or acknowledging', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'pending', productId: 'gems_100', wallet: { balances: {} } });
    expect(h.fake.count('consume') + h.fake.count('acknowledge')).toBe(0);
    expect(await h.ledger()).toHaveLength(0);
    expect((await h.purchaseRow(token))!).toMatchObject({ state: 'pending', player_id: 'player-a' });
  });

  it('keeps answering pending while the payment is outstanding', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });

    for (let i = 0; i < 3; i++) expect((await h.verify('player-a', 'gems_100', token)).body.status).toBe('pending');

    expect(await h.ledger()).toHaveLength(0);
  });

  it('grants once when the ONE_TIME_PRODUCT_PURCHASED notification follows payment', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });
    await h.verify('player-a', 'gems_100', token);

    Object.assign(h.fake.purchases.get(token)!, { state: 'PURCHASED', completionTime: new Date().toISOString() });
    await h.push(purchaseNotification(token));

    expect(await h.balances('player-a')).toEqual({ gems: 100 });
    expect(h.fake.purchases.get(token)!.consumed).toBe(true);
    const res = await h.verify('player-a', 'gems_100', token);
    expect(res.body.status).toBe('already_granted');
  });

  it('grants when the player re-opens the game after paying, even if the notification is late', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });
    await h.verify('player-a', 'gems_100', token);

    h.fake.purchases.get(token)!.state = 'PURCHASED';
    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.body.status).toBe('granted');
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('finds a completed payment through the recheck job when the notification is lost', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });
    await h.verify('player-a', 'gems_100', token);
    h.fake.purchases.get(token)!.state = 'PURCHASED';

    expect(await h.service.runPendingRechecks()).toBe(0); // not due yet
    h.clock.advance(6 * MINUTE);
    expect(await h.service.runPendingRechecks()).toBe(1);

    expect(await h.balances('player-a')).toEqual({ gems: 100 });
    expect((await h.purchaseRow(token))!.recheck_at).toBeNull();
  });

  it('backs off rechecks of a purchase that stays pending', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });
    await h.verify('player-a', 'gems_100', token);

    h.clock.advance(6 * MINUTE);
    await h.service.runPendingRechecks();
    const after1 = (await h.purchaseRow(token))!;
    h.clock.advance(6 * MINUTE);
    expect(await h.service.runPendingRechecks()).toBe(0);
    h.clock.advance(10 * MINUTE);
    await h.service.runPendingRechecks();
    const after2 = (await h.purchaseRow(token))!;

    expect(after1.recheck_attempts).toBe(1);
    expect(after2.recheck_attempts).toBe(2);
    expect(after2.recheck_at!.getTime() - h.clock.now().getTime()).toBeGreaterThan(15 * MINUTE);
    expect(await h.ledger()).toHaveLength(0);
  });

  it('records a pending purchase that a notification reports before the client does', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });

    await h.push(purchaseNotification(token));

    expect((await h.purchaseRow(token))!).toMatchObject({ state: 'pending', player_id: 'player-a' });
  });
});

describe('cancelled purchases', () => {
  it('grants nothing for a purchase Google reports as cancelled', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'CANCELLED', completionTime: null });

    const res = await h.verify('player-a', 'gems_100', token);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('canceled');
    expect(await h.ledger()).toHaveLength(0);
    expect(h.fake.count('consume')).toBe(0);
  });

  it('cancels a pending purchase whose payment was abandoned', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });
    await h.verify('player-a', 'gems_100', token);

    h.fake.purchases.get(token)!.state = 'CANCELLED';
    await h.push(purchaseNotification(token, { type: ONE_TIME_PRODUCT_CANCELED }));

    expect((await h.purchaseRow(token))!.state).toBe('canceled');
    expect((await h.verify('player-a', 'gems_100', token)).body.status).toBe('canceled');
    expect(await h.ledger()).toHaveLength(0);
  });

  it('cancels through the recheck job when the cancel notification is lost', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });
    await h.verify('player-a', 'gems_100', token);
    h.fake.purchases.get(token)!.state = 'CANCELLED';

    h.clock.advance(6 * MINUTE);
    await h.service.runPendingRechecks();

    expect((await h.purchaseRow(token))!).toMatchObject({ state: 'canceled', recheck_at: null });
  });

  it('cancels when Google stops recognising the token of a pending purchase', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });
    await h.verify('player-a', 'gems_100', token);
    h.fake.purchases.delete(token);

    h.clock.advance(6 * MINUTE);
    await h.service.runPendingRechecks();

    expect((await h.purchaseRow(token))!.state).toBe('canceled');
  });

  it('never grants a cancelled purchase even if a late purchase notification arrives', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'CANCELLED', completionTime: null });
    await h.verify('player-a', 'gems_100', token);

    await h.push(purchaseNotification(token));

    expect(await h.ledger()).toHaveLength(0);
  });

  it('revokes what was granted if Google later reports the purchase as cancelled', async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.verify('player-a', 'gems_100', token);

    h.fake.purchases.get(token)!.state = 'CANCELLED';
    await h.push(purchaseNotification(token, { type: ONE_TIME_PRODUCT_CANCELED }));

    expect((await h.purchaseRow(token))!.state).toBe('revoked');
    expect(await h.balances('player-a')).toEqual({ gems: 0 });
  });
});
