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
import type { GameIdentity, NativeConfig, Services } from './services.js';
import type { AccountOptions } from './session.js';

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
 * The Android app: AdMob, Google Play purchases through the purchase server, Firebase sign-in.
 * The app's Android project must include the AdMob, Firebase Authentication, App and
 * Game1Billing plugins (a game's package.json lists them).
 */
export function nativeServices(config: NativeConfig, game: GameIdentity): Services {
  const admob = registerPlugin<AdMobPlugin>('AdMob');
  const firebase = registerPlugin<FirebaseAuthenticationPlugin>('FirebaseAuthentication');
  const billing = registerPlugin<NativeBilling>('Game1Billing');
  const app = registerPlugin<AppPlugin>('App');

  // Saves stay in the WebView's localStorage, which Android keeps until the app's data is cleared.
  const storage = webStorage(game.storagePrefix);
  const ads = new AdMobAds(admob, config.adUnits ? { units: config.adUnits, testing: false } : { units: ADMOB_TEST_UNITS, testing: true });
  let play: PlayStore | null = null;
  let account: AccountOptions | undefined;
  // Without Firebase in the build (no google-services.json) there is no sign-in, so no purchases:
  // the app is then the ads-only edition, and its shop offers only what ads give.
  if (config.serverUrl && Capacitor.isPluginAvailable('FirebaseAuthentication')) {
    const auth = new FirebaseAuth(firebase);
    const idToken = (forceRefresh: boolean) => auth.idToken(forceRefresh);
    const server = new IapServerClient({ baseUrl: config.serverUrl, gameId: game.gameId, idToken });
    play = new PlayStore(billing, server, game.catalog, { baseUrl: config.serverUrl, gameId: game.gameId, idToken });
    account = { auth, server };
  }
  const store = play ?? noStore;

  return {
    storage,
    ads,
    store,
    haptics: webHaptics,
    ...(account ? { account } : {}),
    attach: (session) => {
      void app.addListener('pause', () => {
        void session.suspend();
      });
      void app.addListener('resume', () => {
        session.resume();
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
