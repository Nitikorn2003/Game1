import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IapServerClient } from '../src/iap-client.js';
import { PlayStore, type NativeBilling, type NativePurchaseEvent } from '../src/play-store.js';
import type { CatalogItem } from '../src/store.js';

const CATALOG: CatalogItem[] = [
  { id: 'gems_small', kind: 'consumable', grants: { gems: 100 }, testPrice: '$0.99' },
  { id: 'remove_ads', kind: 'non_consumable', entitlement: 'remove_ads', testPrice: '$3.99' },
];

/** Plays the part of the Game1Billing plugin: each purchase answers with the scripted events. */
class FakeBilling implements NativeBilling {
  calls: string[] = [];
  tokens: (string | null)[] = [];
  answer: NativePurchaseEvent[] = [{ type: 'granted', productId: 'gems_small', newlyGranted: true }];
  launch: { launched: boolean; reason?: string } = { launched: true };
  playAvailable = true;
  private listener: ((event: NativePurchaseEvent) => void) | null = null;

  configure(options: { baseUrl: string; gameId: string }): Promise<void> {
    this.calls.push(`configure ${options.baseUrl} ${options.gameId}`);
    return Promise.resolve();
  }
  setSessionToken(options: { token: string | null }): Promise<void> {
    this.tokens.push(options.token);
    return Promise.resolve();
  }
  queryProducts(options: { productIds: string[] }) {
    this.calls.push(`query ${options.productIds.join(',')}`);
    return Promise.resolve({ products: this.playAvailable ? options.productIds.map((productId) => ({ productId, price: `฿${productId.length}` })) : null });
  }
  purchase(options: { productId: string }) {
    this.calls.push(`purchase ${options.productId}`);
    if (this.launch.launched) {
      setTimeout(() => {
        for (const event of this.answer) this.emit(event);
      }, 10);
    }
    return Promise.resolve(this.launch);
  }
  restore(): Promise<void> {
    this.calls.push('restore');
    return Promise.resolve();
  }
  addListener(_eventName: 'purchaseEvent', listener: (event: NativePurchaseEvent) => void) {
    this.listener = listener;
    return Promise.resolve({ remove: () => Promise.resolve() });
  }
  emit(event: NativePurchaseEvent): void {
    this.listener?.(event);
  }
}

const server = {
  wallet: () => Promise.resolve({ balances: { gems: 100 }, entitlements: [] }),
  settle: (id: string) => Promise.resolve({ id, amounts: { gems: 100 } }),
} as unknown as IapServerClient;

function store(billing: FakeBilling, idToken: (force: boolean) => Promise<string | null> = (force) => Promise.resolve(force ? 'fresh' : 'token')) {
  return new PlayStore(billing, server, CATALOG, { baseUrl: 'https://iap.test', gameId: 'lodelings', idToken, purchaseTimeoutMs: 60_000 });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Google Play purchases', () => {
  it('connects the plugin, signs it in and finishes held purchases first', async () => {
    const billing = new FakeBilling();
    await store(billing).start();
    expect(billing.calls).toEqual(['configure https://iap.test lodelings', 'restore']);
    expect(billing.tokens).toEqual(['token']);
  });

  it('shows Google Play prices and marks products Play cannot price', async () => {
    const billing = new FakeBilling();
    const s = store(billing);
    expect(await s.products(['gems_small', 'remove_ads', 'not_sold'])).toEqual([
      { id: 'gems_small', kind: 'consumable', price: '฿10' },
      { id: 'remove_ads', kind: 'non_consumable', price: '฿10' },
    ]);
    billing.playAvailable = false;
    expect((await s.products(['gems_small']))[0]?.price).toBeNull();
  });

  it('reports each outcome of the purchase sheet', async () => {
    vi.useFakeTimers();
    const billing = new FakeBilling();
    const s = store(billing);
    const cases: [NativePurchaseEvent[], unknown][] = [
      [[{ type: 'granted', productId: 'gems_small', newlyGranted: true }], { status: 'granted' }],
      [[{ type: 'pending', productId: 'gems_small' }], { status: 'pending' }],
      [[{ type: 'deferred', productId: 'gems_small' }], { status: 'pending' }],
      [[{ type: 'user_canceled' }], { status: 'cancelled' }],
      [[{ type: 'refused', productId: 'gems_small', code: 'purchase_not_owned', message: 'no' }], { status: 'failed', reason: 'purchase_not_owned', retryable: false }],
      [[{ type: 'billing_error', responseCode: 6, message: 'error' }], { status: 'failed', reason: 'billing_6', retryable: true }],
      // An event for a different product (a restore finishing) does not answer this purchase.
      [
        [
          { type: 'granted', productId: 'remove_ads', newlyGranted: false },
          { type: 'canceled', productId: 'gems_small' },
        ],
        { status: 'cancelled' },
      ],
    ];
    for (const [events, expected] of cases) {
      billing.answer = events;
      const result = s.purchase('gems_small');
      await vi.advanceTimersByTimeAsync(20);
      expect(await result).toEqual(expected);
    }
  });

  it('refuses unknown products, a second sheet at once, and purchases while signed out', async () => {
    vi.useFakeTimers();
    const billing = new FakeBilling();
    const s = store(billing);
    expect(await s.purchase('free_gems')).toMatchObject({ status: 'failed', reason: 'unknown_product' });
    const first = s.purchase('gems_small');
    await vi.advanceTimersByTimeAsync(0);
    expect(await s.purchase('gems_small')).toMatchObject({ status: 'failed', reason: 'busy' });
    await vi.advanceTimersByTimeAsync(20);
    expect(await first).toEqual({ status: 'granted' });

    const signedOut = store(new FakeBilling(), () => Promise.resolve(null));
    expect(await signedOut.purchase('gems_small')).toMatchObject({ status: 'failed', reason: 'signed_out' });
  });

  it('passes on a sheet that could not open, and treats a sheet left open as pending', async () => {
    vi.useFakeTimers();
    const billing = new FakeBilling();
    billing.launch = { launched: false, reason: 'unavailable' };
    const s = store(billing);
    expect(await s.purchase('gems_small')).toEqual({ status: 'failed', reason: 'unavailable', retryable: true });
    billing.launch = { launched: true };
    billing.answer = [];
    const open = s.purchase('gems_small');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await open).toEqual({ status: 'pending' });
  });

  it('tells the game when the wallet changed, and renews an expired session at most once a minute', async () => {
    vi.useFakeTimers();
    const billing = new FakeBilling();
    const s = store(billing);
    let changes = 0;
    s.onChange(() => (changes += 1));
    await s.start();
    billing.emit({ type: 'granted', productId: 'gems_small', newlyGranted: true });
    billing.emit({ type: 'revoked', productId: 'remove_ads' });
    billing.emit({ type: 'pending', productId: 'gems_small' });
    expect(changes).toBe(2);

    billing.emit({ type: 'sign_in_required', productId: 'gems_small' });
    await vi.advanceTimersByTimeAsync(0);
    billing.emit({ type: 'sign_in_required', productId: 'gems_small' });
    await vi.advanceTimersByTimeAsync(0);
    expect(billing.tokens).toEqual(['token', 'fresh']);
    expect(billing.calls.filter((c) => c === 'restore')).toHaveLength(2);
  });

  it('reads the wallet and settles it through the purchase server', async () => {
    const s = store(new FakeBilling());
    expect(await s.wallet()).toEqual({ balances: { gems: 100 }, entitlements: [] });
    expect(await s.settle('settle-1')).toEqual({ id: 'settle-1', amounts: { gems: 100 } });
  });
});
