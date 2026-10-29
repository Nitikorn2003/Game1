import { browserScheduler, systemClock } from '@game1/engine';
import type { Services } from '@game1/shell';
import { boot as bootShell, bootFailed as showBootFailure, deviceLanguages } from '@game1/shell/ui';
import { render } from 'preact';
import { gameSound } from './audio.js';
import { Game } from './game.js';
import { resolveLocale, translator, type T } from './i18n/index.js';
import { App } from './ui/App.js';

/** Loads the save, shows the game and starts it. `t` translates in the player's language. */
export async function boot(root: HTMLElement, services: (t: T) => Services): Promise<void> {
  await bootShell({
    translator,
    services,
    load: (s) =>
      Game.load({
        clock: systemClock,
        scheduler: browserScheduler,
        storage: s.storage,
        ads: s.ads,
        store: s.store,
        haptics: s.haptics,
        sound: gameSound(),
        ...(s.account ? { account: s.account } : {}),
      }),
    show: (game, s) => {
      render(<App game={game} persistent={s.storage.persistent} version={__APP_VERSION__} languages={deviceLanguages} />, root);
    },
  });
}

/** Shows a translated message instead of the game when it could not start. */
export function bootFailed(root: HTMLElement, err: unknown): void {
  showBootFailure(root, err, translator(resolveLocale('auto', deviceLanguages)).t('app.startFailed'));
}
