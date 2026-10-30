import { z } from 'zod';
import type { Catalog } from '../catalog.js';
import type { Pool } from '../db/pool.js';
import { badRequest } from '../errors.js';
import { type Logger, tokenFingerprint } from '../logging.js';
import type { PurchaseService } from '../purchases/service.js';

// Pub/Sub push envelope: https://cloud.google.com/pubsub/docs/push
const pushEnvelopeSchema = z.object({
  message: z.object({
    data: z.string().max(64 * 1024),
    messageId: z.string().min(1).max(256),
    publishTime: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional(),
  }),
  subscription: z.string().max(512).optional(),
});

const tokenSchema = z.string().min(1).max(4096);
const millis = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()]).transform(Number);

// DeveloperNotification: https://developer.android.com/google/play/billing/rtdn-reference
const notificationSchema = z.object({
  version: z.string().optional(),
  packageName: z.string().min(1).max(256),
  eventTimeMillis: millis,
  oneTimeProductNotification: z
    .object({ notificationType: z.number().int(), purchaseToken: tokenSchema, sku: z.string().optional() })
    .optional(),
  voidedPurchaseNotification: z
    .object({
      purchaseToken: tokenSchema,
      orderId: z.string().optional(),
      productType: z.number().int(),
      refundType: z.number().int().optional(),
    })
    .optional(),
  subscriptionNotification: z.object({ notificationType: z.number().int() }).loose().optional(),
  pendingRefundReviewNotification: z.object({ orderId: z.string().optional() }).loose().optional(),
  testNotification: z.object({}).loose().optional(),
});

export type RtdnOutcome = 'processed' | 'duplicate' | 'ignored';

export interface RtdnDeps {
  pool: Pool;
  catalog: Catalog;
  purchases: PurchaseService;
  logger: Logger;
  expectedSubscription?: string;
}

const ONE_TIME_PRODUCT_PURCHASED = 1;
const ONE_TIME_PRODUCT_CANCELED = 2;
const PRODUCT_TYPE_ONE_TIME = 2;
const REFUND_TYPE_QUANTITY_BASED_PARTIAL_REFUND = 2;

/**
 * Handles one authenticated Pub/Sub push. Notifications only say that something changed:
 * purchase state is always re-read from the Play Developer API, so a replayed or forged
 * "purchased" message can never grant anything by itself.
 *
 * Throws on transient failures so the route answers 5xx and Pub/Sub redelivers.
 */
export async function handleRtdnPush(body: unknown, deps: RtdnDeps): Promise<RtdnOutcome> {
  const envelope = pushEnvelopeSchema.safeParse(body);
  if (!envelope.success) throw badRequest('not a Pub/Sub push message');
  const { message, subscription } = envelope.data;

  if (deps.expectedSubscription && subscription !== deps.expectedSubscription) {
    deps.logger.warn({ subscription }, 'push from an unexpected subscription; ignored');
    return 'ignored';
  }

  const seen = await deps.pool.query('SELECT 1 FROM rtdn_messages WHERE message_id = $1', [message.messageId]);
  if (seen.rowCount !== 0) return 'duplicate';

  const markDone = async (kind: string, packageName: string | null) => {
    await deps.pool.query(
      `INSERT INTO rtdn_messages (message_id, package_name, notification_kind) VALUES ($1, $2, $3)
       ON CONFLICT (message_id) DO NOTHING`,
      [message.messageId, packageName, kind],
    );
  };

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
  } catch {
    decoded = undefined;
  }
  const parsed = notificationSchema.safeParse(decoded);
  if (!parsed.success) {
    // Acknowledge so Pub/Sub stops redelivering a message that can never be processed.
    deps.logger.error({ messageId: message.messageId }, 'malformed developer notification; acknowledged and dropped');
    await markDone('malformed', null);
    return 'ignored';
  }
  const notification = parsed.data;
  const game = deps.catalog.gameByPackage(notification.packageName);
  if (!game) {
    deps.logger.warn({ packageName: notification.packageName }, 'notification for a package not in the catalog; ignored');
    await markDone('unknown_package', notification.packageName);
    return 'ignored';
  }

  if (notification.oneTimeProductNotification) {
    const { notificationType, purchaseToken } = notification.oneTimeProductNotification;
    if (notificationType === ONE_TIME_PRODUCT_PURCHASED || notificationType === ONE_TIME_PRODUCT_CANCELED) {
      await deps.purchases.onOneTimeProductNotification(game, purchaseToken, notificationType);
    } else {
      deps.logger.warn({ notificationType, token: tokenFingerprint(purchaseToken) }, 'unknown one-time product notification type');
    }
    await markDone('one_time_product', game.packageName);
    return 'processed';
  }

  if (notification.voidedPurchaseNotification) {
    const voided = notification.voidedPurchaseNotification;
    if (voided.productType === PRODUCT_TYPE_ONE_TIME) {
      await deps.purchases.onVoidedPurchase(game, {
        purchaseToken: voided.purchaseToken,
        orderId: voided.orderId ?? null,
        refundType: voided.refundType === REFUND_TYPE_QUANTITY_BASED_PARTIAL_REFUND ? 'partial' : 'full',
        voidedQuantity: null,
        voidedTimeMs: notification.eventTimeMillis,
        voidedReason: null,
        voidedSource: null,
        source: 'rtdn',
      });
    } else {
      deps.logger.warn({ productType: voided.productType }, 'voided subscription notification; subscriptions are not supported');
    }
    await markDone('voided_purchase', game.packageName);
    return 'processed';
  }

  if (notification.pendingRefundReviewNotification) {
    // A chargeback request that Google asks the developer to review within 24 hours via the
    // ReviewRefund API. Not automated: it needs a human decision.
    deps.logger.error(
      { orderId: notification.pendingRefundReviewNotification.orderId },
      'chargeback review requested; respond in Play Console or with orders.reviewrefund within 24 hours',
    );
    await markDone('pending_refund_review', game.packageName);
    return 'processed';
  }

  if (notification.subscriptionNotification) {
    deps.logger.warn({}, 'subscription notification received; subscriptions are not supported');
    await markDone('subscription', game.packageName);
    return 'ignored';
  }

  if (notification.testNotification) {
    deps.logger.info({ packageName: game.packageName }, 'Play Console test notification received');
    await markDone('test', game.packageName);
    return 'processed';
  }

  await markDone('empty', game.packageName);
  return 'ignored';
}
