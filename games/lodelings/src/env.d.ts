/** The game's version from package.json, set at build time. */
declare const __APP_VERSION__: string;

/** Android build settings; see .env.example. */
interface ImportMetaEnv {
  readonly VITE_IAP_SERVER_URL?: string;
  readonly VITE_ADMOB_REWARDED_UNIT?: string;
  readonly VITE_ADMOB_INTERSTITIAL_UNIT?: string;
}
