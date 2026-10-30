import { randomBytes } from 'node:crypto';
import type { Catalog, GameConfig } from '../catalog.js';
import { type Pool, type Queryable, withClient } from '../db/pool.js';
import { withTransaction } from '../db/tx.js';
import {
  AppError,
  invalidPurchaseToken,
  productMismatch,
  purchaseNotOwned,
  purchaseRejected,
  unknownProduct,
  upstreamUnavailable,
} from '../errors.js';
import { type Logger, tokenFingerprint } from '../logging.js';
import { PlayApiError, type PlayDeveloperApi, type PlayProductPurchase } from '../play/play-api.js';
import { applyLedgerEntryOnce, getWallet, type WalletView } from '../wallet/ledger.js';
import {
  type Evaluation,
  evaluatePurchase,
  grantSpecFor,
  keptQuantity,
  type PurchasePolicy,
  type RejectionReason,
} from './evaluate.js';
import {
  findPlayerByObfuscatedAccountId,
  findPurchaseById,
  findPurchaseByToken,
  hasFullVoid,
  lockOrCreatePurchase,
  lockPurchaseById,
  type PurchaseRow,
  recordPurchaseEvent,
  updatePurchase,
} from './repository.js';

export type ReconcileStatus =
  | 'granted'
  | 'already_granted'
  | 'pending'
  | 'unclaimed'
  | 'canceled'
  | 'revoked'
  | 'rejected';

export interface ReconcileResult {
  status: ReconcileStatus;
  purchase: PurchaseRow;
  rejection?: RejectionReason;
}

export type ClientPurchaseStatus = 'granted' | 'already_granted' | 'pending' | 'canceled' | 'revoked';

export interface ClientVerifyResult {
  status: ClientPurchaseStatus;
  productId: string;
  quantity: number | null;
  wallet: WalletView;
}

export interface VoidSignal {
  purchaseToken: string;
  orderId: string | null;
  refundType: 'full' | 'partial';
  voidedQuantity: number | null;
  voidedTimeMs: number;
  voidedReason: number | null;
  voidedSource: number | null;
  source: 'rtdn' | 'voided_api';
}

export interface PurchaseServiceDeps {
  pool: Pool;
  catalog: Catalog;
  play: PlayDeveloperApi;
  logger: Logger;
  policy: PurchasePolicy;
  now?: () => Date;
}

type ReconcileSource =
  | 'client'
  | 'rtdn_purchased'
  | 'rtdn_canceled'
  | 'rtdn'
  | 'voided_api'
  | 'recheck'
  | 'fulfillment';

/** How long an inline fulfillment attempt holds a purchase before the retry job may take it. */
const FULFILLMENT_LEASE_MS = 2 * 60_000;
/** Google refunds a purchase that is not acknowledged within three days (three minutes for license testers). */
const ACKNOWLEDGEMENT_WINDOW_MS = 3 * 24 * 60 * 60_000;
const PENDING_RECHECK_BASE_MS = 5 * 60_000;
const PENDING_RECHECK_MAX_MS = 6 * 60 * 60_000;
/** The Voided Purchases API only serves the last 30 days. */
const VOIDED_LOOKBACK_MS = 30 * 24 * 60 * 60_000;
/** Re-read an hour before the last checkpoint; processing is idempotent, so overlap is free. */
const VOIDED_OVERLAP_MS = 60 * 60_000;
const VOIDED_MAX_PAGES_PER_RUN = 100;

export class PurchaseService {
  private readonly now: () => Date;

