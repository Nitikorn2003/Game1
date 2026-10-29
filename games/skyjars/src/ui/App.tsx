import { Toasts, useSubscription, type ToastItem } from '@game1/ui';
import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { Game } from '../game.js';
import { resolveLocale, translator, type T } from '../i18n/index.js';
import { Home } from './Home.js';
import { Icon } from './Icon.js';
import { AtlasModal, LooksModal, PrivacyModal, ResultsModal, SettingsModal, ShopModal, ToolModal } from './modals.js';
import { Play } from './Play.js';
import { SkyBackdrop } from './Sky.js';
import { ViewContext, makeView, type ModalState, type Screen, type Ui } from './view.js';

export interface AppProps {
  game: Game;
  persistent: boolean;
  version: string;
  languages: readonly string[];
}

export function App(props: AppProps): JSX.Element {
  const { game } = props;
  useSubscription(game.subscribe);
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const locale = resolveLocale(game.state.settings.locale, props.languages);
  const t = useMemo<T>(() => {
    const tr = translator(locale);
    return (key, params) => tr.t(key, params);
  }, [locale]);

  const open = useCallback(
    (next: ModalState | null) => {
      setModal((current) => {
        // Closing a solved shelf's results is a natural pause in play.
        if (next === null && current?.kind === 'results') void game.naturalBreak();
        return next;
      });
    },
    [game],
  );
  const go = useCallback(
    (next: Screen) => {
      // Going to a shelf opens it: the one in progress, or a new one. Today's solved daily sky has none.
      if (next.kind === 'play' && !game.open(next.mode)) return;
      setScreen(next);
    },
    [game],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const ui: Ui = { screen, go, open, persistent: props.persistent, version: props.version };
  const view = makeView(game, ui, t, locale);

  useEffect(
    () =>
      game.events.on('toast', (toast) => {
        const content = (
          <>
            {toast.icon && <Icon name={toast.icon} size={22} />}
            <span>{view.tp(toast.key, toast.params)}</span>
          </>
        );
        setToasts((list) => [...list.slice(-2), { id: toast.id, content }]);
        setTimeout(() => {
          setToasts((list) => list.filter((item) => item.id !== toast.id));
        }, 3200);
      }),
    // The toast text is fixed when it appears, in the language of that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, locale],
  );

  return (
    <ViewContext.Provider value={view}>
      <div class="app g1-root" data-locale={locale} data-sky={view.sky}>
        <SkyBackdrop sky={view.sky} />
        {screen.kind === 'play' ? <Play key={screen.mode} mode={screen.mode} /> : <Home />}
        {modal && <ModalHost modal={modal} />}
        <Toasts items={toasts} />
      </div>
    </ViewContext.Provider>
  );
}

function ModalHost(props: { modal: ModalState }): JSX.Element | null {
  const m = props.modal;
  switch (m.kind) {
    case 'shop':
      return <ShopModal />;
    case 'settings':
      return <SettingsModal />;
    case 'privacy':
      return <PrivacyModal />;
    case 'atlas':
      return <AtlasModal />;
    case 'looks':
      return <LooksModal />;
    case 'results':
      return <ResultsModal />;
    case 'tool':
      return <ToolModal mode={m.mode} tool={m.tool} />;
  }
}
