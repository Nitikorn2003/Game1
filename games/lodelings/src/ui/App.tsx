import { Tabs, Toasts, useSubscription, type TabItem, type ToastItem } from '@game1/ui';
import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { Icon } from '../art/Icon.js';
import type { Game } from '../game.js';
import { resolveLocale, translator, type T } from '../i18n/index.js';
import { RELIC_IDS } from '../sim/content.js';
import * as R from '../sim/rules.js';
import type { GameState } from '../sim/state.js';
import { Eggs } from './Eggs.js';
import { Lodelings } from './Lodelings.js';
import { HatchModal, LodelingModal, OfflineModal, PrivacyModal, ResurfaceModal, RewardsModal, SettingsModal } from './modals.js';
import { Relics } from './Relics.js';
import { Scene } from './Scene.js';
import { Shop } from './Shop.js';
import { SkillBar } from './SkillBar.js';
import { TopBar } from './TopBar.js';
import { Upgrades } from './Upgrades.js';
import { ViewContext, makeView, type BuyAmount, type ModalState, type TabKey, type Ui } from './view.js';

export interface AppProps {
  game: Game;
  persistent: boolean;
  version: string;
  languages: readonly string[];
}

export function App(props: AppProps): JSX.Element {
  const { game } = props;
  useSubscription(game.subscribe);
  const [tab, setTab] = useState<TabKey>('upgrades');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [buyAmount, setBuyAmount] = useState<BuyAmount>(1);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const locale = resolveLocale(game.state.settings.locale, props.languages);
  const t = useMemo<T>(() => {
    const tr = translator(locale);
    return (key, params) => tr.t(key, params);
  }, [locale]);

  const open = useCallback(
    (next: ModalState | null) => {
      setModal((current) => {
        // Closing a result screen is a natural pause in play.
        if (next === null && current?.kind === 'hatch') void game.naturalBreak();
        return next;
      });
    },
    [game],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const ui: Ui = { open, tab, setTab, buyAmount, setBuyAmount, persistent: props.persistent, version: props.version };
  const view = makeView(game, ui, t, locale);
  const s = view.s;

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

  const readyEggs = s.incubators.filter((_, slot) => R.eggReady(s, slot, view.now)).length;
  const tabs: TabItem<TabKey>[] = [
    { key: 'upgrades', label: t('tab.upgrades'), icon: <Icon name="pick" size={24} /> },
    { key: 'lodelings', label: t('tab.lodelings'), icon: <Icon name="creatures" size={24} /> },
    { key: 'eggs', label: t('tab.eggs'), icon: <Icon name="egg" size={24} />, badge: readyEggs },
    { key: 'relics', label: t('tab.relics'), icon: <Icon name="relic" size={24} />, badge: relicsWorthALook(s) ? 1 : 0 },
    { key: 'shop', label: t('tab.shop'), icon: <Icon name="shop" size={24} />, badge: game.adOffered('gem_crate') ? 1 : 0 },
  ];

  return (
    <ViewContext.Provider value={view}>
      <div class="app g1-root" data-locale={locale}>
        <TopBar />
        <Scene />
        <SkillBar />
        <main class="panel" role="tabpanel" data-testid={`panel-${tab}`}>
          {tab === 'upgrades' && <Upgrades />}
          {tab === 'lodelings' && <Lodelings />}
          {tab === 'eggs' && <Eggs />}
          {tab === 'relics' && <Relics />}
          {tab === 'shop' && <Shop />}
        </main>
        <Tabs items={tabs} active={tab} onSelect={setTab} />
        {s.offline ? <OfflineModal /> : modal && <ModalHost modal={modal} />}
        <Toasts items={toasts} />
      </div>
    </ViewContext.Provider>
  );
}

/** Resurfacing now would pay well, or Relic Dust is waiting to be spent. */
function relicsWorthALook(s: GameState): boolean {
  const dust = R.resurfaceDust(s);
  return (dust > 0 && dust >= Math.max(5, s.lifetimeDust * 0.5)) || RELIC_IDS.some((id) => R.relicCost(s, id) <= s.dust);
}

function ModalHost(props: { modal: ModalState }): JSX.Element {
  const m = props.modal;
  switch (m.kind) {
    case 'hatch':
      return <HatchModal result={m.result} />;
    case 'rewards':
      return <RewardsModal tab={m.tab} />;
    case 'settings':
      return <SettingsModal />;
    case 'lodeling':
      return <LodelingModal id={m.id} />;
    case 'resurface':
      return <ResurfaceModal />;
    case 'privacy':
      return <PrivacyModal />;
  }
}
