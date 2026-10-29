import type { Catalog, GameConfig, ProductConfig } from '../catalog.js';
import type { PlayProductPurchase } from '../play/play-api.js';
import type { GrantSpec } from './repository.js';

export interface PurchasePolicy {
  /** Refuse purchases that carry no obfuscatedExternalAccountId (e.g. promo codes redeemed in the Play Store). */
  requireObfuscatedAccountId: boolean;
  /** Accept purchases made by license testers with test payment methods. */
  allowTestPurchases: boolean;
  /** What to do with a paid purchase that fails validation. */
  rejectedPurchasePolicy: 'hold' | 'refund';
}

export type RejectionReason =
  | 'unsupported_line_items'
  | 'unknown_product'
  | 'unsupported_rental'
  | 'test_purchase_not_allowed'
  | 'invalid_quantity'
  | 'unknown_account_binding'
  | 'missing_account_binding';

export type Evaluation =
  | { ok: true; product: ProductConfig; productId: string; quantity: number; refundableQuantity: number | null; consumed: boolean }
  | { ok: false; reason: RejectionReason; productId: string | null };

const MAX_QUANTITY = 10_000;

/**
 * Checks what Google reports about a purchase against this game's catalog and policy.
 * Pure function: everything it decides comes from Google's data, never from the client.
 */
export function evaluatePurchase(
  catalog: Catalog,
  game: GameConfig,
  purchase: PlayProductPurchase,
  policy: PurchasePolicy,
): Evaluation {
  if (purchase.lineItems.length !== 1) {
    return { ok: false, reason: 'unsupported_line_items', productId: null };
  }
  const item = purchase.lineItems[0]!;
  const product = catalog.product(game, item.productId);
  if (!product) return { ok: false, reason: 'unknown_product', productId: item.productId };
  if (item.isRental) return { ok: false, reason: 'unsupported_rental', productId: item.productId };
  if (purchase.isTestPurchase && !policy.allowTestPurchases) {
    return { ok: false, reason: 'test_purchase_not_allowed', productId: item.productId };
  }
  const quantity = item.quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return { ok: false, reason: 'invalid_quantity', productId: item.productId };
  }
  // Multi-quantity only makes sense for consumables; one entitlement cannot be sold twice.
  if (product.type === 'non_consumable' && quantity !== 1) {
    return { ok: false, reason: 'invalid_quantity', productId: item.productId };
  }
  return {
    ok: true,
    product,
    productId: item.productId,
    quantity,
    refundableQuantity: item.refundableQuantity,
    consumed: item.consumed,
  };
}

export function grantSpecFor(product: ProductConfig): GrantSpec {
  if (product.type === 'consumable') return { currency: { ...product.grants } };
  return product.grants ? { entitlement: product.entitlement, currency: { ...product.grants } } : { entitlement: product.entitlement };
}

/**
 * How many purchased units the player should still hold according to Google. Refunded
 * units (full or quantity-based partial refunds) are clawed back.
 */
export function keptQuantity(
  purchase: PlayProductPurchase,
  quantity: number,
  fullyVoided: boolean,
): number {
  if (fullyVoided || purchase.purchaseState === 'CANCELLED') return 0;
  const refundable = purchase.lineItems[0]?.refundableQuantity;
  if (refundable === null || refundable === undefined) return quantity;
  return Math.max(0, Math.min(quantity, refundable));
}
