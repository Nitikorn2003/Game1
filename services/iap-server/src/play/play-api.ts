import { androidpublisher, auth as googleAuth, type androidpublisher_v3 } from '@googleapis/androidpublisher';

/** Purchase state as reported by purchases.productsv2.getproductpurchasev2. */
export type PlayPurchaseState = 'PURCHASED' | 'PENDING' | 'CANCELLED' | 'UNSPECIFIED';

export interface PlayLineItem {
  productId: string;
  quantity: number;
  /** Units not refunded yet. Null when Google omits the field. */
  refundableQuantity: number | null;
  consumed: boolean;
  isRental: boolean;
}

export interface PlayProductPurchase {
  purchaseState: PlayPurchaseState;
  acknowledged: boolean;
  obfuscatedAccountId: string | null;
  orderId: string | null;
  isTestPurchase: boolean;
  purchaseCompletionTime: string | null;
  lineItems: PlayLineItem[];
}

export interface PlayVoidedPurchase {
  purchaseToken: string;
  orderId: string | null;
  voidedTimeMillis: number;
  voidedQuantity: number | null;
  voidedReason: number | null;
  voidedSource: number | null;
}

export interface VoidedPurchasesPage {
  voidedPurchases: PlayVoidedPurchase[];
  nextPageToken: string | null;
}

/** The subset of the Google Play Developer API that the purchase system relies on. */
export interface PlayDeveloperApi {
  getProductPurchase(packageName: string, purchaseToken: string): Promise<PlayProductPurchase>;
  consumeProduct(packageName: string, productId: string, purchaseToken: string): Promise<void>;
  acknowledgeProduct(packageName: string, productId: string, purchaseToken: string): Promise<void>;
  listVoidedPurchases(
    packageName: string,
    query: { startTimeMs: number; endTimeMs: number; pageToken?: string },
  ): Promise<VoidedPurchasesPage>;
  refundOrder(packageName: string, orderId: string, options: { revoke: boolean }): Promise<void>;
}

export type PlayApiErrorKind =
  /** Google does not know the token (or it belongs to another app). Permanent. */
  | 'invalid_token'
  /** The request conflicts with the purchase's state, e.g. consuming twice. */
  | 'conflict'
  /** Our service account is missing, misconfigured or lacks Play Console permissions. */
  | 'auth_config'
  /** Timeouts, 429 and 5xx. Safe to retry. */
  | 'transient';

export class PlayApiError extends Error {
  constructor(
    readonly kind: PlayApiErrorKind,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'PlayApiError';
  }
}

export const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

type AuthClient = androidpublisher_v3.Options['auth'];

export interface GooglePlayDeveloperApiOptions {
  /** Defaults to Application Default Credentials with the androidpublisher scope. */
  auth?: AuthClient;
  /** Only overridden by tests that point the official client at a local fake. */
  rootUrl?: string;
  timeoutMs: number;
}

