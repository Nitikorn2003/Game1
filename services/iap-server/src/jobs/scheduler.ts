import type { Catalog } from '../catalog.js';
import type { Logger } from '../logging.js';
import { describe, type PurchaseService } from '../purchases/service.js';

export interface JobIntervals {
  fulfillmentMs: number;
  pendingRecheckMs: number;
  /** Voided Purchases API quota is 6,000 queries a day and 30 per 30 seconds per app. */
  voidedSyncMs: number;
}

export const DEFAULT_INTERVALS: JobIntervals = {
  fulfillmentMs: 30_000,
  pendingRecheckMs: 60_000,
  voidedSyncMs: 10 * 60_000,
};

/** Runs every job once, for `cli.js jobs --once` under an external cron. Returns false if any failed. */
export async function runAllJobsOnce(purchases: PurchaseService, catalog: Catalog, logger: Logger): Promise<boolean> {
  const results = [
    await safely(logger, 'fulfillment', () => purchases.runFulfillment()),
    await safely(logger, 'pending-recheck', () => purchases.runPendingRechecks()),
  ];
  for (const game of catalog.games) {
    results.push(await safely(logger, `voided-sync:${game.gameId}`, () => purchases.syncVoidedPurchases(game)));
  }
  return results.every(Boolean);
}

/**
 * Simple in-process scheduler. Safe to run on several instances at once: due rows are
 * claimed with FOR UPDATE SKIP LOCKED and the voided sync takes a per-app advisory lock.
 */
export function startBackgroundJobs(
  purchases: PurchaseService,
  catalog: Catalog,
  logger: Logger,
  intervals: JobIntervals = DEFAULT_INTERVALS,
): () => Promise<void> {
  const loops = [
    loop(intervals.fulfillmentMs, async () => {
      await safely(logger, 'fulfillment', () => purchases.runFulfillment());
    }),
    loop(intervals.pendingRecheckMs, async () => {
      await safely(logger, 'pending-recheck', () => purchases.runPendingRechecks());
    }),
    loop(intervals.voidedSyncMs, async () => {
      for (const game of catalog.games) {
        await safely(logger, `voided-sync:${game.gameId}`, () => purchases.syncVoidedPurchases(game));
      }
    }),
  ];
  return async () => {
    await Promise.all(loops.map((stop) => stop()));
  };
}

function loop(intervalMs: number, task: () => Promise<void>): () => Promise<void> {
  let stopped = false;
  let running: Promise<void> = Promise.resolve();
  let timer: NodeJS.Timeout | undefined;
  const schedule = () => {
    if (stopped) return;
    // Jitter spreads instances apart so they do not hit Google at the same moment.
    timer = setTimeout(tick, intervalMs * (0.8 + Math.random() * 0.4));
    timer.unref();
  };
  const tick = () => {
    running = task().finally(schedule);
  };
  schedule();
  return async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await running;
  };
}

async function safely(logger: Logger, name: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (err) {
    logger.error({ job: name, err: describe(err) }, 'background job failed; will run again');
    return false;
  }
}
