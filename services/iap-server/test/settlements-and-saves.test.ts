import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAX_SAVE_LENGTH } from '../src/saves/cloud-saves.js';
import { Harness, voidedNotification } from './support/harness.js';

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

async function granted(playerId: string, productId: string): Promise<{ token: string; orderId: string }> {
  const token = await h.buy(playerId, productId);
  const res = await h.verify(playerId, productId, token);
  expect(res.body.status).toBe('granted');
  return { token, orderId: h.fake.purchases.get(token)!.orderId! };
}

describe('one-time bundles', () => {
  it('grant their currency once together with the entitlement, and acknowledge instead of consuming', async () => {
    const { token } = await granted('player-a', 'founder_bundle');

    expect(await h.wallet('player-a')).toEqual({ balances: { eggs: 1, gems: 300 }, entitlements: ['founder'] });
    expect(h.fake.purchases.get(token)).toMatchObject({ acknowledged: true, consumed: false });
    const again = await h.verify('player-a', 'founder_bundle', token);
    expect(again.body.status).toBe('already_granted');
    expect(await h.balances('player-a')).toEqual({ eggs: 1, gems: 300 });
  });

  it('take back the currency and the entitlement when refunded', async () => {
    const { token, orderId } = await granted('player-a', 'founder_bundle');
    h.fake.voidPurchase(token, { seenAtMs: Date.now() });

    await h.push(voidedNotification(token, { orderId }));

    expect(await h.wallet('player-a')).toEqual({ balances: { eggs: 0, gems: 0 }, entitlements: [] });
  });
});

describe('wallet settlements', () => {
  it('move the wallet into the save once, and repeat the same answer for the same id', async () => {
    await granted('player-a', 'gems_100');
    await granted('player-a', 'founder_bundle');

    const first = await h.settle('player-a', 'settle-0001');
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ id: 'settle-0001', amounts: { eggs: 1, gems: 400 } });
    expect((await h.wallet('player-a')).balances).toEqual({ eggs: 0, gems: 0 });
    // The entitlement is not currency and stays in the wallet.
    expect((await h.wallet('player-a')).entitlements).toEqual(['founder']);

    // The answer was lost and the client asks again with the same id.
    const repeat = await h.settle('player-a', 'settle-0001');
    expect(repeat.body).toEqual(first.body);
    expect((await h.ledger('player-a')).filter((r) => r.reason === 'settlement')).toHaveLength(2);

    // A new settlement only moves what arrived since.
    await granted('player-a', 'gems_100');
    expect((await h.settle('player-a', 'settle-0002')).body).toEqual({ id: 'settle-0002', amounts: { gems: 100 } });
    expect((await h.settle('player-a', 'settle-0003')).body).toEqual({ id: 'settle-0003', amounts: {} });
  });

  it('move nothing new on a late repeat of an old settlement id', async () => {
    await granted('player-a', 'gems_100');
    await h.settle('player-a', 'settle-0001');
    await granted('player-a', 'founder_bundle');

    expect((await h.settle('player-a', 'settle-0001')).body).toEqual({ id: 'settle-0001', amounts: { gems: 100 } });
    expect((await h.wallet('player-a')).balances).toEqual({ eggs: 1, gems: 300 });
    expect((await h.settle('player-a', 'settle-0002')).body).toEqual({ id: 'settle-0002', amounts: { eggs: 1, gems: 300 } });
  });

  it('move a refund of settled currency into the save as a negative amount', async () => {
    const { token, orderId } = await granted('player-a', 'gems_100');
    await h.settle('player-a', 'settle-0001');
    h.fake.voidPurchase(token, { seenAtMs: Date.now() });
    await h.push(voidedNotification(token, { orderId }));
    expect((await h.wallet('player-a')).balances).toEqual({ gems: -100 });

    expect((await h.settle('player-a', 'settle-0002')).body).toEqual({ id: 'settle-0002', amounts: { gems: -100 } });
    expect((await h.wallet('player-a')).balances).toEqual({ gems: 0 });
  });

  it('move currency once when the same settlement arrives many times at once', async () => {
    await granted('player-a', 'gems_100');

    const answers = await Promise.all(Array.from({ length: 8 }, () => h.settle('player-a', 'settle-same')));

    for (const answer of answers) expect(answer.body).toEqual({ id: 'settle-same', amounts: { gems: 100 } });
    expect((await h.ledger('player-a')).filter((r) => r.reason === 'settlement')).toHaveLength(1);
  });

  it('give the wallet to exactly one of several different settlements running at once', async () => {
    await granted('player-a', 'gems_100');

    const answers = await Promise.all(Array.from({ length: 6 }, (_, i) => h.settle('player-a', `settle-${i}xxxxx`)));

    const moved = answers.map((a) => (a.body as { amounts: Record<string, number> }).amounts.gems ?? 0);
    expect(moved.reduce((sum, gems) => sum + gems, 0)).toBe(100);
    expect(moved.filter((gems) => gems !== 0)).toHaveLength(1);
  });

  it('keep players and games apart', async () => {
    await granted('player-a', 'gems_100');
    await granted('player-b', 'gems_100');

    expect((await h.settle('player-b', 'settle-0001')).body.amounts).toEqual({ gems: 100 });
    expect((await h.settle('player-a', 'settle-0001')).body.amounts).toEqual({ gems: 100 });
    expect((await h.settle('player-a', 'settle-0001', 'game2')).body.amounts).toEqual({});
  });

  it('refuse malformed ids and missing sign-in', async () => {
    expect((await h.settle('player-a', 'short')).status).toBe(400);
    expect((await h.settle('player-a', 'has spaces in it')).status).toBe(400);
    expect((await h.settle('player-a', 'x'.repeat(65))).status).toBe(400);
    const extra = await h.call('POST', '/v1/games/game1/wallet/settlements', { playerId: 'player-a', body: { settlementId: 'settle-0001', amounts: { gems: 5 } } });
    expect(extra.status).toBe(400);
    const anonymous = await h.call('POST', '/v1/games/game1/wallet/settlements', { body: { settlementId: 'settle-0001' } });
    expect(anonymous.status).toBe(401);
    expect((await h.settle('player-a', 'settle-0001', 'no-such-game')).status).toBe(404);
  });
});

