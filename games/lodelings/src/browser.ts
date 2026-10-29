import { browserServices as shellBrowserServices, type Services } from '@game1/shell';
import { GAME } from './catalog.js';
import type { StringKey, T } from './i18n/index.js';

/** The browser version: simulated ads and store that never charge, saves in localStorage. */
export function browserServices(t: T): Services {
  return shellBrowserServices(t, { ...GAME, productName: (id) => t(`shop.${id}` as StringKey) });
}
