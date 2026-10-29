/**
 * Errors that are safe to show to API callers. Anything else becomes a generic 500 so
 * internal details never leak.
 */
export class AppError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    message: string,
    /** True when the client should keep the purchase and try again later. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string) => new AppError(400, 'invalid_request', message);

export const unauthorized = () =>
  new AppError(401, 'unauthorized', 'A valid bearer token is required.');

export const unknownGame = () => new AppError(404, 'unknown_game', 'Unknown game.');

export const purchaseNotOwned = () =>
  new AppError(403, 'purchase_not_owned', 'This purchase belongs to a different player.');

export const unknownProduct = () =>
  new AppError(422, 'unknown_product', 'This product is not sold in this game.');

export const productMismatch = () =>
  new AppError(422, 'product_mismatch', 'The purchase token is for a different product.');

export const invalidPurchaseToken = () =>
  new AppError(422, 'invalid_purchase_token', 'Google Play does not recognise this purchase.');

export const purchaseRejected = (reason: string) =>
  new AppError(422, 'purchase_rejected', `The purchase cannot be fulfilled (${reason}).`);

export const upstreamUnavailable = () =>
  new AppError(
    503,
    'upstream_unavailable',
    'Purchase verification is temporarily unavailable. Keep the purchase and retry later.',
    true,
  );
