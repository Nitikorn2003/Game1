import { browserScheduler, systemClock } from '@game1/engine';
import { hotSwap, type AdsService, type Haptics, type StoreService, type WebStore } from '@game1/platform';
import { escapeGoesBack } from '@game1/ui';
import { render } from 'preact';
import { webSound } from './audio.js';
import { Game, type AccountOptions } from './game.js';
import { resolveLocale, translator, type StringKey } from './i18n/index.js';
import { App } from './ui/App.js';

export type Translate = (key: StringKey, params?: Record<string, string>) => string;

/** What differs between the browser version and the Android app. */
export interface Services {
  storage: WebStore;
  ads: AdsService;
  store: StoreService;
  haptics: Haptics;
  account?: AccountOptions;
  /** Connects the running game to the platform: going to the background, the back button. */
  attach(game: Game): void;
}

export const languages: readonly string[] = navigator.languages.length > 0 ? navigator.languages : [navigator.language];

/** Loads the save, shows the game and starts it. `t` translates in the player's language. */
export async function boot(root: HTMLElement, services: (t: Translate) => Services): Promise<void> {
  const swap = await hotSwap();
  let game: Game | null = null;
  const t: Translate = (key, params) => translator(resolveLocale(game?.state.settings.locale ?? 'auto', languages)).t(key, params);
  const s = services(t);
  const loaded = await Game.load({
    clock: systemClock,
    scheduler: browserScheduler,
    storage: s.storage,
    ads: s.ads,
    store: s.store,
    haptics: s.haptics,
    sound: webSound(),
    ...(s.account ? { account: s.account } : {}),
  });
  game = loaded;
  // Claude's artifact viewer hands over the save when it swaps in a newer version of the page.
  const carried = (swap.data as { save?: unknown } | undefined)?.save;
  if (typeof carried === 'string') await loaded.importSave(carried);
  swap.keep(() => ({ save: loaded.exportSave() }));
  s.attach(loaded);
  escapeGoesBack();
  render(<App game={loaded} persistent={s.storage.persistent} version={__APP_VERSION__} languages={languages} />, root);
  loaded.start();
}

/** Shows a translated message instead of the game when it could not start. */
export function bootFailed(root: HTMLElement, err: unknown): void {
  console.error(err);
  const message = document.createElement('p');
  message.className = 'boot-error';
  message.textContent = translator(resolveLocale('auto', languages)).t('app.startFailed');
  root.replaceChildren(message);
}
