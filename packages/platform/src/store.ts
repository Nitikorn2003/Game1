import type { KeyValueStore } from '@game1/engine';
import { showOverlay } from './overlay.js';

export interface Product {
  id: string;
  kind: 'consumable' | 'non_consumable';
  /** Price as the store shows it, in the player's currency; null when the store has no price yet. */
  price: string | null;
}

export type PurchaseResult =
  | { status: 'granted' }
  | { status: 'pending' }
  | { status: 'cancelled' }
  | { status: 'failed'; reason: string; retryable: boolean };

/** Currencies moved from the server wallet into the save. Amounts are negative after a refund. */
export interface Settlement {
  id: string;
  amounts: Record<string, number>;
}

export interface WalletView {
  balances: Record<string, number>;
  entitlements: string[];
}

/**
 * Purchases. The game never decides that something was paid: a real store asks the purchase
 * server, which checks with Google Play and credits a wallet. The game then settles that wallet
 * into its save, exactly once per settlement id.
 */
export interface StoreService {
  /** 'none' sells nothing: see `noStore`. */
  readonly name: 'test' | 'play' | 'none';
  products(ids: readonly string[]): Promise<Product[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  wallet(): Promise<WalletView>;
  settle(settlementId: string): Promise<Settlement>;
  /** Fires when a purchase completes outside purchase(), e.g. a pending payment cleared. */
  onChange(listener: () => void): () => void;
}

/**
 * The store of a build that sells nothing, such as an app released with ads only before its
 * purchase server exists. A game hides its paid items and never asks this store for a wallet.
 */
export const noStore: StoreService = {
  name: 'none',
  products: () => Promise.resolve([]),
  purchase: () => Promise.resolve({ status: 'failed', reason: 'no_store', retryable: false }),
  wallet: () => Promise.reject(new Error('This build sells nothing.')),
  settle: () => Promise.reject(new Error('This build sells nothing.')),
  onChange: () => () => undefined,
};

export interface CatalogItem {
  id: string;
  kind: 'consumable' | 'non_consumable';
  /** Consumables: what one purchase puts in the wallet. */
  grants?: Record<string, number>;
  /** Non-consumables: the entitlement the purchase turns on. */
  entitlement?: string;
  /** The price the test store shows. Real prices come from Google Play. */
  testPrice: string;
}

interface TestWallet {
  balances: Record<string, number>;
  entitlements: string[];
  settlements: { id: string; amounts: Record<string, number> }[];
}

export type TestPurchaseChoice = 'buy' | 'pending' | 'cancel';

export interface TestStoreText {
  tag: string;
  title: string;
  body: (product: string, price: string) => string;
  buy: string;
  pending: string;
  cancel: string;
}

const ENGLISH: TestStoreText = {
  tag: 'TEST PURCHASE',
  title: 'No money is charged',
  body: (product, price) => `This browser version only simulates buying "${product}" (${price}). Real purchases happen through Google Play in the Android app.`,
  buy: 'Buy (test)',
  pending: 'Pay later',
  cancel: 'Cancel',
};

/**
 * A stand-in for the purchase server and Google Play in the browser version and in tests.
 * Its wallet is stored like the real server's, so the game's settlement code runs unchanged.
 */
export class TestStore implements StoreService {
  readonly name = 'test' as const;
  private readonly listeners = new Set<() => void>();
  private pendingTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private readonly catalog: readonly CatalogItem[],
    private readonly storage: KeyValueStore,
    private readonly options: {
      ask?: (item: CatalogItem, label: string) => Promise<TestPurchaseChoice>;
      label?: (productId: string) => string;
      text?: () => TestStoreText;
      pendingMs?: number;
    } = {},
  ) {}

  products(ids: readonly string[]): Promise<Product[]> {
    return Promise.resolve(
      ids.flatMap((id) => {
        const item = this.catalog.find((p) => p.id === id);
        return item ? [{ id, kind: item.kind, price: item.testPrice }] : [];
      }),
    );
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    const item = this.catalog.find((p) => p.id === productId);
    if (!item) return { status: 'failed', reason: 'unknown_product', retryable: false };
    const wallet = await this.load();
    if (item.kind === 'non_consumable' && item.entitlement && wallet.entitlements.includes(item.entitlement)) {
      return { status: 'granted' };
    }
    const label = this.options.label?.(productId) ?? productId;
    const choice = await (this.options.ask ?? ((i, l) => this.askWithOverlay(i, l)))(item, label);
    if (choice === 'cancel') return { status: 'cancelled' };
    if (choice === 'pending') {
      const timer = setTimeout(() => {
        void this.credit(item).then(() => {
          for (const listener of this.listeners) listener();
        });
      }, this.options.pendingMs ?? 8000);
      this.pendingTimers.push(timer);
      return { status: 'pending' };
    }
    await this.credit(item);
    return { status: 'granted' };
  }

