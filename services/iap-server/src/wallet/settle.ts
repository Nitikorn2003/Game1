import type { Pool, Queryable } from '../db/pool.js';
import { withTransaction } from '../db/tx.js';
import { applyLedgerEntryOnce } from './ledger.js';

export interface Settlement {
  id: string;
  /** Currency moved into the save. Negative when a refund took back currency already settled. */
  amounts: Record<string, number>;
}

/**
 * Moves every non-zero wallet balance into the game's own save, once per settlement id. The
 * client picks the id before asking and keeps it until its save holds the result, so after a
 * lost answer it asks again with the same id and gets the same amounts, never a second move.
 */
export async function settleWallet(
  pool: Pool,
  input: { gameId: string; playerId: string; settlementId: string },
): Promise<Settlement> {
  const { gameId, playerId, settlementId } = input;
  return withTransaction(pool, async (tx) => {
    // Lock the balances first: a purchase credited meanwhile waits and lands in the next settlement.
    const balances = await tx.query<{ currency: string; balance: number }>(
      `SELECT currency, balance FROM wallet_balances
       WHERE game_id = $1 AND player_id = $2 ORDER BY currency FOR UPDATE`,
      [gameId, playerId],
    );
    const done = await recorded(tx, gameId, playerId, settlementId);
    if (done) return done;
    const amounts: Record<string, number> = {};
    for (const { currency, balance } of balances.rows) {
      if (balance === 0) continue;
      amounts[currency] = balance;
      await applyLedgerEntryOnce(tx, {
        gameId,
        playerId,
        currency,
        delta: -balance,
        reason: 'settlement',
        idempotencyKey: `settle:${playerId}:${settlementId}`,
      });
    }
    const inserted = await tx.query(
      `INSERT INTO wallet_settlements (game_id, player_id, settlement_id, amounts)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [gameId, playerId, settlementId, JSON.stringify(amounts)],
    );
    if (inserted.rowCount === 0) {
      // The same id raced in from a second request while this player had no balances to lock.
      // Nothing was moved here (there was nothing to move), so its answer stands.
      const other = await recorded(tx, gameId, playerId, settlementId);
      if (other) return other;
    }
    return { id: settlementId, amounts };
  });
}

async function recorded(
  tx: Queryable,
  gameId: string,
  playerId: string,
  settlementId: string,
): Promise<Settlement | null> {
  const row = await tx.query<{ amounts: Record<string, number> }>(
    'SELECT amounts FROM wallet_settlements WHERE game_id = $1 AND player_id = $2 AND settlement_id = $3',
    [gameId, playerId, settlementId],
  );
  const amounts = row.rows[0]?.amounts;
  return amounts ? { id: settlementId, amounts } : null;
}