  constructor(private readonly deps: PurchaseServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  // ---------------------------------------------------------------------------
  // Account binding
  // ---------------------------------------------------------------------------

  /**
   * The value the client must pass to BillingFlowParams.setObfuscatedAccountId(). Google
   * echoes it back in getproductpurchasev2, which is how the server proves who bought what.
   */
  async getOrCreateObfuscatedAccountId(game: GameConfig, playerId: string): Promise<string> {
    const select = () =>
      this.deps.pool.query<{ obfuscated_account_id: string }>(
        'SELECT obfuscated_account_id FROM player_billing_accounts WHERE game_id = $1 AND player_id = $2',
        [game.gameId, playerId],
      );
    const existing = (await select()).rows[0];
    if (existing) return existing.obfuscated_account_id;
    await this.deps.pool.query(
      `INSERT INTO player_billing_accounts (game_id, player_id, obfuscated_account_id)
       VALUES ($1, $2, $3) ON CONFLICT (game_id, player_id) DO NOTHING`,
      [game.gameId, playerId, randomBytes(32).toString('base64url')],
    );
    const created = (await select()).rows[0];
    if (!created) throw new Error('billing account insert did not persist');
    return created.obfuscated_account_id;
  }

  // ---------------------------------------------------------------------------
  // Client submissions
  // ---------------------------------------------------------------------------

  /**
   * Handles a purchase token sent by the game client. The client's word is only used to
   * find the purchase: ownership, product, quantity and payment state all come from Google.
   */
  async verifyFromClient(
    game: GameConfig,
    playerId: string,
    productId: string,
    purchaseToken: string,
  ): Promise<ClientVerifyResult> {
    if (!this.deps.catalog.product(game, productId)) throw unknownProduct();

    const existing = await findPurchaseByToken(this.deps.pool, game.packageName, purchaseToken);
    if (existing && (existing.state === 'granted' || existing.state === 'revoked' || existing.state === 'canceled')) {
      // Settled purchases are answered from our own records. Later refunds reach us through
      // notifications and the voided purchases job, not through client calls.
      if (existing.player_id !== null && existing.player_id !== playerId) {
        await this.logOwnershipMismatch(game, purchaseToken, existing.id, playerId);
        throw purchaseNotOwned();
      }
      if (existing.product_id !== null && existing.product_id !== productId) throw productMismatch();
      if (existing.state === 'granted' && existing.fulfillment_state === 'pending') {
        await this.fulfill(existing.id);
      }
      return this.clientResult(
        game,
        playerId,
        existing.state === 'granted' ? 'already_granted' : existing.state,
        existing,
        productId,
      );
    }

    const google = await this.fetchForClient(game, purchaseToken);
    let result: ReconcileResult;
    try {
      result = await this.reconcile(game, purchaseToken, google, {
        source: 'client',
        claimPlayerId: playerId,
        claimedProductId: productId,
      });
    } catch (err) {
      throw this.toClientError(err);
    }
    switch (result.status) {
      case 'rejected':
        throw purchaseRejected(result.rejection ?? 'rejected');
      case 'unclaimed':
        // Cannot happen when a player claims the purchase; treat as a server bug.
        throw new Error('purchase left unclaimed despite a claim');
      case 'granted':
      case 'already_granted':
      case 'pending':
      case 'canceled':
      case 'revoked':
        return this.clientResult(game, playerId, result.status, result.purchase, productId);
    }
  }

  // ---------------------------------------------------------------------------
  // Real-time developer notifications
  // ---------------------------------------------------------------------------

  /** ONE_TIME_PRODUCT_PURCHASED (1) or ONE_TIME_PRODUCT_CANCELED (2). The state is re-read from Google. */
  async onOneTimeProductNotification(game: GameConfig, purchaseToken: string, notificationType: number): Promise<void> {
    let google: PlayProductPurchase;
    try {
      google = await this.deps.play.getProductPurchase(game.packageName, purchaseToken);
    } catch (err) {
      if (err instanceof PlayApiError && err.kind === 'invalid_token') {
        this.deps.logger.warn(
          { token: tokenFingerprint(purchaseToken), notificationType },
          'notification for a purchase token Google does not recognise; ignored',
        );
        return;
      }
      throw err;
    }
    await this.reconcile(game, purchaseToken, google, {
      source: notificationType === 2 ? 'rtdn_canceled' : 'rtdn_purchased',
    });
  }

  /**
   * A refund, chargeback or revocation reported by a VoidedPurchaseNotification or the
   * Voided Purchases API. Full voids claw everything back; partial (quantity based) refunds
   * are applied from Google's refundableQuantity so repeated or reordered signals cannot
   * claw back twice.
   */
  async onVoidedPurchase(game: GameConfig, signal: VoidSignal): Promise<void> {
    await this.deps.pool.query(
      `INSERT INTO play_voided_purchases
         (package_name, purchase_token, order_id, source, refund_type, voided_quantity,
          voided_reason, voided_source, voided_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ON CONSTRAINT play_voided_purchases_dedupe DO NOTHING`,
      [
        game.packageName,
        signal.purchaseToken,
        signal.orderId,
        signal.source,
        signal.refundType,
        signal.voidedQuantity,
        signal.voidedReason,
        signal.voidedSource,
        signal.voidedTimeMs,
      ],
    );
    const existing = await findPurchaseByToken(this.deps.pool, game.packageName, signal.purchaseToken);
    if (!existing) {
      // Recorded above, so a later grant of this token is blocked (full) or reduced (partial).
      this.deps.logger.info(
        { token: tokenFingerprint(signal.purchaseToken), refundType: signal.refundType },
        'void recorded for a purchase the server has not seen yet',
      );
      return;
    }

    if (signal.refundType === 'full') {
      await withTransaction(this.deps.pool, async (tx) => {
        const row = await lockPurchaseById(tx, existing.id);
        if (!row) return;
        if (row.state === 'granted') {
          await this.revokeTo(tx, row, 0, signal.source);
        } else if (row.state !== 'revoked' && row.state !== 'canceled') {
          await updatePurchase(tx, row.id, { state: 'canceled', recheck_at: null, fulfillment_state: 'not_required' });
          await this.event(tx, row, 'canceled', { source: signal.source, reason: 'voided_before_grant' });
        }
      });
      return;
    }

    let google: PlayProductPurchase;
    try {
      google = await this.deps.play.getProductPurchase(game.packageName, signal.purchaseToken);
    } catch (err) {
      if (err instanceof PlayApiError && err.kind === 'invalid_token') {
        this.deps.logger.warn({ token: tokenFingerprint(signal.purchaseToken) }, 'partial refund for unknown token');
        return;
      }
      throw err;
    }
    await this.reconcile(game, signal.purchaseToken, google, { source: signal.source });
  }

  // ---------------------------------------------------------------------------
  // Background jobs
  // ---------------------------------------------------------------------------

  /** Retries consume/acknowledge calls that failed or never ran (for example after a crash). */
  async runFulfillment(limit = 50): Promise<number> {
    const now = this.now();
    const due = await this.deps.pool.query<{ id: number }>(
      `UPDATE play_purchases SET fulfillment_next_attempt_at = $2
       WHERE id IN (
         SELECT id FROM play_purchases
         WHERE fulfillment_state = 'pending' AND fulfillment_next_attempt_at <= $1
         ORDER BY fulfillment_next_attempt_at
         LIMIT $3
         FOR UPDATE SKIP LOCKED)
       RETURNING id`,
      [now, new Date(now.getTime() + FULFILLMENT_LEASE_MS), limit],
    );
    for (const { id } of due.rows) await this.fulfill(id);
    return due.rowCount ?? 0;
  }

  /** Re-reads pending purchases in case a PURCHASED or CANCELED notification was missed. */
  async runPendingRechecks(limit = 50): Promise<number> {
    const now = this.now();
    const due = await this.deps.pool.query<PurchaseRow>(
      `UPDATE play_purchases SET recheck_at = $2
       WHERE id IN (
         SELECT id FROM play_purchases
         WHERE state = 'pending' AND recheck_at <= $1
         ORDER BY recheck_at
         LIMIT $3
         FOR UPDATE SKIP LOCKED)
       RETURNING *`,
      [now, new Date(now.getTime() + PENDING_RECHECK_BASE_MS), limit],
    );
    for (const row of due.rows) {
      const game = this.deps.catalog.gameByPackage(row.package_name);
      if (!game) continue;
      try {
        const google = await this.deps.play.getProductPurchase(row.package_name, row.purchase_token);
        const result = await this.reconcile(game, row.purchase_token, google, { source: 'recheck' });
        if (result.status === 'pending') {
          const attempts = row.recheck_attempts + 1;
          const delay = Math.min(PENDING_RECHECK_BASE_MS * 2 ** Math.min(attempts, 10), PENDING_RECHECK_MAX_MS);
          await updatePurchase(this.deps.pool, row.id, {
            recheck_attempts: attempts,
            recheck_at: new Date(this.now().getTime() + delay),
          });
        }
      } catch (err) {
        if (err instanceof PlayApiError && err.kind === 'invalid_token') {
          await updatePurchase(this.deps.pool, row.id, { state: 'canceled', recheck_at: null });
          await this.event(this.deps.pool, row, 'canceled', { source: 'recheck', reason: 'token_unknown_to_google' });
        } else {
          this.deps.logger.warn({ err: describe(err), purchaseId: row.id }, 'pending recheck failed; will retry');
        }
      }
    }
    return due.rowCount ?? 0;
  }

  /**
   * Pulls refunds, chargebacks and revocations from the Voided Purchases API. Runs alongside
   * notifications because Pub/Sub delivery can be delayed, misconfigured or lost.
   */
  async syncVoidedPurchases(game: GameConfig): Promise<{ skipped: boolean; processed: number }> {
    const lockKey = `iap:voided:${game.packageName}`;
    // A session-level advisory lock: one sync per app at a time across all instances. It
    // is released when the connection closes, so a crashed instance cannot keep it.
    return withClient(this.deps.pool, async (client, discard) => {
      const lock = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [lockKey]);
      if (!lock.rows[0]?.ok) return { skipped: true, processed: 0 };
      try {
        const nowMs = this.now().getTime();
        const checkpoint = (
          await client.query<{ voided_checkpoint_ms: number }>(
            'SELECT voided_checkpoint_ms FROM play_sync_state WHERE package_name = $1',
            [game.packageName],
          )
        ).rows[0]?.voided_checkpoint_ms;
        const startTimeMs = Math.max((checkpoint ?? 0) - VOIDED_OVERLAP_MS, nowMs - VOIDED_LOOKBACK_MS + 60_000);
        const endTimeMs = nowMs;
        let pageToken: string | undefined;
        let pages = 0;
        let processed = 0;
        do {
          const page = await this.deps.play.listVoidedPurchases(game.packageName, {
            startTimeMs,
            endTimeMs,
            ...(pageToken ? { pageToken } : {}),
          });
          for (const voided of page.voidedPurchases) {
            const partial = voided.voidedQuantity !== null && voided.voidedQuantity > 0;
            await this.onVoidedPurchase(game, {
              purchaseToken: voided.purchaseToken,
              orderId: voided.orderId,
              refundType: partial ? 'partial' : 'full',
              voidedQuantity: voided.voidedQuantity,
              voidedTimeMs: voided.voidedTimeMillis,
              voidedReason: voided.voidedReason,
              voidedSource: voided.voidedSource,
              source: 'voided_api',
            });
            processed++;
          }
          pageToken = page.nextPageToken ?? undefined;
          pages++;
        } while (pageToken && pages < VOIDED_MAX_PAGES_PER_RUN);
        if (pageToken) {
          this.deps.logger.error({ packageName: game.packageName }, 'voided purchases backlog exceeds one run; checkpoint not advanced');
        } else {
          await client.query(
            `INSERT INTO play_sync_state (package_name, voided_checkpoint_ms) VALUES ($1, $2)
             ON CONFLICT (package_name) DO UPDATE SET voided_checkpoint_ms = EXCLUDED.voided_checkpoint_ms, updated_at = now()`,
            [game.packageName, endTimeMs],
          );
        }
        return { skipped: false, processed };
      } finally {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(discard);
      }
    });
  }

