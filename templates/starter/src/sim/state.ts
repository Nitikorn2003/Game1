import { int, isRecord, num, type Data, type SaveFormat } from '@game1/engine';
import {
  createAdLedger,
  createSettings,
  createShop,
  restoreAdLedger,
  restoreSettings,
  restoreShop,
  type AdLedger,
  type ShellSettings,
  type ShopRecord,
} from '@game1/shell';

export const AD_PLACEMENTS = ['bonus'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const ENTITLEMENTS = ['remove_ads'] as const;
export type Entitlement = (typeof ENTITLEMENTS)[number];

export interface GameState {
  createdAt: number;
  coins: number;
  /** Each tap gives tapLevel + 1 coins. */
  tapLevel: number;
  stats: { taps: number; playSeconds: number };
  ads: AdLedger<AdPlacement>;
  shop: ShopRecord<Entitlement>;
  settings: ShellSettings;
}

export const SAVE_VERSION = 1;

export function createState(now: number): GameState {
  return {
    createdAt: now,
    coins: 0,
    tapLevel: 0,
    stats: { taps: 0, playSeconds: 0 },
    ads: createAdLedger(AD_PLACEMENTS),
    shop: createShop(),
    settings: createSettings(),
  };
}

/** Every field is checked, so a damaged or hand-edited save can never break the game. */
export function restoreState(data: Data): GameState {
  const s = createState(num(data.createdAt, 0));
  // A refund can take back coins that were already spent.
  s.coins = int(data.coins, 0, -1_000_000_000);
  s.tapLevel = int(data.tapLevel, 0, 0, 1000);
  const stats = isRecord(data.stats) ? data.stats : {};
  s.stats = { taps: int(stats.taps, 0), playSeconds: num(stats.playSeconds, 0) };
  s.ads = restoreAdLedger(data.ads, AD_PLACEMENTS);
  s.shop = restoreShop(data.shop, ENTITLEMENTS);
  s.settings = restoreSettings(data.settings);
  return s;
}

export const saveFormat: SaveFormat<GameState> = {
  game: 'starter',
  version: SAVE_VERSION,
  // migrations[1] will turn a version 1 save into version 2, once there is a version 2.
  migrations: {},
  restore: restoreState,
};
