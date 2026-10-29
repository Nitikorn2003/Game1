import { migrate } from '../../src/db/migrate.js';
import { createPool, type Pool } from '../../src/db/pool.js';

/** Local default matches the throwaway server started for development; CI sets TEST_DATABASE_URL. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/iap_test';

const TABLES = [
  'cloud_saves',
  'wallet_settlements',
  'play_purchase_events',
  'wallet_ledger',
  'wallet_balances',
  'entitlements',
  'play_voided_purchases',
  'rtdn_messages',
  'play_sync_state',
  'play_purchases',
  'player_billing_accounts',
];

/**
 * Recreates the schema from the migrations. The tests wipe the database, so they refuse to
 * run against one whose name does not say it is for testing.
 */
export async function createTestDatabase(): Promise<Pool> {
  const name = decodeURIComponent(new URL(TEST_DATABASE_URL).pathname.slice(1));
  if (!/test/i.test(name)) {
    throw new Error(`refusing to wipe database "${name}": TEST_DATABASE_URL must name a test database`);
  }
  const pool = createPool(TEST_DATABASE_URL, 30);
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  const applied = await migrate(pool);
  if (applied.length === 0) throw new Error('no migrations were applied');
  return pool;
}

export async function truncateAll(pool: Pool): Promise<void> {
  await pool.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}