/** Real implementation backed by Google's official Node.js client for the Play Developer API. */
export function createGooglePlayDeveloperApi(options: GooglePlayDeveloperApiOptions): PlayDeveloperApi {
  const client = androidpublisher({
    version: 'v3',
    auth: options.auth ?? new googleAuth.GoogleAuth({ scopes: [ANDROID_PUBLISHER_SCOPE] }),
    ...(options.rootUrl ? { rootUrl: options.rootUrl } : {}),
    timeout: options.timeoutMs,
    // Retries are owned by the purchase service and the background jobs, where they are
    // idempotent and visible; the client library's hidden retries are turned off.
    retry: false,
  });

  return {
    async getProductPurchase(packageName, token) {
      const res = await call('get', () =>
        client.purchases.productsv2.getproductpurchasev2({ packageName, token }),
      );
      return normalizePurchase(res.data);
    },
    async consumeProduct(packageName, productId, token) {
      await call('consume', () => client.purchases.products.consume({ packageName, productId, token }));
    },
    async acknowledgeProduct(packageName, productId, token) {
      await call('acknowledge', () =>
        client.purchases.products.acknowledge({ packageName, productId, token, requestBody: {} }),
      );
    },
    async listVoidedPurchases(packageName, query) {
      const res = await call('voided', () =>
        client.purchases.voidedpurchases.list({
          packageName,
          startTime: String(query.startTimeMs),
          endTime: String(query.endTimeMs),
          type: 0, // one-time products only
          includeQuantityBasedPartialRefund: true,
          ...(query.pageToken ? { token: query.pageToken } : {}),
        }),
      );
      return {
        voidedPurchases: (res.data.voidedPurchases ?? []).flatMap((v) =>
          v.purchaseToken
            ? [
                {
                  purchaseToken: v.purchaseToken,
                  orderId: v.orderId ?? null,
                  voidedTimeMillis: Number(v.voidedTimeMillis ?? 0),
                  voidedQuantity: v.voidedQuantity ?? null,
                  voidedReason: v.voidedReason ?? null,
                  voidedSource: v.voidedSource ?? null,
                },
              ]
            : [],
        ),
        nextPageToken: res.data.tokenPagination?.nextPageToken ?? null,
      };
    },
    async refundOrder(packageName, orderId, { revoke }) {
      await call('refund', () => client.orders.refund({ packageName, orderId, revoke }));
    },
  };
}

function normalizePurchase(data: androidpublisher_v3.Schema$ProductPurchaseV2): PlayProductPurchase {
  const state = data.purchaseStateContext?.purchaseState;
  return {
    purchaseState: state === 'PURCHASED' || state === 'PENDING' || state === 'CANCELLED' ? state : 'UNSPECIFIED',
    acknowledged: data.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    obfuscatedAccountId: data.obfuscatedExternalAccountId ?? null,
    orderId: data.orderId ?? null,
    isTestPurchase: data.testPurchaseContext != null,
    purchaseCompletionTime: data.purchaseCompletionTime ?? null,
    lineItems: (data.productLineItem ?? []).map((item) => {
      const offer = item.productOfferDetails;
      return {
        productId: item.productId ?? '',
        quantity: offer?.quantity ?? 1,
        refundableQuantity: offer?.refundableQuantity ?? null,
        consumed: offer?.consumptionState === 'CONSUMPTION_STATE_CONSUMED',
        isRental: offer?.rentOfferDetails != null,
      };
    }),
  };
}

type Operation = 'get' | 'consume' | 'acknowledge' | 'voided' | 'refund';

async function call<T>(operation: Operation, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw classifyError(operation, err);
  }
}

// The client library's own messages can contain the request URL, which contains the purchase
// token, so they are never copied into PlayApiError messages or logs.
export function classifyError(operation: Operation, err: unknown): PlayApiError {
  const status = httpStatusOf(err);
  const detail = `Google Play Developer API ${operation} failed${status ? ` with HTTP ${status}` : ''}`;
  if (status === null) {
    // HTTP-layer errors (timeouts, resets, DNS) carry the request config; anything else failed
    // before a request was sent, which in practice means credentials could not be loaded.
    return isHttpLayerError(err)
      ? new PlayApiError('transient', null, `${detail} (no response)`)
      : new PlayApiError('auth_config', null, `${detail} before reaching Google; check the service account credentials`);
  }
  if (status === 401 || status === 403) return new PlayApiError('auth_config', status, detail);
  if (status === 408 || status === 429 || status >= 500) return new PlayApiError('transient', status, detail);
  if (operation === 'get' && (status === 400 || status === 404 || status === 410)) {
    return new PlayApiError('invalid_token', status, detail);
  }
  if (status === 404 || status === 410) return new PlayApiError('invalid_token', status, detail);
  return new PlayApiError('conflict', status, detail);
}

function isHttpLayerError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'config' in err;
}

function httpStatusOf(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const candidate = err as { status?: unknown; response?: { status?: unknown } };
  const status = candidate.response?.status ?? candidate.status;
  return typeof status === 'number' ? status : null;
}