  async wallet(): Promise<WalletView> {
    const wallet = await this.load();
    return { balances: { ...wallet.balances }, entitlements: [...wallet.entitlements] };
  }

  async settle(settlementId: string): Promise<Settlement> {
    const wallet = await this.load();
    const done = wallet.settlements.find((s) => s.id === settlementId);
    if (done) return { id: done.id, amounts: { ...done.amounts } };
    const amounts = Object.fromEntries(Object.entries(wallet.balances).filter(([, v]) => v !== 0));
    wallet.balances = {};
    wallet.settlements = [...wallet.settlements, { id: settlementId, amounts }].slice(-100);
    await this.persist(wallet);
    return { id: settlementId, amounts };
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Test helper: what a refund does on the real server (claw back currency or revoke the entitlement). */
  async refund(productId: string): Promise<void> {
    const item = this.catalog.find((p) => p.id === productId);
    if (!item) return;
    const wallet = await this.load();
    for (const [currency, amount] of Object.entries(item.grants ?? {})) wallet.balances[currency] = (wallet.balances[currency] ?? 0) - amount;
    if (item.entitlement) wallet.entitlements = wallet.entitlements.filter((e) => e !== item.entitlement);
    await this.persist(wallet);
  }

  dispose(): void {
    for (const t of this.pendingTimers) clearTimeout(t);
    this.pendingTimers = [];
  }

  private async credit(item: CatalogItem): Promise<void> {
    const wallet = await this.load();
    for (const [currency, amount] of Object.entries(item.grants ?? {})) wallet.balances[currency] = (wallet.balances[currency] ?? 0) + amount;
    if (item.entitlement && !wallet.entitlements.includes(item.entitlement)) wallet.entitlements.push(item.entitlement);
    await this.persist(wallet);
  }

  private async askWithOverlay(item: CatalogItem, label: string): Promise<TestPurchaseChoice> {
    const t = (this.options.text ?? (() => ENGLISH))();
    const pressed = await showOverlay({
      tag: t.tag,
      title: t.title,
      body: t.body(label, item.testPrice),
      testId: 'test-purchase',
      buttons: [
        { label: t.cancel, testId: 'test-purchase-cancel' },
        { label: t.pending, testId: 'test-purchase-pending' },
        { label: t.buy, primary: true, testId: 'test-purchase-buy' },
      ],
    });
    return pressed === 2 ? 'buy' : pressed === 1 ? 'pending' : 'cancel';
  }

  private async load(): Promise<TestWallet> {
    const raw = await this.storage.get('test-wallet');
    if (!raw) return { balances: {}, entitlements: [], settlements: [] };
    try {
      const parsed = JSON.parse(raw) as Partial<TestWallet>;
      return { balances: parsed.balances ?? {}, entitlements: parsed.entitlements ?? [], settlements: parsed.settlements ?? [] };
    } catch {
      return { balances: {}, entitlements: [], settlements: [] };
    }
  }

  private persist(wallet: TestWallet): Promise<void> {
    return this.storage.set('test-wallet', JSON.stringify(wallet));
  }
}

/** What the game provides so purchases reach its save exactly once. */
export interface WalletHost {
  pendingSettlement(): string | null;
  /** Records the id in the save and writes the save before resolving. */
  beginSettlement(id: string): Promise<void>;
  /** Applies the amounts unless this id was applied before, clears the pending id and writes the save. */
  finishSettlement(settlement: Settlement): Promise<void>;
  setEntitlements(entitlements: readonly string[]): void;
}

export function randomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Brings the save up to date with the server wallet. The settlement id is saved before the
 * server is asked, so if the app dies in between, the next start repeats the same request and
 * the server answers with the same amounts instead of losing or doubling them.
 */
export async function syncWallet(store: StoreService, host: WalletHost, newId: () => string = randomId): Promise<Settlement | null> {
  const wallet = await store.wallet();
  host.setEntitlements(wallet.entitlements);
  let id = host.pendingSettlement();
  if (id === null) {
    if (Object.values(wallet.balances).every((v) => v === 0)) return null;
    id = newId();
    await host.beginSettlement(id);
  }
  const settlement = await store.settle(id);
  await host.finishSettlement(settlement);
  return settlement;
}
