import { PrivacyModal as ShellPrivacyModal, SettingsModal as ShellSettingsModal } from '@game1/shell/ui';
import { Button, Modal } from '@game1/ui';
import type { JSX } from 'preact';
import { SPOOL_PACKS, catalogItem, type SpoolPack } from '../catalog.js';
import { PRIVACY_POLICY } from '../privacy.js';
import { FABRIC_COSTS, FABRIC_SETS, FREE_SPOOLS } from '../sim/content.js';
import type { Mode } from '../sim/quilt.js';
import * as R from '../sim/rules.js';
import { FABRIC_LOOKS, fabricStyle } from './fabrics.js';
import { Icon, type IconName } from './Icon.js';
import { useView } from './view.js';

/** What a finished quilt paid, with the one chance to double it. */
export function ResultsModal(): JSX.Element | null {
  const { game, s, t, ui, fmt, day } = useView();
  const r = s.result;
  if (!r) return null;
  const home = () => {
    ui.go({ kind: 'home' });
    ui.open(null);
  };
  const daily = r.mode === 'daily';
  const free = R.hasEntitlement(s, 'remove_ads');
  return (
    <Modal title={t(daily ? 'result.dailyTitle' : 'result.title')} onClose={home} closeLabel={t('common.close')} testId="results">
      <div class="result">
        <p class="result__score" data-testid="result-score">
          {t('result.points', { score: fmt(r.score) })}
        </p>
        {r.newBest && (
          <p class="result__best" data-testid="new-best">
            <Icon name="star" size={18} /> {t('result.newBest')}
          </p>
        )}
        {daily && (
          <p class="g1-small g1-muted" data-testid="result-goal">
            {R.dailyDoneToday(s, day) ? t('play.targetDone') : t('result.goalMissed', { score: fmt(R.dailyTarget(day)) })}
          </p>
        )}
        <p class="result__spools" data-testid="result-spools">
          <Icon name="spool" size={22} /> {t('result.spools', { spools: fmt(r.doubled ? r.spools * 2 : r.spools) })}
          {r.doubled && <Icon name="check" size={18} />}
        </p>
        {game.adOffered('double_spools') && (
          <Button
            variant="ad"
            block
            testId="double"
            disabled={game.busy}
            onPress={() => {
              void game.watchAd('double_spools');
            }}
          >
            {!free && <Icon name="play" size={16} />} {t('result.double')}
          </Button>
        )}
      </div>
      <div class="g1-row">
        <Button variant="ghost" testId="result-home" onPress={home}>
          <Icon name="home" size={18} /> {t('result.home')}
        </Button>
        <Button
          testId="result-again"
          onPress={() => {
            ui.go({ kind: 'play', mode: r.mode });
            ui.open(null);
          }}
        >
          {t(daily ? 'result.retry' : 'result.again')}
        </Button>
      </div>
    </Modal>
  );
}

/** Starting over ends the quilt in progress, which pays like any finished quilt. */
export function ConfirmNewModal(props: { mode: Mode }): JSX.Element {
  const { game, t, ui } = useView();
  const close = () => {
    ui.open(null);
  };
  return (
    <Modal title={t('confirm.title')} onClose={close} closeLabel={t('common.close')} testId="confirm-new">
      <p class="g1-center">{t('confirm.body')}</p>
      <div class="g1-row">
        <Button variant="ghost" testId="confirm-no" onPress={close}>
          {t('common.cancel')}
        </Button>
        <Button
          testId="confirm-yes"
          onPress={() => {
            if (game.finish(props.mode)) ui.open({ kind: 'results' });
            else close();
          }}
        >
          {t('confirm.yes')}
        </Button>
      </div>
    </Modal>
  );
}

