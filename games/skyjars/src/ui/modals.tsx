import { PrivacyModal as ShellPrivacyModal, SettingsModal as ShellSettingsModal } from '@game1/shell/ui';
import { Button, Modal } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { STARDUST_PACKS, catalogItem, type StardustPack } from '../catalog.js';
import { PRIVACY_POLICY } from '../privacy.js';
import { CONSTELLATIONS, CONSTELLATION_STARDUST, FREE_STARDUST, JAR_STYLES, LOOK_COSTS, MORE_UNDOS, SKIES, TOOL_COSTS, type LookId, type Mode, type Tool } from '../sim/content.js';
import * as R from '../sim/rules.js';
import { FIRST_STARS, locate, starsLit } from '../sim/sky.js';
import { Icon, type IconName } from './Icon.js';
import { JarArt } from './Jar.js';
import { Figure } from './Sky.js';
import { useView } from './view.js';

/** What a solved shelf paid, with the one chance to double it. */
export function ResultsModal(): JSX.Element | null {
  const { game, s, t, ui, fmt } = useView();
  const r = s.result;
  if (!r) return null;
  const home = () => {
    ui.go({ kind: 'home' });
    ui.open(null);
  };
  const daily = r.mode === 'daily';
  const free = R.hasEntitlement(s, 'remove_ads');
  const place = r.star === null ? null : locate(r.star);
  const c = place ? CONSTELLATIONS[place.index] : undefined;
  const name = c ? t(`constellation.${c.id}`) : '';
  return (
    <Modal title={daily ? t('result.daily') : t('result.level', { level: r.level })} onClose={home} closeLabel={t('common.close')} testId="results">
      <div class="result">
        {c && place && <Figure id={c.id} lit={place.star + 1} flare={place.star} size={112} />}
        <p class="g1-small g1-muted" data-testid="result-pours">
          {r.pours === 1 ? t('result.pour') : t('result.pours', { pours: r.pours })}
        </p>
        {r.clean && (
          <p class="result__clean" data-testid="result-clean">
            <Icon name="star" size={16} /> {t('result.clean')}
          </p>
        )}
        <p class="result__stardust" data-testid="result-stardust">
          <Icon name="stardust" size={24} /> {t('result.stardust', { stardust: fmt(r.doubled ? r.stardust * 2 : r.stardust) })}
          {r.doubled && <Icon name="check" size={18} />}
        </p>
        {game.adOffered('double_stardust') && (
          <Button
            variant="ad"
            block
            testId="double"
            disabled={game.busy}
            onPress={() => {
              void game.watchAd('double_stardust');
            }}
          >
            {!free && <Icon name="play" size={16} />} {t('result.double')}
          </Button>
        )}
        {c &&
          (r.constellation ? (
            <p class="result__constellation" data-testid="result-constellation">
              <Icon name="star" size={18} /> {t('result.constellation', { name, stardust: r.bonus })}
            </p>
          ) : (
            <p class="g1-small" data-testid="result-star">
              {t('result.star', { name })}
            </p>
          ))}
        {daily &&
          (r.stardust > 0 ? (
            <p class="g1-small" data-testid="result-streak">
              <Icon name="moon" size={16} /> {t('result.streak', { days: r.streak })}
            </p>
          ) : (
            <p class="g1-small g1-muted">{t('result.dailyAgain')}</p>
          ))}
      </div>
      <div class="g1-row">
        <Button variant="ghost" testId="result-home" onPress={home}>
          <Icon name="home" size={18} /> {t('result.home')}
        </Button>
        <Button
          testId="result-next"
          onPress={() => {
            ui.open(null);
            ui.go({ kind: 'play', mode: 'level' });
          }}
        >
          {t('result.next')}
        </Button>
      </div>
    </Modal>
  );
}

/** Help with a hard shelf: for a rewarded ad, or for stardust. */
export function ToolModal(props: { mode: Mode; tool: Tool }): JSX.Element {
  const { game, s, t, ui, fmt, day } = useView();
  const { mode, tool } = props;
  const close = ui.open;
  const offered = game.toolOffered(mode, tool);
  // Once the tool is no longer of use, bought or not, the sheet goes.
  useEffect(() => {
    if (!offered) close(null);
  });
  const placement = R.TOOL_ADS[tool];
  const slot = R.slotOf(mode);
  const cost = TOOL_COSTS[tool];
  const free = R.hasEntitlement(s, 'remove_ads');
  return (
    <Modal
      title={t(`tool.${tool}`)}
      onClose={() => {
        close(null);
      }}
      closeLabel={t('common.close')}
      testId="tool-sheet"
    >
      <p class="g1-center">{t(`sheet.${tool}.desc`, { n: MORE_UNDOS })}</p>
      <div class="sheet">
        <Button
          variant="ad"
          block
          testId="tool-watch"
          disabled={!game.adOffered(placement, slot) || game.busy}
          onPress={() => {
            void game.watchAd(placement, slot);
          }}
        >
          {free ? (
            t('sheet.free')
          ) : (
            <>
              <Icon name="play" size={16} /> {t('sheet.watch')}
            </>
          )}
        </Button>
        {R.adsLeft(s, placement, day) <= 0 && <p class="g1-small g1-muted g1-center">{t('sheet.noAds')}</p>}
        <Button
          block
          variant="ghost"
          testId="tool-spend"
          disabled={s.stardust < cost || game.busy}
          onPress={() => {
            game.buyTool(mode, tool);
          }}
        >
          <Icon name="stardust" size={18} /> {t('sheet.spend', { stardust: fmt(cost) })}
        </Button>
        {s.stardust < cost && <p class="g1-small g1-muted g1-center">{t('sheet.short', { stardust: fmt(s.stardust) })}</p>}
      </div>
    </Modal>
  );
}

