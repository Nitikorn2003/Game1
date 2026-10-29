import { loadConfig } from './config.js';
import { migrate } from './db/migrate.js';
import { startBackgroundJobs } from './jobs/scheduler.js';
import { createHttpApp, createLogger, createServices } from './server.js';

const config = loadConfig();
const logger = createLogger(config);
const services = createServices(config, logger);

if (config.MIGRATE_ON_START) {
  const applied = await migrate(services.pool);
  logger.info({ applied }, 'database migrations applied');
}

const app = await createHttpApp(config, services, logger);
const stopJobs = config.RUN_BACKGROUND_JOBS
  ? startBackgroundJobs(services.purchases, services.catalog, logger)
  : () => Promise.resolve();

await app.listen({ host: config.HOST, port: config.PORT });

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  await stopJobs();
  await app.close();
  await services.pool.end();
};
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
