import { PrivacyModal as ShellPrivacyModal, SettingsModal as ShellSettingsModal } from '@game1/shell/ui';
import { Button, Modal, Toasts, useSubscription, type ToastItem } from '@game1/ui';
import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { Game } from '../game.js';
import { resolveLocale, translator, type T } from '../i18n/index.js';
import { PRIVACY_POLICY } from '../privacy.js';
import * as R from '../sim/rules.js';
import { Icon } from './Icon.js';
import { ViewContext, makeView, useView, type ModalState, type Ui } from './view.js';

export interface AppProps {
  game: Game;
  persistent: boolean;
  version: string;
  languages: readonly string[];
}

export function App(props: AppProps): JSX.Element {
  const { game } = props;
  useSubscription(game.subscribe);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const locale = resolveLocale(game.state.settings.locale, props.languages);
  const t = useMemo<T>(() => {
    const tr = translator(locale);
    return (key, params) => tr.t(key, params);
  }, [locale]);
  const open = useCallback((next: ModalState | null) => {
    setModal(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const ui: Ui = { open, persistent: props.persistent, version: props.version };
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
      <div class="app g1-root" data-locale={locale}>
        <TopBar />
        <main class="play">
          <TapButton />
          <UpgradeCard />
        </main>
        {modal?.kind === 'shop' && <ShopModal />}
        {modal?.kind === 'settings' && <SettingsModal />}
        {modal?.kind === 'privacy' && <PrivacyModal />}
        <Toasts items={toasts} />
      </div>
    </ViewContext.Provider>
  );
}

function TopBar(): JSX.Element {
  const { s, t, fmt, ui } = useView();
  return (
    <header class="topbar">
      <div class="res" data-testid="coins" aria-label={t('res.coins')}>
        <Icon name="coin" size={22} />
        <span class="res__value">{fmt(s.coins)}</span>
      </div>
      <button
        type="button"
        class="iconbtn"
        aria-label={t('shop.title')}
        data-testid="open-shop"
        onClick={() => {
          ui.open({ kind: 'shop' });
        }}
      >
        <Icon name="shop" size={24} />
      </button>
      <button
        type="button"
        class="iconbtn"
        aria-label={t('settings.title')}
        data-testid="open-settings"
        onClick={() => {
          ui.open({ kind: 'settings' });
        }}
      >
        <Icon name="gear" size={24} />
      </button>
    </header>
  );
}

/** The big coin. It reacts as the finger lands, not when it lifts, so fast tapping feels right. */
function TapButton(): JSX.Element {
  const { game, s, t } = useView();
  return (
    <div class="tap-area">
      <button
        type="button"
        class="tap"
        aria-label={t('tap.label')}
        data-testid="tap"
        onPointerDown={(e) => {
          if (e.button > 0) return;
          e.preventDefault();
          game.tap();
        }}
        onClick={(e) => {
          // Pointer taps were handled on pointerdown; keyboard presses arrive here.
          if (e.detail === 0) game.tap();
        }}
      >
        <Icon name="coin" size={168} />
      </button>
      {s.stats.taps < 5 && (
        <p class="hint" data-testid="hint">
          {t('tap.hint')}
        </p>
      )}
    </div>
  );
}

function UpgradeCard(): JSX.Element {
  const { game, s, t, fmt } = useView();
  const cost = R.upgradeCost(s);
  return (
    <section class="card upgrade" data-testid="upgrade-card">
      <div class="upgrade__body">
        <h3>{t('upgrade.title')}</h3>
        <p class="g1-small g1-muted">{t('upgrade.desc', { coins: fmt(R.coinsPerTap(s)) })}</p>
      </div>
      <Button
        testId="upgrade"
        disabled={s.coins < cost}
        onPress={() => {
          // Right after an upgrade is a natural pause, the kind of moment an ad break may use.
          if (game.upgrade()) void game.naturalBreak();
        }}
      >
        {t('upgrade.buy')} <Icon name="coin" size={16} /> {fmt(cost)}
      </Button>
    </section>
  );
}

function ShopModal(): JSX.Element {
  const { game, s, t, fmt, day, ui } = useView();
  const free = R.hasEntitlement(s, 'remove_ads');
  return (
    <Modal
      title={t('shop.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="shop-modal"
    >
      {game.testMode && (
        <p class="g1-note" data-testid="test-note">
          {t('shop.testNote')}
        </p>
      )}
      {game.storeError && <p class="g1-note g1-note--bad">{t('shop.offline')}</p>}
      <div class="offer">
        <Icon name="coin" size={32} />
        <div class="offer__body">
          <strong>{t('shop.bonus')}</strong>
          <span class="g1-small g1-muted">{t('shop.bonus.desc', { coins: fmt(R.bonusCoins(s)), left: R.adsLeft(s, 'bonus', day) })}</span>
        </div>
        <Button
          small
          variant="ad"
          testId="watch-bonus"
          disabled={!game.adOffered('bonus') || game.busy}
          onPress={() => {
            void game.watchAd('bonus');
          }}
        >
          {free ? (
            t('shop.claim')
          ) : (
            <>
              <Icon name="play" size={16} /> {t('shop.watch')}
            </>
          )}
        </Button>
      </div>
      {game.sells && (
        <>
          <Product id="coins_small" owned={false} />
          <Product id="remove_ads" owned={free} />
        </>
      )}
    </Modal>
  );
}

function Product(props: { id: 'coins_small' | 'remove_ads'; owned: boolean }): JSX.Element {
  const { game, t } = useView();
  const price = game.products.get(props.id)?.price ?? null;
  return (
    <div class="offer" data-testid={`offer-${props.id}`}>
      <Icon name={props.id === 'remove_ads' ? 'noads' : 'coin'} size={32} />
      <div class="offer__body">
        <strong>{t(`shop.${props.id}`)}</strong>
        <span class="g1-small g1-muted">{t(`shop.${props.id}.desc`)}</span>
        {!props.owned && game.needsGoogleFor(props.id) && <span class="g1-small g1-muted">{t('shop.needsGoogle')}</span>}
      </div>
      {props.owned ? (
        <span class="owned">{t('shop.owned')}</span>
      ) : (
        <Button
          small
          testId={`buy-${props.id}`}
          disabled={price === null || game.busy}
          onPress={() => {
            void game.purchase(props.id);
          }}
        >
          {price ?? '…'}
        </Button>
      )}
    </div>
  );
}

function SettingsModal(): JSX.Element {
  const { game, t, ui, time, now } = useView();
  return (
    <ShellSettingsModal
      session={game}
      t={t}
      time={time}
      now={now}
      persistent={ui.persistent}
      version={ui.version}
      onClose={() => {
        ui.open(null);
      }}
      onPrivacy={() => {
        ui.open({ kind: 'privacy' });
      }}
    />
  );
}

function PrivacyModal(): JSX.Element {
  const { t, ui, locale } = useView();
  return (
    <ShellPrivacyModal
      t={t}
      policy={PRIVACY_POLICY[locale]}
      onClose={() => {
        ui.open({ kind: 'settings' });
      }}
    />
  );
}
