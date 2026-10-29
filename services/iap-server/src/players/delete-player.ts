import type { Pool } from '../db/pool.js';
import { withTransaction } from '../db/tx.js';

/**
 * Deletes what this server keeps about a player in one game apart from payment records: the
 * cloud save, settlements and the billing account id. Purchases, the ledger, balances and
 * entitlements stay, because Google can still report a refund or chargeback for them later
 * and payment records must be kept for accounting. The privacy policy says so.
 */
export async function deletePlayerData(pool: Pool, gameId: string, playerId: string): Promise<void> {
  await withTransaction(pool, async (tx) => {
    await tx.query('DELETE FROM cloud_saves WHERE game_id = $1 AND player_id = $2', [gameId, playerId]);
    await tx.query('DELETE FROM wallet_settlements WHERE game_id = $1 AND player_id = $2', [gameId, playerId]);
    await tx.query('DELETE FROM player_billing_accounts WHERE game_id = $1 AND player_id = $2', [gameId, playerId]);
  });
}