export function FabricsModal(): JSX.Element {
  const { game, s, t, ui, fmt, fabrics } = useView();
  return (
    <Modal
      title={t('fabrics.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="fabrics-modal"
    >
      <p class="g1-small g1-muted g1-center">{t('fabrics.note')}</p>
      <ul class="fabric-list">
        {FABRIC_SETS.map((id) => {
          const cost = FABRIC_COSTS[id];
          return (
            <li key={id} class={`fabric${id === fabrics ? ' fabric--in-use' : ''}`} data-testid={`fabric-${id}`}>
              <span class="swatches" aria-hidden="true">
                {FABRIC_LOOKS[id].map((look, i) => (
                  <span key={i} class="swatches__sq" style={fabricStyle(look)} />
                ))}
              </span>
              <strong class="fabric__name">{t(`fabric.${id}`)}</strong>
              {id === fabrics ? (
                <span class="owned">
                  <Icon name="check" size={16} /> {t('fabrics.inUse')}
                </span>
              ) : R.ownsFabric(s, id) ? (
                <Button
                  small
                  variant="ghost"
                  testId={`use-${id}`}
                  onPress={() => {
                    game.chooseFabric(id);
                  }}
                >
                  {t('fabrics.use')}
                </Button>
              ) : (
                <Button
                  small
                  testId={`buy-fabric-${id}`}
                  disabled={s.spools < cost}
                  onPress={() => {
                    game.buyFabric(id);
                  }}
                >
                  <Icon name="spool" size={14} /> {fmt(cost)}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {game.sells && !R.hasEntitlement(s, 'fabric_chest') && (
        <div class="fabric-chest">
          <Icon name="chest" size={28} />
          <span class="g1-small g1-muted">{t('fabrics.chest')}</span>
          <Button
            small
            variant="ghost"
            testId="fabrics-shop"
            onPress={() => {
              ui.open({ kind: 'shop' });
            }}
          >
            {t('shop.title')}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function priceOf(id: string, products: ReadonlyMap<string, { price: string | null }>): string | null {
  return products.get(id)?.price ?? null;
}

function PackCard(props: { id: SpoolPack }): JSX.Element {
  const { game, t, fmt } = useView();
  const price = priceOf(props.id, game.products);
  const spools = catalogItem(props.id)?.grants?.spools ?? 0;
  return (
    <button
      type="button"
      class={`pack pack--${props.id}`}
      data-testid={`buy-${props.id}`}
      disabled={price === null || game.busy}
      onClick={() => {
        void game.purchase(props.id);
      }}
    >
      <Icon name="spool" size={34} />
      <span class="pack__amount">{t('shop.spools', { spools: fmt(spools) })}</span>
      <span class="pack__name g1-small">{t(`shop.${props.id}`)}</span>
      <span class="pack__price">{price ?? '…'}</span>
    </button>
  );
}

type OneTime = 'sewing_kit' | 'remove_ads' | 'fabric_chest';

const ONE_TIME_ICONS: Record<OneTime, IconName> = { sewing_kit: 'swatch', remove_ads: 'noads', fabric_chest: 'chest' };

function OfferRow(props: { id: OneTime; owned: boolean }): JSX.Element {
  const { game, t } = useView();
  const price = priceOf(props.id, game.products);
  return (
    <div class="offer" data-testid={`offer-${props.id}`}>
      <Icon name={ONE_TIME_ICONS[props.id]} size={32} />
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

export function ShopModal(): JSX.Element {
  const { game, s, t, ui, day } = useView();
  const free = R.hasEntitlement(s, 'remove_ads');
  const kit = R.hasEntitlement(s, 'sewing_kit');
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
      <div class="offer" data-testid="offer-free">
        <Icon name="spool" size={32} />
        <div class="offer__body">
          <strong>{t('shop.free')}</strong>
          <span class="g1-small g1-muted">{t('shop.free.desc', { spools: FREE_SPOOLS, left: R.adsLeft(s, 'free_spools', day) })}</span>
        </div>
        <Button
          small
          variant="ad"
          testId="watch-free"
          disabled={!game.adOffered('free_spools') || game.busy}
          onPress={() => {
            void game.watchAd('free_spools');
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
          <div class="packs" data-testid="spool-packs">
            {SPOOL_PACKS.map((id) => (
              <PackCard key={id} id={id} />
            ))}
          </div>
          {(kit || R.sewingKitOffered(s)) && <OfferRow id="sewing_kit" owned={kit} />}
          <OfferRow id="remove_ads" owned={free} />
          <OfferRow id="fabric_chest" owned={R.hasEntitlement(s, 'fabric_chest')} />
        </>
      )}
    </Modal>
  );
}

export function SettingsModal(): JSX.Element {
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

export function PrivacyModal(): JSX.Element {
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
