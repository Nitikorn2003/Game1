import type { Queryable } from '../db/pool.js';
import { tokenFingerprint } from '../logging.js';

export type PurchaseState = 'new' | 'pending' | 'unclaimed' | 'granted' | 'revoked' | 'canceled' | 'rejected';
export type FulfillmentState = 'not_required' | 'pending' | 'done' | 'failed';
export type ProductType = 'consumable' | 'non_consumable';

export type GrantSpec = { currency: Record<string, number> } | { entitlement: string };

export interface PurchaseRow {
  id: number;
  game_id: string;
  package_name: string;
  purchase_token: string;
  product_id: string | null;
  product_type: ProductType | null;
  grant_spec: GrantSpec | null;
  player_id: string | null;
  order_id: string | null;
  obfuscated_account_id: string | null;
  quantity: number | null;
  state: PurchaseState;
  revoked_quantity: number;
  is_test: boolean;
  google_purchase_state: string | null;
  rejection_reason: string | null;
  fulfillment_state: FulfillmentState;
  fulfillment_attempts: number;
  fulfillment_next_attempt_at: Date | null;
  fulfillment_last_error: string | null;
  recheck_at: Date | null;
  recheck_attempts: number;
  purchase_completed_at: Date | null;
  granted_at: Date | null;
  revoked_at: Date | null;
  refund_requested_at: Date | null;
}

export async function findPurchaseByToken(
  db: Queryable,
  packageName: string,
  purchaseToken: string,
): Promise<PurchaseRow | undefined> {
  const res = await db.query<PurchaseRow>(
    'SELECT * FROM play_purchases WHERE package_name = $1 AND purchase_token = $2',
    [packageName, purchaseToken],
  );
  return res.rows[0];
}

export async function findPurchaseById(db: Queryable, id: number): Promise<PurchaseRow | undefined> {
  const res = await db.query<PurchaseRow>('SELECT * FROM play_purchases WHERE id = $1', [id]);
  return res.rows[0];
}

/**
 * Returns the purchase row for a token, creating it if needed, with a row lock held until
 * the surrounding transaction ends. Every writer goes through this lock, so concurrent
 * requests, notifications and jobs for one token are applied strictly one after another.
 */
export async function lockOrCreatePurchase(
  tx: Queryable,
  gameId: string,
  packageName: string,
  purchaseToken: string,
): Promise<PurchaseRow> {
  await tx.query(
    `INSERT INTO play_purchases (game_id, package_name, purchase_token, state)
     VALUES ($1, $2, $3, 'new')
     ON CONFLICT ON CONSTRAINT play_purchases_token_unique DO NOTHING`,
    [gameId, packageName, purchaseToken],
  );
  const res = await tx.query<PurchaseRow>(
    'SELECT * FROM play_purchases WHERE package_name = $1 AND purchase_token = $2 FOR UPDATE',
    [packageName, purchaseToken],
  );
  const row = res.rows[0];
  if (!row) throw new Error('purchase row vanished after insert');
  return row;
}

export async function lockPurchaseById(tx: Queryable, id: number): Promise<PurchaseRow | undefined> {
  const res = await tx.query<PurchaseRow>('SELECT * FROM play_purchases WHERE id = $1 FOR UPDATE', [id]);
  return res.rows[0];
}

const UPDATABLE = new Set<keyof PurchaseRow>([
  'product_id',
  'product_type',
  'grant_spec',
  'player_id',
  'order_id',
  'obfuscated_account_id',
  'quantity',
  'state',
  'revoked_quantity',
  'is_test',
  'google_purchase_state',
  'rejection_reason',
  'fulfillment_state',
  'fulfillment_attempts',
  'fulfillment_next_attempt_at',
  'fulfillment_last_error',
  'recheck_at',
  'recheck_attempts',
  'purchase_completed_at',
  'granted_at',
  'revoked_at',
  'refund_requested_at',
]);

export async function updatePurchase(
  tx: Queryable,
  id: number,
  changes: Partial<PurchaseRow>,
): Promise<PurchaseRow> {
  const entries = Object.entries(changes).filter(([, v]) => v !== undefined);
  for (const [key] of entries) {
    if (!UPDATABLE.has(key as keyof PurchaseRow)) throw new Error(`column ${key} is not updatable`);
  }
  const sets = entries.map(([key], i) => `${key} = $${i + 2}`);
  const values = entries.map(([key, value]) =>
    key === 'grant_spec' && value !== null ? JSON.stringify(value) : value,
  );
  const res = await tx.query<PurchaseRow>(
    `UPDATE play_purchases SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $1 RETURNING *`,
    [id, ...values],
  );
  const row = res.rows[0];
  if (!row) throw new Error(`purchase ${id} not found`);
  return row;
}

export async function recordPurchaseEvent(
  db: Queryable,
  input: { packageName: string; purchaseToken: string; purchaseId?: number | null; event: string; detail?: object },
): Promise<void> {
  await db.query(
    `INSERT INTO play_purchase_events (package_name, purchase_token_hash, purchase_id, event, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.packageName,
      tokenFingerprint(input.purchaseToken),
      input.purchaseId ?? null,
      input.event,
      JSON.stringify(input.detail ?? {}),
    ],
  );
}

export async function findPlayerByObfuscatedAccountId(
  db: Queryable,
  gameId: string,
  obfuscatedAccountId: string,
): Promise<string | undefined> {
  const res = await db.query<{ player_id: string }>(
    'SELECT player_id FROM player_billing_accounts WHERE game_id = $1 AND obfuscated_account_id = $2',
    [gameId, obfuscatedAccountId],
  );
  return res.rows[0]?.player_id;
}

export async function hasFullVoid(db: Queryable, packageName: string, purchaseToken: string): Promise<boolean> {
  const res = await db.query(
    `SELECT 1 FROM play_voided_purchases
     WHERE package_name = $1 AND purchase_token = $2 AND refund_type = 'full' LIMIT 1`,
    [packageName, purchaseToken],
  );
  return res.rowCount !== 0;
}
