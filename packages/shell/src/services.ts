import { TestAds, TestStore, onAppHidden, onAppVisible, webHaptics, webStorage, type AdsService, type CatalogItem, type Haptics, type StoreService, type WebStore } from '@game1/platform';
import type { AccountOptions } from './session.js';
import type { ShellKey } from './strings.js';

/** What the running game offers the platform. */
export interface Lifecycle {
  /** The app is going to the background. */
  suspend(): Promise<void>;
  /** The app is back in front. */
  resume(): void;
}

/** What differs between the browser version and the Android app. */
export interface Services {
  storage: WebStore;
  ads: AdsService;
  store: StoreService;
  haptics: Haptics;
  account?: AccountOptions;
  /** Connects the running game to the platform: going to the background, the back button. */
  attach(game: Lifecycle): void;
}

export type ShellTranslate = (key: ShellKey, params?: Readonly<Record<string, string | number>>) => string;

export interface GameIdentity {
  /** The game's id on the purchase server (its catalog and the API paths). */
  gameId: string;
  catalog: readonly CatalogItem[];
  /** Keeps each game's saves apart in the browser's storage, for example 'lodelings:'. */
  storagePrefix: string;
}

/** The browser version: simulated ads and store that never charge, saves in localStorage. */
export function browserServices(t: ShellTranslate, game: GameIdentity & { productName: (productId: string) => string }): Services {
  const storage = webStorage(game.storagePrefix);
  const ads = new TestAds(() => ({
    tag: t('test.adTag'),
    rewardedTitle: t('test.rewardedTitle'),
    rewardedBody: t('test.rewardedBody'),
    interstitialTitle: t('test.interstitialTitle'),
    interstitialBody: t('test.interstitialBody'),
    claim: t('test.claim'),
    close: t('test.close'),
  }));
  const store = new TestStore(game.catalog, storage, {
    label: game.productName,
    text: () => ({
      tag: t('test.purchaseTag'),
      title: t('test.purchaseTitle'),
      body: (product, price) => t('test.purchaseBody', { product, price }),
      buy: t('test.buy'),
      pending: t('test.pending'),
      cancel: t('test.cancel'),
    }),
  });
  return {
    storage,
    ads,
    store,
    haptics: webHaptics,
    attach: (session) => {
      onAppHidden(() => {
        void session.suspend();
      });
      onAppVisible(() => {
        session.resume();
      });
    },
  };
}

/**
 * Settings baked into the Android app when it is built, from VITE_* variables (see a game's
 * .env.example). None of them is a secret: anyone who has the app can read them.
 */
export interface NativeConfig {
  /** The purchase server. Without one the app has no purchases, sign-in or cloud saves. */
  serverUrl: string | null;
  /** Real AdMob ad units. Without both, the app shows Google's test ads. */
  adUnits: { rewarded: string; interstitial: string } | null;
}

export type NativeEnv = Partial<Record<'VITE_IAP_SERVER_URL' | 'VITE_ADMOB_REWARDED_UNIT' | 'VITE_ADMOB_INTERSTITIAL_UNIT', string>>;

const AD_UNIT = /^ca-app-pub-\d{16}\/\d{10}$/;

export function nativeConfig(env: NativeEnv): NativeConfig {
  const url = env.VITE_IAP_SERVER_URL?.trim().replace(/\/+$/, '') ?? '';
  const rewarded = env.VITE_ADMOB_REWARDED_UNIT?.trim() ?? '';
  const interstitial = env.VITE_ADMOB_INTERSTITIAL_UNIT?.trim() ?? '';
  return {
    // The Android purchase client refuses anything but https, so the game does too.
    serverUrl: /^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w./-]*)?$/i.test(url) ? url : null,
    adUnits: AD_UNIT.test(rewarded) && AD_UNIT.test(interstitial) ? { rewarded, interstitial } : null,
  };
}
