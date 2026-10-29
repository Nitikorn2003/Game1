import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@game1/engine';
import { TestStore, syncWallet, type CatalogItem, type Settlement, type TestPurchaseChoice, type WalletHost } from '../src/store.js';

const catalog: CatalogItem[] = [
  { id: 'gems_small', kind: 'consumable', grants: { gems: 100 }, testPrice: '$0.99' },
  { id: 'starter_pack', kind: 'consumable', grants: { gems: 300, egg_prism: 1 }, testPrice: '$2.99' },
  { id: 'remove_ads', kind: 'non_consumable', entitlement: 'remove_ads', testPrice: '$3.99' },
];

function store(choice: TestPurchaseChoice = 'buy', storage = new MemoryStore()) {
  return new TestStore(catalog, storage, { ask: () => Promise.resolve(choice), pendingMs: 10 });
}

/** A save that remembers applied settlements, like the game does. */
function host() {
  const state = { gems: 0, eggs: 0, pending: null as string | null, applied: [] as string[], entitlements: [] as string[], writes: 0 };
  const h: WalletHost = {
    pendingSettlement: () => state.pending,
    beginSettlement: (id) => {
      state.pending = id;
      state.writes += 1;
      return Promise.resolve();
    },
    finishSettlement: (s: Settlement) => {
      if (!state.applied.includes(s.id)) {
        state.gems += s.amounts.gems ?? 0;
        state.eggs += s.amounts.egg_prism ?? 0;
        state.applied.push(s.id);
      }
      state.pending = null;
      state.writes += 1;
      return Promise.resolve();
    },
    setEntitlements: (e) => {
      state.entitlements = [...e];
    },
  };
  return { state, host: h };
}

let n = 0;
const ids = () => `s${++n}`;

describe('TestStore', () => {
  it('lists known products with their test prices', async () => {
    expect(await store().products(['gems_small', 'nope'])).toEqual([{ id: 'gems_small', kind: 'consumable', price: '$0.99' }]);
  });

  it('credits a bought consumable to the wallet and settles it once', async () => {
    const s = store();
    expect(await s.purchase('gems_small')).toEqual({ status: 'granted' });
    expect((await s.wallet()).balances).toEqual({ gems: 100 });
    const first = await s.settle('a');
    expect(first).toEqual({ id: 'a', amounts: { gems: 100 } });
    expect(await s.settle('a')).toEqual(first);
    expect(await s.settle('b')).toEqual({ id: 'b', amounts: {} });
  });

  it('does nothing for a cancelled purchase and reports unknown products', async () => {
    const s = store('cancel');
    expect(await s.purchase('gems_small')).toEqual({ status: 'cancelled' });
    expect((await s.wallet()).balances).toEqual({});
    expect(await s.purchase('nope')).toEqual({ status: 'failed', reason: 'unknown_product', retryable: false });
  });

  it('credits a pending purchase later and tells listeners', async () => {
    const s = store('pending');
    const changed = new Promise<void>((resolve) => s.onChange(resolve));
    expect(await s.purchase('gems_small')).toEqual({ status: 'pending' });
    expect((await s.wallet()).balances).toEqual({});
    await changed;
    expect((await s.wallet()).balances).toEqual({ gems: 100 });
  });

  it('turns on entitlements once and takes them back on refund', async () => {
    const s = store();
    await s.purchase('remove_ads');
    await s.purchase('remove_ads');
    expect((await s.wallet()).entitlements).toEqual(['remove_ads']);
    await s.refund('remove_ads');
    expect((await s.wallet()).entitlements).toEqual([]);
  });

  it('keeps its wallet across restarts', async () => {
    const storage = new MemoryStore();
    await store('buy', storage).purchase('gems_small');
    expect((await store('buy', storage).wallet()).balances).toEqual({ gems: 100 });
  });
});

describe('syncWallet', () => {
  it('moves purchases into the save exactly once', async () => {
    const s = store();
    const { state, host: h } = host();
    await s.purchase('starter_pack');
    await s.purchase('remove_ads');
    await syncWallet(s, h, ids);
    expect(state).toMatchObject({ gems: 300, eggs: 1, pending: null, entitlements: ['remove_ads'] });
    await syncWallet(s, h, ids);
    expect(state.gems).toBe(300);
  });

  it('skips the server round trip when the wallet is empty', async () => {
    const { state, host: h } = host();
    expect(await syncWallet(store(), h, ids)).toBeNull();
    expect(state.writes).toBe(0);
  });

  it('recovers when the app died after the server settled but before the save was written', async () => {
    const s = store();
    const { state, host: h } = host();
    await s.purchase('gems_small');
    // First attempt: the id is saved, the server settles, then the app is killed.
    await h.beginSettlement('crash-1');
    await s.settle('crash-1');
    expect(state.gems).toBe(0);
    // Next start: the saved id is sent again and the same amounts come back.
    await syncWallet(s, h, ids);
    expect(state.gems).toBe(100);
    expect(state.pending).toBeNull();
    await syncWallet(s, h, ids);
    expect(state.gems).toBe(100);
  });

  it('carries a refund of already settled gems into the save as a negative amount', async () => {
    const s = store();
    const { state, host: h } = host();
    await s.purchase('gems_small');
    await syncWallet(s, h, ids);
    await s.refund('gems_small');
    await syncWallet(s, h, ids);
    expect(state.gems).toBe(0);
  });
});
