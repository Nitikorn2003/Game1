import '@game1/ui/ui.css';
import './fonts.css';
import './styles.css';
import { browserScheduler, systemClock } from '@game1/engine';
import { TestAds, TestStore, onAppHidden, onAppVisible, webHaptics, webStorage } from '@game1/platform';
import { render } from 'preact';
import { webSound } from './audio.js';
import { CATALOG } from './catalog.js';
import { Game } from './game.js';
import { resolveLocale, translator, type StringKey } from './i18n/index.js';
import { App } from './ui/App.js';

/** The browser version: simulated ads and store, saves in localStorage. */
async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app');
  const storage = webStorage('lodelings:');
  const languages = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  let game: Game | null = null;
  const t = (key: StringKey, params?: Record<string, string>) => translator(resolveLocale(game?.state.settings.locale ?? 'auto', languages)).t(key, params);

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

  const loaded = await Game.load({ clock: systemClock, scheduler: browserScheduler, storage, ads, store, haptics: webHaptics, sound: webSound() });
  game = loaded;
  onAppHidden(() => {
    void loaded.suspend();
  });
  onAppVisible(() => {
    loaded.resume();
  });
  render(<App game={loaded} persistent={storage.persistent} version={__APP_VERSION__} languages={languages} />, root);
  loaded.start();
}

void main();
