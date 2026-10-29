import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runAllJobsOnce, startBackgroundJobs } from '../src/jobs/scheduler.js';
import { Harness, LOG_ERROR } from './support/harness.js';

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

describe('background jobs', () => {
  it('runs fulfillment, pending rechecks and the refund sync on a schedule, and stops cleanly', async () => {
    const token = await h.buy('player-a', 'gems_100');
    h.fake.failNext('consume', 503);
    await h.verify('player-a', 'gems_100', token);
    h.clock.advance(5 * 60_000);

    const stop = startBackgroundJobs(h.service, h.catalog, h.logger, { fulfillmentMs: 20, pendingRecheckMs: 20, voidedSyncMs: 20 });
    await h.waitFor(async () => (await h.purchaseRow(token))?.fulfillment_state === 'done');
    await h.waitFor(() => Promise.resolve(h.fake.count('voided') >= 2));
    await stop();

    const calls = h.fake.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(h.fake.calls.length).toBe(calls);
  });

  it('keeps running after a job fails, and reports the failure for cron use', async () => {
    h.fake.failNext('voided', 500, 2);

    expect(await runAllJobsOnce(h.service, h.catalog, h.logger)).toBe(false);
    expect(h.logs.messages(LOG_ERROR)).toContain('background job failed; will run again');
    expect(await runAllJobsOnce(h.service, h.catalog, h.logger)).toBe(true);
  });
});
