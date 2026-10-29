import type { Pool, Queryable } from '../db/pool.js';
import { withTransaction } from '../db/tx.js';

export type LedgerReason = 'play_purchase' | 'play_revocation' | 'spend';

export interface LedgerEntry {
  gameId: string;
  playerId: string;
  currency: string;
  delta: number;
  reason: LedgerReason;
  /** Unique per game and currency. Reusing a key is a no-op, which makes retries safe. */
  idempotencyKey: string;
  purchaseId?: number;
}

/**
 * Appends a ledger row and moves the balance by the same amount, at most once per
 * idempotency key. Must run inside a transaction so both writes commit or neither does.
 * Returns false when the key was already used.
 */
export async function applyLedgerEntryOnce(tx: Queryable, entry: LedgerEntry): Promise<boolean> {
  if (!Number.isSafeInteger(entry.delta) || entry.delta === 0) {
    throw new Error(`invalid ledger delta ${entry.delta}`);
  }
  const inserted = await tx.query(
    `INSERT INTO wallet_ledger (game_id, player_id, currency, delta, reason, idempotency_key, purchase_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT ON CONSTRAINT wallet_ledger_idempotency DO NOTHING
     RETURNING id`,
    [
      entry.gameId,
      entry.playerId,
      entry.currency,
      entry.delta,
      entry.reason,
      entry.idempotencyKey,
      entry.purchaseId ?? null,
    ],
  );
  if (inserted.rowCount === 0) return false;
  await tx.query(
    `INSERT INTO wallet_balances (game_id, player_id, currency, balance)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (game_id, player_id, currency)
     DO UPDATE SET balance = wallet_balances.balance + EXCLUDED.balance, updated_at = now()`,
    [entry.gameId, entry.playerId, entry.currency, entry.delta],
  );
  return true;
}

export interface WalletView {
  balances: Record<string, number>;
  entitlements: string[];
}

export async function getWallet(db: Queryable, gameId: string, playerId: string): Promise<WalletView> {
  const balances = await db.query<{ currency: string; balance: number }>(
    'SELECT currency, balance FROM wallet_balances WHERE game_id = $1 AND player_id = $2 ORDER BY currency',
    [gameId, playerId],
  );
  const entitlements = await db.query<{ entitlement: string }>(
    `SELECT entitlement FROM entitlements
     WHERE game_id = $1 AND player_id = $2 AND state = 'active' ORDER BY entitlement`,
    [gameId, playerId],
  );
  return {
    balances: Object.fromEntries(balances.rows.map((r) => [r.currency, r.balance])),
    entitlements: entitlements.rows.map((r) => r.entitlement),
  };
}

export type SpendResult =
  | { status: 'spent'; balance: number }
  | { status: 'duplicate'; balance: number }
  | { status: 'insufficient_funds'; balance: number };

/**
 * Server-side spend for a game's own economy code. Refuses to spend while the balance is
 * too low, which includes a negative balance left by a refund clawback.
 */
export async function spendCurrency(
  pool: Pool,
  input: { gameId: string; playerId: string; currency: string; amount: number; idempotencyKey: string },
): Promise<SpendResult> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error('amount must be a positive integer');
  return withTransaction(pool, async (tx) => {
    // Lock the balance first so concurrent spends for the same player run one at a time.
    const row = await tx.query<{ balance: number }>(
      `SELECT balance FROM wallet_balances
       WHERE game_id = $1 AND player_id = $2 AND currency = $3 FOR UPDATE`,
      [input.gameId, input.playerId, input.currency],
    );
    const balance = row.rows[0]?.balance ?? 0;
    const key = `spend:${input.playerId}:${input.idempotencyKey}`;
    const seen = await tx.query(
      'SELECT 1 FROM wallet_ledger WHERE game_id = $1 AND idempotency_key = $2 AND currency = $3',
      [input.gameId, key, input.currency],
    );
    if (seen.rowCount !== 0) return { status: 'duplicate', balance };
    if (balance < input.amount) return { status: 'insufficient_funds', balance };
    await applyLedgerEntryOnce(tx, {
      gameId: input.gameId,
      playerId: input.playerId,
      currency: input.currency,
      delta: -input.amount,
      reason: 'spend',
      idempotencyKey: key,
    });
    return { status: 'spent', balance: balance - input.amount };
  });
}
