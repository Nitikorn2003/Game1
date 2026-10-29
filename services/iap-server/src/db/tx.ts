import { type Pool, type PoolClient, withClient } from './pool.js';

// PostgreSQL error codes worth retrying the whole transaction for.
const RETRYABLE_SQLSTATES = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected

function sqlState(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
    ? err.code
    : undefined;
}

/**
 * Runs fn inside BEGIN/COMMIT. Any error rolls the whole unit back, so a grant can never be
 * half applied (for example ledger row written but purchase state not updated).
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withClient(pool, async (client, discard) => {
        await client.query('BEGIN');
        try {
          const result = await fn(client);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackErr) {
            // The connection is unusable; make the pool close it instead of reusing it.
            discard(rollbackErr);
          }
          throw err;
        }
      });
    } catch (err) {
      const code = sqlState(err);
      if (code !== undefined && RETRYABLE_SQLSTATES.has(code) && attempt < maxRetries) continue;
      throw err;
    }
  }
}
