import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import {
  ADMOB_TEST_UNITS,
  AdMobAds,
  FirebaseAuth,
  IapServerClient,
  PlayStore,
  noStore,
  webHaptics,
  webStorage,
  type AdMobPlugin,
  type FirebaseAuthenticationPlugin,
  type NativeBilling,
} from '@game1/platform';
import { handleBack } from '@game1/ui';
import type { Services } from './boot.js';
import { CATALOG } from './catalog.js';
import type { AccountOptions } from './game.js';

/** The game's id on the purchase server (its catalog and the API paths). */
export const GAME_ID = 'lodelings';

/** The parts of @capacitor/app used here. */
interface AppPlugin {
  addListener(eventName: 'backButton' | 'pause' | 'resume', listener: () => void): Promise<PluginListenerHandle>;
  minimizeApp(): Promise<void>;
}

/** True inside the Android app, false in a browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Settings baked into the app when it is built, from VITE_* variables (see .env.example).
 * None of them is a secret: anyone who has the app can read them.
 */
export interface NativeConfig {
  /** The purchase server. Without one the app has no purchases, sign-in or cloud saves. */
  serverUrl: string | null;
  /** Real AdMob ad units. Without both, the app shows Google's test ads. */
  adUnits: { rewarded: string; interstitial: string } | null;
}

type NativeEnv = Partial<Record<'VITE_IAP_SERVER_URL' | 'VITE_ADMOB_REWARDED_UNIT' | 'VITE_ADMOB_INTERSTITIAL_UNIT', string>>;

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

/** The Android app: AdMob, Google Play purchases through the purchase server, Firebase sign-in. */
export function nativeServices(config: NativeConfig): Services {
  const admob = registerPlugin<AdMobPlugin>('AdMob');
  const firebase = registerPlugin<FirebaseAuthenticationPlugin>('FirebaseAuthentication');
  const billing = registerPlugin<NativeBilling>('Game1Billing');
  const app = registerPlugin<AppPlugin>('App');

  // Saves stay in the WebView's localStorage, which Android keeps until the app's data is cleared.
  const storage = webStorage('lodelings:');
  const ads = new AdMobAds(admob, config.adUnits ? { units: config.adUnits, testing: false } : { units: ADMOB_TEST_UNITS, testing: true });
  let play: PlayStore | null = null;
  let account: AccountOptions | undefined;
  // Without Firebase in the build (no google-services.json) there is no sign-in, so no purchases:
  // the app is then the ads-only edition, and its shop offers only what ads give.
  if (config.serverUrl && Capacitor.isPluginAvailable('FirebaseAuthentication')) {
    const auth = new FirebaseAuth(firebase);
    const idToken = (forceRefresh: boolean) => auth.idToken(forceRefresh);
    const server = new IapServerClient({ baseUrl: config.serverUrl, gameId: GAME_ID, idToken });
    play = new PlayStore(billing, server, CATALOG, { baseUrl: config.serverUrl, gameId: GAME_ID, idToken });
    account = { auth, server };
  }
  const store = play ?? noStore;

  return {
    storage,
    ads,
    store,
    haptics: webHaptics,
    ...(account ? { account } : {}),
    attach: (game) => {
      void app.addListener('pause', () => {
        void game.suspend();
      });
      void app.addListener('resume', () => {
        game.resume();
        // A payment that cleared while the app was away is waiting in Google Play.
        play?.restore().catch(() => undefined);
      });
      void app.addListener('backButton', () => {
        if (!handleBack()) void app.minimizeApp();
      });
      // Asks for ad consent where the law requires it, then loads the first ads.
      void ads.init();
      // Connects Google Play and finishes purchases left over from earlier sessions.
      play?.start().catch((err: unknown) => {
        console.error(err);
      });
    },
  };
}
