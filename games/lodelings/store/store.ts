/** What tools/store-assets.ts makes for the game's Google Play listing. */
import type { StoreConfig } from '../../../tools/store-assets.js';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';
import { PRIVACY_POLICY, PRIVACY_UPDATED } from '../src/privacy.js';
import { listing } from './listing.js';
import { SCREENS } from './screens.js';

const known = (locale: string): Locale => LOCALES.find((l) => l === locale) ?? 'en';

const config: StoreConfig = {
  locales: LOCALES,
  listing: (locale, edition) => listing(known(locale), edition),
  privacy: (locale) => {
    const text = translator(known(locale));
    return {
      title: `${text.t('app.title')}: ${text.t('settings.privacy')}`,
      updated: text.t('settings.privacyUpdated', { date: PRIVACY_UPDATED }),
      sections: PRIVACY_POLICY[known(locale)],
    };
  },
  screens: SCREENS,
};

export default config;