  /**
   * Refunds and revokes a purchase that failed validation, as Google recommends instead of
   * letting it auto-refund after three days. Moves real money, so it only runs when the
   * operator enables REJECTED_PURCHASE_POLICY=refund or calls it explicitly from the CLI.
   */
  async refundRejectedPurchase(purchaseId: number): Promise<'refund_requested' | 'already_requested'> {
    const row = await findPurchaseById(this.deps.pool, purchaseId);
    if (!row) throw new Error(`purchase ${purchaseId} not found`);
    if (row.state !== 'rejected') throw new Error(`purchase ${purchaseId} is ${row.state}; only rejected purchases are refunded`);
    if (!row.order_id) throw new Error(`purchase ${purchaseId} has no order id (for example a promo code); nothing to refund`);
    // Claim the refund first so two operators or instances can never refund twice.
    const claimed = await this.deps.pool.query(
      `UPDATE play_purchases SET refund_requested_at = $2, updated_at = now()
       WHERE id = $1 AND refund_requested_at IS NULL AND state = 'rejected'`,
      [purchaseId, this.now()],
    );
    if (claimed.rowCount === 0) return 'already_requested';
    try {
      await this.deps.play.refundOrder(row.package_name, row.order_id, { revoke: true });
    } catch (err) {
      await this.deps.pool.query('UPDATE play_purchases SET refund_requested_at = NULL WHERE id = $1', [purchaseId]);
      throw err;
    }
    await this.event(this.deps.pool, row, 'refund_requested', { revoke: true, reason: row.rejection_reason });
    return 'refund_requested';
  }

