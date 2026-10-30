import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { runAllJobsOnce } from './jobs/scheduler.js';
import { deletePlayerData } from './players/delete-player.js';
import { createLogger, createServices } from './server.js';

const USAGE = `Usage:
  node dist/cli.js migrate
  node dist/cli.js jobs --once
  node dist/cli.js refund-rejected --purchase-id <id> --confirm
  node dist/cli.js delete-player --player <sign-in user id> --confirm
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const config = loadConfig();
  const logger = createLogger(config);

  switch (command ?? '') {
    case 'migrate': {
      const pool = createPool(config.DATABASE_URL, 1, (err) => logger.warn({ err: err.message }, 'database connection lost'));
      try {
        const applied = await migrate(pool);
        logger.info({ applied }, 'migrations complete');
      } finally {
        await pool.end();
      }
      return 0;
    }
    case 'jobs': {
      if (!rest.includes('--once')) break;
      const services = createServices(config, logger);
      try {
        return (await runAllJobsOnce(services.purchases, services.catalog, logger)) ? 0 : 1;
      } finally {
        await services.pool.end();
      }
    }
    case 'refund-rejected': {
      const idIndex = rest.indexOf('--purchase-id');
      const purchaseId = Number(rest[idIndex + 1]);
      if (idIndex < 0 || !Number.isSafeInteger(purchaseId)) break;
      if (!rest.includes('--confirm')) {
        logger.error({}, 'refunds move real money and cannot be undone; re-run with --confirm');
        return 2;
      }
      const services = createServices(config, logger);
      try {
        const outcome = await services.purchases.refundRejectedPurchase(purchaseId);
        logger.info({ purchaseId, outcome }, 'refund request finished');
      } finally {
        await services.pool.end();
      }
      return 0;
    }
    case 'delete-player': {
      // For deletion requests by e-mail: the same deletion as the app's Delete account button.
      const idIndex = rest.indexOf('--player');
      const playerId = rest[idIndex + 1];
      if (idIndex < 0 || !playerId || playerId.startsWith('--')) break;
      if (!rest.includes('--confirm')) {
        logger.error({}, 'deleting a player cannot be undone; re-run with --confirm');
        return 2;
      }
      const services = createServices(config, logger);
      try {
        await deletePlayerData(services.pool, playerId);
        if (services.signInAccounts) {
          await services.signInAccounts.delete(playerId);
          logger.info({ playerId }, 'player data and sign-in account deleted');
        } else {
          logger.warn({ playerId }, 'player data deleted; without FIREBASE_PROJECT_ID the sign-in account must be deleted in Firebase Console');
        }
      } finally {
        await services.pool.end();
      }
      return 0;
    }
    default:
      break;
  }
  process.stderr.write(USAGE);
  return 64;
}

process.exitCode = await main(process.argv.slice(2));
