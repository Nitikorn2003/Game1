import type { Params, Translator } from '@game1/engine';
import { hotSwap } from '@game1/platform';
import { escapeGoesBack } from '@game1/ui';
import type { Lifecycle, Services } from './services.js';
import { resolveLocale, type Locale, type LocaleSetting } from './settings.js';

/** The device's languages, best first. */
export const deviceLanguages: readonly string[] =
  typeof navigator === 'undefined' ? [] : navigator.languages.length > 0 ? navigator.languages : [navigator.language];

export type Translate<K extends string> = (key: K, params?: Params) => string;

/** What starting needs from a game's session. */
export interface Bootable extends Lifecycle {
  readonly state: { settings: { locale: LocaleSetting } };
  exportSave(): string;
  importSave(text: string): Promise<boolean>;
  start(): void;
}

export interface BootOptions<G extends Bootable, K extends string> {
  /** The game's strings in a language. */
  translator: (locale: Locale) => Translator<K>;
  /** The browser or Android services; `t` translates in the player's language. */
  services: (t: Translate<K>) => Services;
  /** Loads the save (or starts a new game) without starting the clock. */
  load: (services: Services) => Promise<G>;
  /** Shows the game's screens. */
  show: (game: G, services: Services) => void;
}

/** Loads the save, shows the game and starts it. */
export async function boot<G extends Bootable, K extends string>(o: BootOptions<G, K>): Promise<G> {
  const swap = await hotSwap();
  let game: G | null = null;
  const t: Translate<K> = (key, params) => o.translator(resolveLocale(game?.state.settings.locale ?? 'auto', deviceLanguages)).t(key, params);
  const services = o.services(t);
  const loaded = await o.load(services);
  game = loaded;
  // Claude's artifact viewer hands over the save when it swaps in a newer version of the page.
  const carried = (swap.data as { save?: unknown } | undefined)?.save;
  if (typeof carried === 'string') await loaded.importSave(carried);
  swap.keep(() => ({ save: loaded.exportSave() }));
  services.attach(loaded);
  escapeGoesBack();
  o.show(loaded, services);
  loaded.start();
  return loaded;
}

/** Shows a message instead of the game when it could not start. */
export function bootFailed(root: HTMLElement, err: unknown, message: string): void {
  console.error(err);
  const p = document.createElement('p');
  p.className = 'boot-error';
  p.textContent = message;
  root.replaceChildren(p);
}
