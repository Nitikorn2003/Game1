import type { Pool } from '../db/pool.js';
import { withTransaction } from '../db/tx.js';

/**
 * Deletes what this server keeps about a player apart from payment records: cloud saves,
 * settlements and billing account ids, in every game, because all games on this server share
 * one sign-in account per player. Purchases, the ledger, balances and entitlements stay,
 * because Google can still report a refund or chargeback for them later and payment records
 * must be kept for accounting. The privacy policy says so.
 */
export async function deletePlayerData(pool: Pool, playerId: string): Promise<void> {
  await withTransaction(pool, async (tx) => {
    await tx.query('DELETE FROM cloud_saves WHERE player_id = $1', [playerId]);
    await tx.query('DELETE FROM wallet_settlements WHERE player_id = $1', [playerId]);
    await tx.query('DELETE FROM player_billing_accounts WHERE player_id = $1', [playerId]);
  });
}