export function AtlasModal(): JSX.Element {
  const { s, t, ui } = useView();
  const lit = starsLit(s.level - 1);
  return (
    <Modal
      title={t('atlas.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="atlas"
    >
      <p class="g1-small g1-muted g1-center">{t('atlas.note', { stardust: CONSTELLATION_STARDUST })}</p>
      <ul class="atlas">
        {CONSTELLATIONS.map((c, i) => {
          const litHere = Math.max(0, Math.min(c.stars, lit - (FIRST_STARS[i] ?? 0)));
          const complete = litHere === c.stars;
          return (
            <li key={c.id} class={`atlas__item${complete ? ' atlas__item--complete' : ''}${litHere === 0 ? ' atlas__item--dark' : ''}`} data-testid={`constellation-${c.id}`}>
              <Figure id={c.id} lit={litHere} size={84} />
              <strong class="atlas__name">{t(`constellation.${c.id}`)}</strong>
              <span class="g1-small g1-muted">{complete ? t('atlas.complete') : litHere > 0 ? t('atlas.lit', { lit: litHere, stars: c.stars }) : t('atlas.locked')}</span>
              {complete && <span class="atlas__lore g1-small">{t(`lore.${c.id}`)}</span>}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/** A small picture of a look: a jar in its style, or a patch of its sky. */
function LookPreview(props: { id: LookId }): JSX.Element {
  if (R.isJarStyle(props.id))
    return (
      <span class="look__preview" aria-hidden="true">
        <JarArt units={[0, 5, 5, 2]} capacity={4} look={props.id} />
      </span>
    );
  return <span class={`look__preview look__sky backdrop--${props.id}`} aria-hidden="true" />;
}

function LookRow(props: { id: LookId; inUse: boolean }): JSX.Element {
  const { game, s, t, fmt } = useView();
  const { id } = props;
  const cost = LOOK_COSTS[id];
  return (
    <li class={`look${props.inUse ? ' look--in-use' : ''}`} data-testid={`look-${id}`}>
      <LookPreview id={id} />
      <strong class="look__name">{t(`look.${id}`)}</strong>
      {props.inUse ? (
        <span class="owned">
          <Icon name="check" size={16} /> {t('looks.inUse')}
        </span>
      ) : R.ownsLook(s, id) ? (
        <Button
          small
          variant="ghost"
          testId={`use-${id}`}
          onPress={() => {
            game.chooseLook(id);
          }}
        >
          {t('looks.use')}
        </Button>
      ) : (
        <Button
          small
          testId={`buy-look-${id}`}
          disabled={s.stardust < cost}
          onPress={() => {
            game.buyLook(id);
          }}
        >
          <Icon name="stardust" size={14} /> {fmt(cost)}
        </Button>
      )}
    </li>
  );
}

export function LooksModal(): JSX.Element {
  const { game, s, t, ui, jarStyle, sky } = useView();
  return (
    <Modal
      title={t('looks.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="looks"
    >
      <p class="g1-small g1-muted g1-center">{t('looks.note')}</p>
      <h3 class="looks__heading">{t('looks.jars')}</h3>
      <ul class="looks">
        {JAR_STYLES.map((id) => (
          <LookRow key={id} id={id} inUse={id === jarStyle} />
        ))}
      </ul>
      <h3 class="looks__heading">{t('looks.skies')}</h3>
      <ul class="looks">
        {SKIES.map((id) => (
          <LookRow key={id} id={id} inUse={id === sky} />
        ))}
      </ul>
      {game.sells && R.skyCollectionOffered(s) && (
        <div class="looks__collection">
          <Icon name="telescope" size={28} />
          <span class="g1-small g1-muted">{t('looks.collection')}</span>
          <Button
            small
            variant="ghost"
            testId="looks-shop"
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

function PackCard(props: { id: StardustPack }): JSX.Element {
  const { game, t, fmt } = useView();
  const price = priceOf(props.id, game.products);
  const stardust = catalogItem(props.id)?.grants?.stardust ?? 0;
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
      <Icon name="stardust" size={34} />
      <span class="pack__amount">{t('shop.stardust', { stardust: fmt(stardust) })}</span>
      <span class="pack__name g1-small">{t(`shop.${props.id}`)}</span>
      <span class="pack__price">{price ?? '…'}</span>
    </button>
  );
}

type OneTime = 'night_kit' | 'remove_ads' | 'sky_collection';

const ONE_TIME_ICONS: Record<OneTime, IconName> = { night_kit: 'lantern', remove_ads: 'noads', sky_collection: 'telescope' };

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
  const kit = R.hasEntitlement(s, 'night_kit');
  const collection = R.hasEntitlement(s, 'sky_collection');
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
        <Icon name="stardust" size={32} />
        <div class="offer__body">
          <strong>{t('shop.free')}</strong>
          <span class="g1-small g1-muted">{t('shop.free.desc', { stardust: FREE_STARDUST, left: R.adsLeft(s, 'free_stardust', day) })}</span>
        </div>
        <Button
          small
          variant="ad"
          testId="watch-free"
          disabled={!game.adOffered('free_stardust') || game.busy}
          onPress={() => {
            void game.watchAd('free_stardust');
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
          <div class="packs" data-testid="stardust-packs">
            {STARDUST_PACKS.map((id) => (
              <PackCard key={id} id={id} />
            ))}
          </div>
          {(kit || R.nightKitOffered(s)) && <OfferRow id="night_kit" owned={kit} />}
          <OfferRow id="remove_ads" owned={free} />
          {(collection || R.skyCollectionOffered(s)) && <OfferRow id="sky_collection" owned={collection} />}
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