  // ---------------------------------------------------------------------------
  // Core state machine
  // ---------------------------------------------------------------------------

  /**
   * Applies Google's current view of a purchase to our records. Every entry point (client,
   * notifications, jobs) ends up here, and all writes for one token happen under its row
   * lock, so the outcome is the same whatever order or how many times events arrive.
   */
  private async reconcile(
    game: GameConfig,
    purchaseToken: string,
    google: PlayProductPurchase,
    opts: { source: ReconcileSource; claimPlayerId?: string; claimedProductId?: string },
  ): Promise<ReconcileResult> {
    const { catalog, policy, pool } = this.deps;
    const evaluation = evaluatePurchase(catalog, game, google, policy);
    if (
      opts.claimedProductId !== undefined &&
      evaluation.productId !== null &&
      evaluation.productId !== opts.claimedProductId
    ) {
      throw productMismatch();
    }

    // Who made this purchase, according to Google.
    let owner: string | null = null;
    let ownerRejection: RejectionReason | null = null;
    if (google.obfuscatedAccountId) {
      owner = (await findPlayerByObfuscatedAccountId(pool, game.gameId, google.obfuscatedAccountId)) ?? null;
      if (owner === null) {
        ownerRejection = 'unknown_account_binding';
      } else if (opts.claimPlayerId !== undefined && owner !== opts.claimPlayerId) {
        await this.logOwnershipMismatch(game, purchaseToken, null, opts.claimPlayerId);
        throw purchaseNotOwned();
      }
    } else if (policy.requireObfuscatedAccountId) {
      ownerRejection = 'missing_account_binding';
    } else {
      // Purchases made outside the app (promo codes) carry no account id. Google's guidance
      // is to grant them to the signed-in player; the first claim then binds the token.
      owner = opts.claimPlayerId ?? null;
    }
    const rejection: RejectionReason | null = evaluation.ok ? ownerRejection : evaluation.reason;

    const result = await withTransaction(pool, async (tx): Promise<ReconcileResult> => {
      let row = await lockOrCreatePurchase(tx, game.gameId, game.packageName, purchaseToken);
      if (row.state === 'revoked') return { status: 'revoked', purchase: row };
      if (owner !== null && row.player_id !== null && row.player_id !== owner) {
        // Two players raced to claim an out-of-app purchase; the first claim won.
        throw purchaseNotOwned();
      }
      const effectiveOwner = owner ?? row.player_id;
      const facts: Partial<PurchaseRow> = {
        order_id: google.orderId ?? row.order_id,
        obfuscated_account_id: google.obfuscatedAccountId ?? row.obfuscated_account_id,
        is_test: google.isTestPurchase,
        google_purchase_state: google.purchaseState,
        purchase_completed_at: google.purchaseCompletionTime
          ? new Date(google.purchaseCompletionTime)
          : row.purchase_completed_at,
        ...(row.state !== 'granted' && evaluation.productId ? { product_id: evaluation.productId } : {}),
      };

      switch (google.purchaseState) {
        case 'UNSPECIFIED':
          throw new PlayApiError('transient', null, 'Google returned an unspecified purchase state');

        case 'PENDING': {
          if (row.state === 'granted') {
            this.deps.logger.error({ purchaseId: row.id }, 'Google reports PENDING for a granted purchase; left unchanged');
            return { status: 'already_granted', purchase: row };
          }
          const wasPending = row.state === 'pending';
          row = await updatePurchase(tx, row.id, {
            ...facts,
            state: 'pending',
            player_id: effectiveOwner,
            recheck_at: row.recheck_at ?? new Date(this.now().getTime() + PENDING_RECHECK_BASE_MS),
          });
          if (!wasPending) await this.event(tx, row, 'pending', { source: opts.source });
          return { status: 'pending', purchase: row };
        }

        case 'CANCELLED': {
          if (row.state === 'granted') {
            row = await this.revokeTo(tx, row, 0, opts.source);
            return { status: 'revoked', purchase: row };
          }
          const wasCanceled = row.state === 'canceled';
          row = await updatePurchase(tx, row.id, {
            ...facts,
            state: 'canceled',
            player_id: effectiveOwner,
            recheck_at: null,
            fulfillment_state: 'not_required',
          });
          if (!wasCanceled) await this.event(tx, row, 'canceled', { source: opts.source });
          return { status: 'canceled', purchase: row };
        }

        case 'PURCHASED': {
          const fullyVoided = await hasFullVoid(tx, game.packageName, purchaseToken);
          if (row.state === 'granted') {
            row = await this.revokeTo(tx, row, keptQuantity(google, row.quantity ?? 0, fullyVoided), opts.source);
            row = await updatePurchase(tx, row.id, facts);
            return { status: row.state === 'revoked' ? 'revoked' : 'already_granted', purchase: row };
          }
          if (row.refund_requested_at !== null) {
            // We asked Google to refund this purchase, so it must never be granted afterwards.
            row = await updatePurchase(tx, row.id, facts);
            return { status: 'rejected', purchase: row, rejection: (row.rejection_reason ?? 'unknown_product') as RejectionReason };
          }
          if (fullyVoided || (evaluation.ok && keptQuantity(google, evaluation.quantity, false) === 0)) {
            // Refunded before we granted it (the refund signal can arrive first).
            const wasCanceled = row.state === 'canceled';
            row = await updatePurchase(tx, row.id, {
              ...facts,
              state: 'canceled',
              player_id: effectiveOwner,
              recheck_at: null,
              fulfillment_state: 'not_required',
            });
            if (!wasCanceled) await this.event(tx, row, 'canceled', { source: opts.source, reason: 'refunded_before_grant' });
            return { status: 'canceled', purchase: row };
          }
          if (rejection !== null || !evaluation.ok) {
            const reason = rejection ?? 'unknown_product';
            row = await updatePurchase(tx, row.id, {
              ...facts,
              state: 'rejected',
              rejection_reason: reason,
              player_id: effectiveOwner,
              recheck_at: null,
            });
            await this.event(tx, row, 'rejected', { source: opts.source, reason });
            this.deps.logger.warn(
              { purchaseId: row.id, reason, token: tokenFingerprint(purchaseToken) },
              'paid purchase rejected; not granted and not acknowledged',
            );
            return { status: 'rejected', purchase: row, rejection: reason };
          }
          if (effectiveOwner === null) {
            // Paid, but nobody has claimed it yet: no account id and no signed-in player.
            row = await updatePurchase(tx, row.id, { ...facts, state: 'unclaimed', recheck_at: null });
            await this.event(tx, row, 'unclaimed', { source: opts.source });
            return { status: 'unclaimed', purchase: row };
          }
          row = await this.grant(tx, game, row, effectiveOwner, evaluation, facts, opts.source);
          // Applies quantity-based partial refunds that happened before the grant.
          row = await this.revokeTo(tx, row, keptQuantity(google, evaluation.quantity, false), opts.source);
          return { status: 'granted', purchase: row };
        }
      }
    });

    if (
      result.status === 'granted' ||
      (result.status === 'already_granted' && result.purchase.fulfillment_state === 'pending')
    ) {
      await this.fulfill(result.purchase.id, google);
    }
    if (result.status === 'rejected' && policy.rejectedPurchasePolicy === 'refund' && result.purchase.order_id) {
      await this.refundRejectedPurchase(result.purchase.id).catch((err: unknown) => {
        this.deps.logger.error({ err: describe(err), purchaseId: result.purchase.id }, 'automatic refund failed');
      });
    }
    return result;
  }

