import type { IapServerClient } from './iap-client.js';
import type { CatalogItem, Product, PurchaseResult, Settlement, StoreService, WalletView } from './store.js';

/** What the native purchase coordinator (clients/android) reports about one purchase. */
export type NativePurchaseEvent =
  | { type: 'granted'; productId: string; newlyGranted: boolean }
  | { type: 'pending' | 'canceled' | 'revoked' | 'deferred' | 'sign_in_required'; productId: string }
  | { type: 'refused'; productId: string; code: string; message: string }
  | { type: 'user_canceled' }
  | { type: 'billing_error'; responseCode: number; message: string };

/** The Game1Billing Capacitor plugin in each game's Android app, a bridge to clients/android. */
export interface NativeBilling {
  configure(options: { baseUrl: string; gameId: string }): Promise<void>;
  /** The token the plugin sends to the purchase server; null when signed out. */
  setSessionToken(options: { token: string | null }): Promise<void>;
  /** Prices as Google Play shows them to this player; products is null when Play cannot be reached. */
  queryProducts(options: { productIds: string[] }): Promise<{ products: { productId: string; price: string }[] | null }>;
  /** Opens Google Play's purchase sheet. What happens next arrives as a purchaseEvent. */
  purchase(options: { productId: string }): Promise<{ launched: boolean; reason?: string }>;
  /** Sends every purchase Google Play still holds to the server: after a crash, or a pending payment that cleared. */
  restore(): Promise<void>;
  addListener(eventName: 'purchaseEvent', listener: (event: NativePurchaseEvent) => void): Promise<{ remove(): Promise<void> }>;
}

export interface PlayStoreOptions {
  baseUrl: string;
  gameId: string;
  idToken: (forceRefresh: boolean) => Promise<string | null>;
  /** A purchase sheet left open this long counts as pending; the purchase still arrives later. */
  purchaseTimeoutMs?: number;
}

/**
 * Real purchases through Google Play in the Android app. The device only starts purchases and
 * hands tokens to the purchase server; the server verifies them with Google and credits the
 * wallet, which the game then settles into its save (see syncWallet).
 */
export class PlayStore implements StoreService {
  readonly name = 'play' as const;
  private readonly listeners = new Set<() => void>();
  private waiting: { productId: string; resolve: (result: PurchaseResult) => void } | null = null;
  private started: Promise<void> | null = null;
  private lastForcedRefresh = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly billing: NativeBilling,
    private readonly server: IapServerClient,
    private readonly catalog: readonly CatalogItem[],
    private readonly options: PlayStoreOptions,
  ) {}

  /** Connects the plugin, then finishes purchases left over from earlier sessions. */
  start(): Promise<void> {
    if (!this.started) {
      this.started = (async () => {
        await this.billing.configure({ baseUrl: this.options.baseUrl, gameId: this.options.gameId });
        await this.billing.addListener('purchaseEvent', (event) => {
          this.onEvent(event);
        });
      })();
      // While the server is unreachable a held purchase takes minutes; prices and new purchases do not wait for it.
      this.restore().catch(() => undefined);
    }
    return this.started;
  }

  /** Also call when the app returns to the foreground: a pending payment may have cleared. */
  async restore(): Promise<void> {
    await this.start();
    if (await this.syncToken(false)) await this.billing.restore();
  }

  async products(ids: readonly string[]): Promise<Product[]> {
    await this.start();
    const items = ids.flatMap((id) => this.catalog.filter((p) => p.id === id));
    const prices = new Map<string, string>();
    try {
      const found = await this.billing.queryProducts({ productIds: items.map((item) => item.id) });
      for (const p of found.products ?? []) prices.set(p.productId, p.price);
    } catch {
      // No prices: the shop shows these products as unavailable for now.
    }
    return items.map((item) => ({ id: item.id, kind: item.kind, price: prices.get(item.id) ?? null }));
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    await this.start();
    if (!this.catalog.some((p) => p.id === productId)) return { status: 'failed', reason: 'unknown_product', retryable: false };
    if (this.waiting) return { status: 'failed', reason: 'busy', retryable: true };
    if (!(await this.syncToken(false))) return { status: 'failed', reason: 'signed_out', retryable: true };
    const outcome = new Promise<PurchaseResult>((resolve) => {
      this.waiting = { productId, resolve };
    });
    const timer = setTimeout(() => {
      this.finish({ status: 'pending' });
    }, this.options.purchaseTimeoutMs ?? 10 * 60_000);
    try {
      const launched = await this.billing.purchase({ productId });
      if (!launched.launched) {
        const reason = launched.reason ?? 'unavailable';
        this.finish({ status: 'failed', reason, retryable: reason !== 'unknown_product' });
      }
    } catch {
      this.finish({ status: 'failed', reason: 'billing_unavailable', retryable: true });
    }
    try {
      return await outcome;
    } finally {
      clearTimeout(timer);
    }
  }

  wallet(): Promise<WalletView> {
    return this.server.wallet();
  }

  settle(settlementId: string): Promise<Settlement> {
    return this.server.settle(settlementId);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private onEvent(event: NativePurchaseEvent): void {
    const waiting = this.waiting;
    if (waiting && (!('productId' in event) || event.productId === waiting.productId)) this.finish(resultOf(event));
    if (event.type === 'sign_in_required') void this.renewSession();
    // The wallet changed on the server, so the game should settle it.
    if (event.type === 'granted' || event.type === 'revoked') for (const listener of this.listeners) listener();
  }

  private finish(result: PurchaseResult): void {
    const waiting = this.waiting;
    this.waiting = null;
    waiting?.resolve(result);
  }

  private async syncToken(force: boolean): Promise<boolean> {
    let token: string | null;
    try {
      token = await this.options.idToken(force);
    } catch {
      token = null;
    }
    await this.billing.setSessionToken({ token });
    return token !== null;
  }

  /** The server refused the session: get a fresh token and try the held purchases again, at most once a minute. */
  private async renewSession(): Promise<void> {
    const now = Date.now();
    if (now - this.lastForcedRefresh < 60_000) return;
    this.lastForcedRefresh = now;
    if (await this.syncToken(true)) await this.billing.restore();
  }
}

function resultOf(event: NativePurchaseEvent): PurchaseResult {
  switch (event.type) {
    case 'granted':
      return { status: 'granted' };
    case 'pending':
    case 'deferred':
      // Google Play keeps the purchase; it is delivered once paid or once the server is reachable.
      return { status: 'pending' };
    case 'canceled':
    case 'user_canceled':
      return { status: 'cancelled' };
    case 'revoked':
      return { status: 'failed', reason: 'revoked', retryable: false };
    case 'refused':
      return { status: 'failed', reason: event.code, retryable: false };
    case 'sign_in_required':
      return { status: 'failed', reason: 'signed_out', retryable: true };
    case 'billing_error':
      return { status: 'failed', reason: `billing_${event.responseCode}`, retryable: true };
  }
}
