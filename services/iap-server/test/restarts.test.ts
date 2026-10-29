import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import type { PlayDeveloperApi } from '../src/play/play-api.js';
import { TEST_DATABASE_URL } from './support/db.js';
import { Harness, purchaseNotification } from './support/harness.js';

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
  await h.pool.query('DROP TRIGGER IF EXISTS crash_on_ledger_insert ON wallet_ledger');
  await h.assertLedgerConsistent();
});

const MINUTE = 60_000;

/** A Play API whose consume call never returns, as when the server process dies mid-request. */
function consumeNeverReturns(play: PlayDeveloperApi): { play: PlayDeveloperApi; kill: () => void } {
  let kill = () => undefined as void;
  return {
    play: {
      ...play,
      consumeProduct: () =>
        new Promise<void>((_resolve, reject) => {
          kill = () => reject(new Error('process killed'));
        }),
    },
    kill: () => kill(),
  };
}

describe('server restarts during a purchase', () => {
  it('finishes consuming after a crash between the grant and the consume call, without granting twice', async () => {
    const token = await h.buy('player-a', 'gems_100');
    const game = h.catalog.gameById('game1')!;
    const doomed = consumeNeverReturns(h.play);
    const before = h.createService({ play: doomed.play });

    const inflight = before.verifyFromClient(game, 'player-a', 'gems_100', token);
    await h.waitFor(async () => (await h.purchaseRow(token))?.state === 'granted');

    // A new process starts. It must not take over an attempt that may still be running...
    const after = h.createService();
    expect(await after.runFulfillment()).toBe(0);
    // ...but once the lease runs out, the purchase is consumed exactly once.
    h.clock.advance(3 * MINUTE);
    expect(await after.runFulfillment()).toBe(1);

    expect(h.fake.purchases.get(token)!.consumed).toBe(true);
    expect((await h.purchaseRow(token))!.fulfillment_state).toBe('done');
    expect(await h.balances('player-a')).toEqual({ gems: 100 });

    // The game client never got an answer; after its own restart it submits the purchase again.
    const resubmitted = await h.verify('player-a', 'gems_100', token);
    expect(resubmitted.body).toMatchObject({ status: 'already_granted', wallet: { balances: { gems: 100 } } });

    doomed.kill();
    await inflight;
    expect(await h.ledger()).toHaveLength(1);
  });

  it('lets the client finish consumption after a crash without waiting for the background job', async () => {
    const token = await h.buy('player-a', 'remove_ads');
    const game = h.catalog.gameById('game1')!;
    const doomed = consumeNeverReturns(h.play);
    const failingAck: PlayDeveloperApi = {
      ...doomed.play,
      acknowledgeProduct: (...args) => doomed.play.consumeProduct(...args),
    };
    const inflight = h.createService({ play: failingAck }).verifyFromClient(game, 'player-a', 'remove_ads', token);
    await h.waitFor(async () => (await h.purchaseRow(token))?.state === 'granted');

    const res = await h.verify('player-a', 'remove_ads', token);

    expect(res.body.status).toBe('already_granted');
    expect(h.fake.purchases.get(token)!.acknowledged).toBe(true);
    expect((await h.purchaseRow(token))!.fulfillment_state).toBe('done');
    doomed.kill();
    await inflight;
  });

  it('commits nothing when the database connection dies in the middle of the grant', async () => {
    const token = await h.buy('player-a', 'gems_100');
    // Kill the server's own database session from inside its transaction.
    await h.pool.query(`
      CREATE OR REPLACE FUNCTION crash_backend() RETURNS trigger AS $$
      BEGIN PERFORM pg_terminate_backend(pg_backend_pid()); RETURN NEW; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER crash_on_ledger_insert AFTER INSERT ON wallet_ledger FOR EACH ROW EXECUTE FUNCTION crash_backend();
    `);

    const failed = await h.verify('player-a', 'gems_100', token);

    expect(failed.status).toBe(500);
    expect(failed.body.error.retryable).toBe(true);
    await h.pool.query('DROP TRIGGER crash_on_ledger_insert ON wallet_ledger');
    expect(await h.purchaseRow(token)).toBeUndefined();
    expect(await h.ledger()).toHaveLength(0);
    expect(h.fake.purchases.get(token)!.consumed).toBe(false);

    const retried = await h.verify('player-a', 'gems_100', token);
    expect(retried.body.status).toBe('granted');
    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('handles a notification that reaches a different, freshly started instance', async () => {
    const token = await h.buy('player-a', 'gems_100');
    await h.verify('player-a', 'gems_100', token);

    await h.configure(); // new process, same database
    await h.push(purchaseNotification(token));

    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('picks up pending purchases after a restart', async () => {
    const token = await h.buy('player-a', 'gems_100', { state: 'PENDING', completionTime: null });
    await h.verify('player-a', 'gems_100', token);
    h.fake.purchases.get(token)!.state = 'PURCHASED';

    await h.configure();
    h.clock.advance(6 * MINUTE);
    await h.service.runPendingRechecks();

    expect(await h.balances('player-a')).toEqual({ gems: 100 });
  });

  it('releases the refund sync lock when the instance holding it dies', async () => {
    const game = h.catalog.gameById('game1')!;
    const holder = new pg.Client({ connectionString: TEST_DATABASE_URL });
    holder.on('error', () => undefined); // its connection is about to be killed
    await holder.connect();
    await holder.query('SELECT pg_advisory_lock(hashtext($1))', [`iap:voided:${game.packageName}`]);

    expect(await h.service.syncVoidedPurchases(game)).toEqual({ skipped: true, processed: 0 });

    const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
    const ended = new Promise((resolve) => holder.once('end', resolve));
    await h.pool.query('SELECT pg_terminate_backend($1)', [pid]);
    await ended;

    expect(await h.service.syncVoidedPurchases(game)).toEqual({ skipped: false, processed: 0 });
  });

  it('applies migrations once when several instances start at the same time', async () => {
    const results = await Promise.all([migrate(h.pool), migrate(h.pool), migrate(h.pool)]);
    expect(results).toEqual([[], [], []]);
  });
});
