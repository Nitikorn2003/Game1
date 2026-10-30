import { Toasts, useSubscription, type ToastItem } from '@game1/ui';
import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { Game } from '../game.js';
import { resolveLocale, translator, type T } from '../i18n/index.js';
import { ArtDefs } from './art.js';
import { Home } from './Home.js';
import { Icon } from './Icon.js';
import { LooksModal, PrivacyModal, ResultsModal, RulesModal, SettingsModal, ShopModal, StuckModal, ToolModal, ZoneModal } from './modals.js';
import { Play } from './Play.js';
import { Backdrop } from './Scene.js';
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
  // A round left in progress goes on where it was.
  const [screen, setScreen] = useState<Screen>(() => ({ kind: game.state.current ? 'play' : 'home' }));
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
        // Closing a round's results is a natural pause in play.
        if (next?.kind !== 'results' && current?.kind === 'results') void game.naturalBreak();
        return next;
      });
    },
    [game],
  );
  const go = useCallback((next: Screen) => {
    setScreen(next);
  }, []);

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
      <div class="app g1-root" data-locale={locale} data-tiles={view.tiles} data-season={view.season}>
        <ArtDefs />
        <Backdrop season={view.season} />
        {screen.kind === 'play' ? <Play /> : <Home />}
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
    case 'looks':
      return <LooksModal />;
    case 'rules':
      return <RulesModal />;
    case 'zone':
      return <ZoneModal zone={m.zone} />;
    case 'results':
      return <ResultsModal />;
    case 'stuck':
      return <StuckModal />;
    case 'tool':
      return <ToolModal tool={m.tool} />;
  }
}