describe('cloud saves', () => {
  it('start empty, then keep the latest save with a growing revision', async () => {
    expect((await h.call('GET', '/v1/games/game1/save', { playerId: 'player-a' })).body).toEqual({ save: null });

    const first = await h.putSave('player-a', null, 'save-v1');
    expect(first.status).toBe(200);
    expect(first.body.save).toMatchObject({ revision: 1, data: 'save-v1' });
    const second = await h.putSave('player-a', 1, 'save-v2');
    expect(second.body.save).toMatchObject({ revision: 2, data: 'save-v2' });

    const read = await h.call('GET', '/v1/games/game1/save', { playerId: 'player-a' });
    expect(read.body.save).toMatchObject({ revision: 2, data: 'save-v2' });
    expect(Date.parse(String(read.body.save.updatedAt))).not.toBeNaN();
  });

  it('refuse a write from a device that started from an older revision and hand back the newer save', async () => {
    await h.putSave('player-a', null, 'phone');
    await h.putSave('player-a', 1, 'tablet');

    const stale = await h.putSave('player-a', 1, 'phone again');
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('save_conflict');
    expect(stale.body.save).toMatchObject({ revision: 2, data: 'tablet' });

    const fresh = await h.putSave('player-a', null, 'new phone');
    expect(fresh.status).toBe(409);
    expect(fresh.body.save).toMatchObject({ revision: 2, data: 'tablet' });
  });

  it('let only one of two simultaneous writes from the same revision win', async () => {
    await h.putSave('player-a', null, 'start');

    const [a, b] = await Promise.all([h.putSave('player-a', 1, 'device a'), h.putSave('player-a', 1, 'device b')]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const read = await h.call('GET', '/v1/games/game1/save', { playerId: 'player-a' });
    expect(read.body.save.revision).toBe(2);
  });

  it('keep players and games apart', async () => {
    await h.putSave('player-a', null, 'a in game1');
    await h.putSave('player-b', null, 'b in game1');
    await h.putSave('player-a', null, 'a in game2', 'game2');

    expect((await h.call('GET', '/v1/games/game1/save', { playerId: 'player-a' })).body.save.data).toBe('a in game1');
    expect((await h.call('GET', '/v1/games/game1/save', { playerId: 'player-b' })).body.save.data).toBe('b in game1');
    expect((await h.call('GET', '/v1/games/game2/save', { playerId: 'player-a' })).body.save.data).toBe('a in game2');
  });

  it('refuse oversized or malformed saves and missing sign-in', async () => {
    expect((await h.putSave('player-a', null, 'x'.repeat(MAX_SAVE_LENGTH + 1))).status).toBe(400);
    expect((await h.putSave('player-a', null, '')).status).toBe(400);
    expect((await h.putSave('player-a', 0, 'save')).status).toBe(400);
    expect((await h.call('PUT', '/v1/games/game1/save', { playerId: 'player-a', body: { data: 'save' } })).status).toBe(400);
    expect((await h.call('PUT', '/v1/games/game1/save', { body: { baseRevision: null, data: 'save' } })).status).toBe(401);
    expect((await h.call('GET', '/v1/games/game1/save')).status).toBe(401);
  });

  it('limit how often one player writes', async () => {
    await h.reset({ playerWriteRateLimitPerMinute: 3 });
    for (let i = 0; i < 3; i++) expect((await h.settle('player-a', `settle-000${i}`)).status).toBe(200);
    const limited = await h.settle('player-a', 'settle-0009');
    expect(limited.status).toBe(429);
    expect(limited.body.error.retryable).toBe(true);
    expect((await h.settle('player-b', 'settle-0009')).status).toBe(200);
  });
});

describe('deleting a player', () => {
  it('removes the cloud save, settlements and billing account but keeps the payment records', async () => {
    await granted('player-a', 'gems_100');
    await h.settle('player-a', 'settle-0001');
    await h.putSave('player-a', null, 'save');
    await h.putSave('player-b', null, 'other player');

    const res = await h.call('DELETE', '/v1/games/game1/player', { playerId: 'player-a' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect((await h.call('GET', '/v1/games/game1/save', { playerId: 'player-a' })).body).toEqual({ save: null });
    expect((await h.call('GET', '/v1/games/game1/save', { playerId: 'player-b' })).body.save.data).toBe('other player');
    expect((await h.pool.query('SELECT 1 FROM wallet_settlements WHERE player_id = $1', ['player-a'])).rowCount).toBe(0);
    expect((await h.pool.query('SELECT 1 FROM player_billing_accounts WHERE player_id = $1', ['player-a'])).rowCount).toBe(0);
    expect((await h.pool.query('SELECT 1 FROM play_purchases WHERE player_id = $1', ['player-a'])).rowCount).toBe(1);
    expect((await h.call('DELETE', '/v1/games/game1/player')).status).toBe(401);
  });
});
