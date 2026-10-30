import pg from 'pg';

// node-postgres returns BIGINT as a string. Balances and ids here always fit in a double,
// and a value that does not is a bug worth failing loudly on.
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error(`BIGINT value ${value} exceeds the safe integer range`);
  return n;
});

export type Pool = pg.Pool;
export type PoolClient = pg.PoolClient;
/** Anything that can run a query: the pool or a client inside a transaction. */
export type Queryable = Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>;

export function createPool(connectionString: string, max: number, onConnectionError?: (err: Error) => void): Pool {
  const pool = new pg.Pool({
    connectionString,
    max,
    application_name: 'iap-server',
    // Keep a stuck query or forgotten transaction from holding purchase row locks forever.
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // An idle connection can break at any time (database restart, failover, network drop).
  // The pool discards it, but without a listener the 'error' event would crash the process.
  pool.on('error', (err) => onConnectionError?.(err));
  return pool;
}

/**
 * Runs fn with a checked-out connection. A connection that breaks while checked out also
 * emits 'error'; that is caught here (the failing query rejects on its own), and a broken
 * connection, or one fn marks with `discard`, is closed instead of going back to the pool.
 */
export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient, discard: (reason: unknown) => void) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  const onError = (err: Error) => {
    broken ??= err;
  };
  client.on('error', onError);
  const discard = (reason: unknown) => {
    broken ??= reason instanceof Error ? reason : new Error(String(reason));
  };
  try {
    return await fn(client, discard);
  } finally {
    // A broken client keeps the listener: it is being thrown away and may still emit.
    if (!broken) client.off('error', onError);
    client.release(broken ?? false);
  }
}
