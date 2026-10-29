import { TestAds, TestStore, onAppHidden, onAppVisible, webHaptics, webStorage } from '@game1/platform';
import type { Services, Translate } from './boot.js';
import { CATALOG } from './catalog.js';
import type { StringKey } from './i18n/index.js';

/** The browser version: simulated ads and store that never charge, saves in localStorage. */
export function browserServices(t: Translate): Services {
  const storage = webStorage('lodelings:');
  const ads = new TestAds(() => ({
    tag: t('test.adTag'),
    rewardedTitle: t('test.rewardedTitle'),
    rewardedBody: t('test.rewardedBody'),
    interstitialTitle: t('test.interstitialTitle'),
    interstitialBody: t('test.interstitialBody'),
    claim: t('test.claim'),
    close: t('test.close'),
  }));
  const store = new TestStore(CATALOG, storage, {
    label: (id) => t(`shop.${id}` as StringKey),
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
    attach: (game) => {
      onAppHidden(() => {
        void game.suspend();
      });
      onAppVisible(() => {
        game.resume();
      });
    },
  };
}