  /** Credits the currency and activates the entitlement of this purchase, exactly once. */
  private async grant(
    tx: Queryable,
    game: GameConfig,
    row: PurchaseRow,
    playerId: string,
    evaluation: Extract<Evaluation, { ok: true }>,
    facts: Partial<PurchaseRow>,
    source: ReconcileSource,
  ): Promise<PurchaseRow> {
    const spec = grantSpecFor(evaluation.product);
    for (const [currency, perUnit] of Object.entries(spec.currency ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      await applyLedgerEntryOnce(tx, {
        gameId: game.gameId,
        playerId,
        currency,
        delta: perUnit * evaluation.quantity,
        reason: 'play_purchase',
        idempotencyKey: `play:grant:${row.id}`,
        purchaseId: row.id,
      });
    }
    if (spec.entitlement !== undefined) {
      await tx.query(
        `INSERT INTO entitlements (game_id, player_id, entitlement, purchase_id, state)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (game_id, player_id, entitlement)
         DO UPDATE SET purchase_id = EXCLUDED.purchase_id, state = 'active', granted_at = now(), revoked_at = NULL`,
        [game.gameId, playerId, spec.entitlement, row.id],
      );
    }
    const now = this.now();
    const updated = await updatePurchase(tx, row.id, {
      ...facts,
      state: 'granted',
      player_id: playerId,
      product_id: evaluation.productId,
      product_type: evaluation.product.type,
      grant_spec: spec,
      quantity: evaluation.quantity,
      revoked_quantity: 0,
      rejection_reason: null,
      granted_at: now,
      recheck_at: null,
      fulfillment_state: 'pending',
      fulfillment_attempts: 0,
      fulfillment_last_error: null,
      fulfillment_next_attempt_at: new Date(now.getTime() + FULFILLMENT_LEASE_MS),
    });
    await this.event(tx, updated, 'granted', { source, quantity: evaluation.quantity, spec });
    return updated;
  }

  /** Claws back units so the player keeps exactly `kept` of them. Never grants. */
  private async revokeTo(tx: Queryable, row: PurchaseRow, kept: number, source: ReconcileSource | 'rtdn' | 'voided_api'): Promise<PurchaseRow> {
    if (row.state !== 'granted' || row.quantity === null || row.grant_spec === null || row.player_id === null) return row;
    const targetRevoked = row.quantity - Math.max(0, Math.min(kept, row.quantity));
    if (targetRevoked <= row.revoked_quantity) return row;
    const units = targetRevoked - row.revoked_quantity;
    const spec = row.grant_spec;
    for (const [currency, perUnit] of Object.entries(spec.currency ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      await applyLedgerEntryOnce(tx, {
        gameId: row.game_id,
        playerId: row.player_id,
        currency,
        // The balance may go negative if the currency was already spent (Google's advice).
        delta: -perUnit * units,
        reason: 'play_revocation',
        idempotencyKey: `play:revoke:${row.id}:${targetRevoked}`,
        purchaseId: row.id,
      });
    }
    if (spec.entitlement !== undefined && targetRevoked === row.quantity) {
      // Lock the entitlement first so two refunds of purchases backing it are applied in turn.
      await tx.query(
        'SELECT 1 FROM entitlements WHERE game_id = $1 AND player_id = $2 AND entitlement = $3 FOR UPDATE',
        [row.game_id, row.player_id, spec.entitlement],
      );
      // The player may own it through another purchase too, e.g. bought from a second Google
      // account. Then that purchase backs it from now on instead of it being revoked.
      const other = await tx.query<{ id: number }>(
        `SELECT id FROM play_purchases
         WHERE game_id = $1 AND player_id = $2 AND state = 'granted' AND id <> $3
           AND grant_spec ->> 'entitlement' = $4
         ORDER BY id LIMIT 1`,
        [row.game_id, row.player_id, row.id, spec.entitlement],
      );
      const replacement = other.rows[0];
      if (replacement) {
        await tx.query(
          `UPDATE entitlements SET purchase_id = $5
           WHERE game_id = $1 AND player_id = $2 AND entitlement = $3 AND purchase_id = $4`,
          [row.game_id, row.player_id, spec.entitlement, row.id, replacement.id],
        );
      } else {
        await tx.query(
          `UPDATE entitlements SET state = 'revoked', revoked_at = now()
           WHERE game_id = $1 AND player_id = $2 AND entitlement = $3 AND purchase_id = $4 AND state = 'active'`,
          [row.game_id, row.player_id, spec.entitlement, row.id],
        );
      }
    }
    const fully = targetRevoked === row.quantity;
    const updated = await updatePurchase(tx, row.id, {
      revoked_quantity: targetRevoked,
      ...(fully
        ? {
            state: 'revoked' as const,
            revoked_at: this.now(),
            // Never consume or acknowledge a purchase that was refunded before we got to it.
            fulfillment_state: row.fulfillment_state === 'pending' ? ('not_required' as const) : row.fulfillment_state,
          }
        : {}),
    });
    await this.event(tx, updated, fully ? 'revoked' : 'partially_revoked', { source, units, revokedQuantity: targetRevoked });
    return updated;
  }

  /**
   * Consumes (consumables) or acknowledges (non-consumables) a granted purchase with the
   * Play Developer API. Runs after the grant has committed, so a failure here never loses
   * the grant; it is retried by runFulfillment until it succeeds or the window closes.
   */
  private async fulfill(purchaseId: number, google?: PlayProductPurchase): Promise<void> {
    const row = await findPurchaseById(this.deps.pool, purchaseId);
    if (!row || row.state !== 'granted' || row.fulfillment_state !== 'pending' || !row.product_id || !row.product_type) {
      return;
    }
    const isConsumable = row.product_type === 'consumable';
    const alreadyDone = google ? (isConsumable ? google.lineItems[0]?.consumed === true : google.acknowledged) : false;
    try {
      if (!alreadyDone) {
        if (isConsumable) await this.deps.play.consumeProduct(row.package_name, row.product_id, row.purchase_token);
        else await this.deps.play.acknowledgeProduct(row.package_name, row.product_id, row.purchase_token);
      }
      await this.markFulfilled(row, isConsumable ? 'consumed' : 'acknowledged');
    } catch (err) {
      if (err instanceof PlayApiError && (err.kind === 'conflict' || err.kind === 'invalid_token')) {
        // Google refused; find out whether it was already done or the purchase was refunded.
        try {
          const fresh = await this.deps.play.getProductPurchase(row.package_name, row.purchase_token);
          const done = isConsumable ? fresh.lineItems[0]?.consumed === true : fresh.acknowledged;
          if (done) {
            await this.markFulfilled(row, isConsumable ? 'consumed' : 'acknowledged');
            return;
          }
          if (fresh.purchaseState === 'CANCELLED') {
            const game = this.deps.catalog.gameByPackage(row.package_name);
            if (game) await this.reconcile(game, row.purchase_token, fresh, { source: 'fulfillment' });
            return;
          }
        } catch (inner) {
          this.deps.logger.warn({ err: describe(inner), purchaseId }, 'could not re-read purchase after a refused fulfillment');
        }
      }
      await this.scheduleFulfillmentRetry(row, err);
    }
  }

  private async markFulfilled(row: PurchaseRow, event: 'consumed' | 'acknowledged'): Promise<void> {
    const res = await this.deps.pool.query(
      `UPDATE play_purchases
       SET fulfillment_state = 'done', fulfillment_last_error = NULL, fulfillment_next_attempt_at = NULL, updated_at = now()
       WHERE id = $1 AND fulfillment_state = 'pending'`,
      [row.id],
    );
    if (res.rowCount !== 0) await this.event(this.deps.pool, row, event, {});
  }

  private async scheduleFulfillmentRetry(row: PurchaseRow, err: unknown): Promise<void> {
    const attempts = row.fulfillment_attempts + 1;
    const now = this.now().getTime();
    const delay = Math.min(30_000 * 2 ** Math.min(attempts - 1, 10), 15 * 60_000);
    const startedAt = (row.purchase_completed_at ?? row.granted_at ?? new Date(now)).getTime();
    const giveUp = now + delay > startedAt + ACKNOWLEDGEMENT_WINDOW_MS;
    await this.deps.pool.query(
      `UPDATE play_purchases
       SET fulfillment_attempts = $2, fulfillment_last_error = $3, fulfillment_next_attempt_at = $4,
           fulfillment_state = $5, updated_at = now()
       WHERE id = $1 AND fulfillment_state = 'pending'`,
      [row.id, attempts, describe(err).slice(0, 500), new Date(now + delay), giveUp ? 'failed' : 'pending'],
    );
    const log = { purchaseId: row.id, attempts, err: describe(err) };
    if (giveUp) {
      this.deps.logger.error(log, 'gave up acknowledging a granted purchase; Google will refund it and the voided sync will claw it back');
    } else {
      this.deps.logger.warn(log, 'consume/acknowledge failed; will retry');
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async fetchForClient(game: GameConfig, purchaseToken: string): Promise<PlayProductPurchase> {
    try {
      return await this.deps.play.getProductPurchase(game.packageName, purchaseToken);
    } catch (err) {
      throw this.toClientError(err);
    }
  }

  private toClientError(err: unknown): unknown {
    if (!(err instanceof PlayApiError)) return err;
    if (err.kind === 'invalid_token') return invalidPurchaseToken();
    if (err.kind === 'auth_config') {
      this.deps.logger.error(
        { status: err.status, detail: err.message },
        'Google Play Developer API rejected the service account; check its credentials and Play Console permissions',
      );
    } else {
      this.deps.logger.warn({ status: err.status, kind: err.kind }, 'Google Play Developer API unavailable');
    }
    return upstreamUnavailable();
  }

  private async clientResult(
    game: GameConfig,
    playerId: string,
    status: ClientPurchaseStatus,
    row: PurchaseRow,
    productId: string,
  ): Promise<ClientVerifyResult> {
    return {
      status,
      productId: row.product_id ?? productId,
      quantity: row.quantity,
      wallet: await getWallet(this.deps.pool, game.gameId, playerId),
    };
  }

  private async logOwnershipMismatch(
    game: GameConfig,
    purchaseToken: string,
    purchaseId: number | null,
    claimant: string,
  ): Promise<void> {
    this.deps.logger.warn(
      { token: tokenFingerprint(purchaseToken), gameId: game.gameId },
      'purchase submitted by a player who did not make it; refused',
    );
    await recordPurchaseEvent(this.deps.pool, {
      packageName: game.packageName,
      purchaseToken,
      purchaseId,
      event: 'ownership_mismatch',
      detail: { claimant },
    });
  }

  private event(db: Queryable, row: PurchaseRow, event: string, detail: object): Promise<void> {
    return recordPurchaseEvent(db, {
      packageName: row.package_name,
      purchaseToken: row.purchase_token,
      purchaseId: row.id,
      event,
      detail,
    });
  }
}

export function describe(err: unknown): string {
  if (err instanceof AppError || err instanceof PlayApiError) return `${err.name}: ${err.message}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
