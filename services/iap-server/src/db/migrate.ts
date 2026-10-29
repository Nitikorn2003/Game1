import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Pool, withClient } from './pool.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));
// Arbitrary constant so that concurrent deploys apply migrations one at a time.
const MIGRATION_LOCK_KEY = 7_311_044_190;

export async function migrate(pool: Pool, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  const files = readdirSync(dir)
    .filter((f) => /^\d+_[a-z0-9_]+\.sql$/.test(f))
    .sort();
  const applied: string[] = [];
  await withClient(pool, async (client, discard) => {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           version TEXT PRIMARY KEY,
           applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      );
      const done = new Set(
        (await client.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version),
      );
      for (const file of files) {
        if (done.has(file)) continue;
        const sql = readFileSync(`${dir}/${file}`, 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          await client.query('COMMIT');
          applied.push(file);
        } catch (err) {
          await client.query('ROLLBACK').catch(discard);
          throw err;
        }
      }
    } finally {
      // If unlocking fails, closing the connection releases the lock instead.
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(discard);
    }
  });
  return applied;
}
