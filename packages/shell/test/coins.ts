import { ManualClock, MemoryStore, int, localDayKey, num, type SaveFormat } from '@game1/engine';
import { TestStore, type CatalogItem, type StoreService } from '@game1/platform';
import {
  Session,
  adsLeft,
  createAdLedger,
  createSettings,
  createShop,
  knownEntitlements,
  loadSaveSlots,
  recordRewarded,
  restoreAdLedger,
  restoreSettings,
  restoreShop,
  type RewardedLimits,
  type SessionOptions,
  type SessionState,
  type ShellKey,
} from '../src/index.js';
import { FakeAds, settle } from '../src/testing.js';

/** The smallest game the shell can run: coins from a rewarded ad or a purchase, and time played. */
export interface CoinState extends SessionState {
  coins: number;
  played: number;
}

export const PLACEMENTS = ['bonus'] as const;
export type Placement = (typeof PLACEMENTS)[number];
export const LIMITS: RewardedLimits<Placement> = { perPlacement: { bonus: 3 }, total: 3 };
const ENTITLEMENTS = ['remove_ads'] as const;

export const CATALOG: readonly CatalogItem[] = [
  { id: 'coins_small', kind: 'consumable', grants: { coins: 100 }, testPrice: '$0.99' },
  { id: 'remove_ads', kind: 'non_consumable', entitlement: 'remove_ads', testPrice: '$3.99' },
];

export const T0 = Date.UTC(2026, 9, 1, 8, 0, 0);

export const format: SaveFormat<CoinState> = {
  game: 'coins',
  version: 1,
  migrations: {},
  restore: (data) => ({
    coins: int(data.coins, 0, -1_000_000),
    played: num(data.played, 0),
    shop: restoreShop(data.shop, ENTITLEMENTS),
    ads: restoreAdLedger(data.ads, PLACEMENTS),
    settings: restoreSettings(data.settings),
  }),
};

export function newCoinState(): CoinState {
  return { coins: 0, played: 0, shop: createShop(), ads: createAdLedger(PLACEMENTS), settings: createSettings() };
}

export class CoinGame extends Session<CoinState, ShellKey, 'coin' | 'cloud', Placement> {
  static async load(o: SessionOptions): Promise<CoinGame> {
    const { slots, state, note } = await loadSaveSlots(o.storage, format, o.clock);
    return new CoinGame(o, slots, state ?? newCoinState(), note, CATALOG, { purchase: 'coin', cloud: 'cloud' });
  }

  start(): void {
    this.beginSession();
    this.startServices();
  }

  play(seconds: number): void {
    this.state.played += seconds;
  }

  protected override newState(): CoinState {
    return newCoinState();
  }

  protected override progressOf(state: CoinState): number {
    return state.played;
  }

  protected override grant(state: CoinState, amounts: Readonly<Record<string, number>>): void {
    state.coins += amounts.coins ?? 0;
  }

  protected override setEntitlements(state: CoinState, entitlements: readonly string[]): void {
    state.shop.entitlements = knownEntitlements(entitlements, ENTITLEMENTS);
  }

  override adOffered(placement: Placement): boolean {
    return adsLeft(this.state.ads, placement, this.today(), LIMITS) > 0;
  }

  protected override grantAdReward(placement: Placement): boolean {
    recordRewarded(this.state.ads, placement, this.now(), this.today());
    this.state.coins += 10;
    return true;
  }

  protected override adBreaksEarned(state: CoinState): boolean {
    return state.played >= 60;
  }
}

export { FakeAds, settle };

export interface Rig {
  clock: ManualClock;
  storage: MemoryStore;
  ads: FakeAds;
  store: StoreService;
  options: SessionOptions;
}

export function rig(overrides: Partial<Omit<Rig, 'options'>> = {}): Rig {
  const clock = overrides.clock ?? new ManualClock(T0);
  const storage = overrides.storage ?? new MemoryStore();
  const ads = overrides.ads ?? new FakeAds();
  const store = overrides.store ?? new TestStore(CATALOG, storage, { ask: () => Promise.resolve('buy') });
  return { clock, storage, ads, store, options: { clock, storage, ads, store, dayKey: (ms) => localDayKey(ms, 0) } };
}

export async function started(r: Rig): Promise<CoinGame> {
  const game = await CoinGame.load(r.options);
  game.start();
  await settle(game);
  return game;
}
