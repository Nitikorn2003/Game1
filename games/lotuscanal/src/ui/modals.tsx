import { PrivacyModal as ShellPrivacyModal, SettingsModal as ShellSettingsModal } from '@game1/shell/ui';
import { Button, Modal } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { COIN_PACKS, catalogItem, type CoinPack } from '../catalog.js';
import { PRIVACY_POLICY } from '../privacy.js';
import { CANAL_COINS, CANALS, CARD_BACKS, FREE_COINS, LOOK_COSTS, MORE_UNDOS, SCENES, STOPS_PER_CANAL, TOOL_COSTS, type LookId, type Mode, type Tool } from '../sim/content.js';
import * as R from '../sim/rules.js';
import { EXTRA_CARDS } from '../sim/table.js';
import { placeOf } from '../sim/trip.js';
import { Back, Face } from './Card.js';
import { CanalArt, Icon, type IconName } from './Icon.js';
import { TripLine } from './Scene.js';
import { useView } from './view.js';

/** What a finished deal paid, with the one chance to double it; or, for a lost deal, a new one. */
export function ResultsModal(): JSX.Element | null {
  const { game, s, t, ui, fmt } = useView();
  const r = s.result;
  if (!r) return null;
  const home = () => {
    ui.go({ kind: 'home' });
    ui.open(null);
  };
  const again = () => {
    ui.open(null);
    ui.go({ kind: 'play', mode: r.mode });
  };
  const daily = r.mode === 'daily';
  const free = R.hasEntitlement(s, 'remove_ads');
  if (!r.won)
    return (
      <Modal title={t('result.lost')} onClose={home} closeLabel={t('common.close')} testId="results">
        <div class="result">
          <p data-testid="result-cleared">{t('result.cleared', { cleared: r.cleared, cards: r.cards })}</p>
          <p class="g1-small g1-muted">{t('result.lostNote')}</p>
        </div>
        <div class="g1-row">
          <Button variant="ghost" testId="result-home" onPress={home}>
            <Icon name="home" size={18} /> {t('result.home')}
          </Button>
          <Button testId="result-again" onPress={again}>
            {t('result.again')}
          </Button>
        </div>
      </Modal>
    );
  // The level after this one: where the boat goes next.
  const next = daily ? null : placeOf(r.level + 1);
  return (
    <Modal title={daily ? t('result.daily') : t('result.level', { level: r.level })} onClose={home} closeLabel={t('common.close')} testId="results">
      <div class="result">
        {r.canal ? (
          <div class="postcard postcard--new" data-testid="result-canal">
            <CanalArt id={r.canal} size={56} />
            <strong>{t('result.canal', { name: t(`canal.${r.canal}`), coins: r.bonus })}</strong>
            <span class="g1-small postcard__lore">{t(`lore.${r.canal}`)}</span>
          </div>
        ) : (
          next && (
            <div class="result__trip">
              <TripLine stop={next.stop} />
              <p class="g1-small" data-testid="result-next-stop">
                {t('result.nextStop', { name: t(`canal.${next.canal}`), stop: next.stop + 1, stops: STOPS_PER_CANAL })}
              </p>
            </div>
          )
        )}
        <p class="g1-small g1-muted" data-testid="result-run">
          {t('result.run', { n: r.bestStreak })}
        </p>
        {r.clean && (
          <p class="result__clean" data-testid="result-clean">
            <Icon name="wild" size={18} /> {t('result.clean')}
          </p>
        )}
        <dl class="tally" data-testid="result-tally">
          <div>
            <dt>{t('result.pot')}</dt>
            <dd>+{fmt(r.pot)}</dd>
          </div>
          {r.pay > 0 && (
            <div>
              <dt>{daily ? t('result.dailyPay') : t('result.pay')}</dt>
              <dd>+{fmt(r.pay)}</dd>
            </div>
          )}
          {r.spare > 0 && (
            <div>
              <dt>{r.spare === 1 ? t('result.spareOne') : t('result.spare', { n: r.spare })}</dt>
              <dd>+{fmt(r.spareCoins)}</dd>
            </div>
          )}
        </dl>
        <p class="result__coins" data-testid="result-coins">
          <Icon name="coin" size={26} /> {t('result.coins', { coins: fmt(r.doubled ? r.coins * 2 : r.coins) })}
          {r.doubled && <Icon name="check" size={18} />}
        </p>
        {game.adOffered('double_coins') && (
          <Button
            variant="ad"
            block
            testId="double"
            disabled={game.busy}
            onPress={() => {
              void game.watchAd('double_coins');
            }}
          >
            {!free && <Icon name="play" size={16} />} {t('result.double')}
          </Button>
        )}
        {daily &&
          (r.pay > 0 ? (
            <p class="g1-small" data-testid="result-streak">
              <Icon name="sun" size={16} /> {t('result.streak', { days: r.streak })}
            </p>
          ) : (
            <p class="g1-small g1-muted">{t('result.dailyAgain')}</p>
          ))}
      </div>
      <div class="g1-row">
        <Button variant="ghost" testId="result-home" onPress={home}>
          <Icon name="home" size={18} /> {t('result.home')}
        </Button>
        {!daily && (
          <Button
            testId="result-next"
            onPress={() => {
              ui.open(null);
              ui.go({ kind: 'play', mode: 'level' });
            }}
          >
            {t('result.next')}
          </Button>
        )}
      </div>
    </Modal>
  );
}

/** Help with a hard deal: for a rewarded ad, or for coins. */
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
      title={t(`tool.${tool}`, { n: EXTRA_CARDS })}
      onClose={() => {
        close(null);
      }}
      closeLabel={t('common.close')}
      testId="tool-sheet"
    >
      <p class="g1-center">{t(`sheet.${tool}.desc`, { n: tool === 'moreUndos' ? MORE_UNDOS : EXTRA_CARDS })}</p>
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
          disabled={s.coins < cost || game.busy}
          onPress={() => {
            game.buyTool(mode, tool);
          }}
        >
          <Icon name="coin" size={18} /> {t('sheet.spend', { coins: fmt(cost) })}
        </Button>
        {s.coins < cost && <p class="g1-small g1-muted g1-center">{t('sheet.short', { coins: fmt(s.coins) })}</p>}
      </div>
    </Modal>
  );
}

/** The canals of the trip, each a postcard once the boat has been all the way along it. */
export function MapModal(): JSX.Element {
  const { s, t, ui } = useView();
  const here = placeOf(s.level);
  const passed = s.level - 1;
  return (
    <Modal
      title={t('map.title')}
      onClose={() => {
        ui.open(null);
      }}
      closeLabel={t('common.close')}
      testId="map"
    >
      <p class="g1-small g1-muted g1-center">{t('map.note', { coins: CANAL_COINS })}</p>
      <ul class="postcards">
        {CANALS.map((id, i) => {
          const done = passed >= (i + 1) * STOPS_PER_CANAL;
          const current = here?.index === i;
          return (
            <li key={id} class={`postcard${done ? ' postcard--done' : ''}${current ? ' postcard--here' : ''}${!done && !current ? ' postcard--ahead' : ''}`} data-testid={`canal-${id}`}>
              <CanalArt id={id} size={44} />
              <strong class="postcard__name">{t(`canal.${id}`)}</strong>
              {done ? (
                <span class="g1-small postcard__lore">{t(`lore.${id}`)}</span>
              ) : current ? (
                <>
                  <TripLine stop={here.stop} class="trip--small" />
                  <span class="g1-small">{t('home.trip.stop', { stop: here.stop + 1, stops: STOPS_PER_CANAL })}</span>
                </>
              ) : (
                <span class="g1-small g1-muted">{t('map.ahead')}</span>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/** A small picture of a look: a card in its backs, or a patch of its water. */
function LookPreview(props: { id: LookId }): JSX.Element {
  if (R.isCardBack(props.id))
    return (
      <span class="look__preview look__card" aria-hidden="true">
        <Back look={props.id} />
      </span>
    );
  return (
    <span class={`look__preview look__scene backdrop--${props.id}`} aria-hidden="true">
      <span class="look__face">
        <Face card={0} />
      </span>
    </span>
  );
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
          disabled={s.coins < cost}
          onPress={() => {
            game.buyLook(id);
          }}
        >
          <Icon name="coin" size={14} /> {fmt(cost)}
        </Button>
      )}
    </li>
  );
}

export function LooksModal(): JSX.Element {
  const { game, s, t, ui, back, scene } = useView();
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
      <h3 class="looks__heading">{t('looks.backs')}</h3>
      <ul class="looks">
        {CARD_BACKS.map((id) => (
          <LookRow key={id} id={id} inUse={id === back} />
        ))}
      </ul>
      <h3 class="looks__heading">{t('looks.scenes')}</h3>
      <ul class="looks">
        {SCENES.map((id) => (
          <LookRow key={id} id={id} inUse={id === scene} />
        ))}
      </ul>
      {game.sells && R.collectionOffered(s) && (
        <div class="looks__collection">
          <Icon name="postcard" size={28} />
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

function PackCard(props: { id: CoinPack }): JSX.Element {
  const { game, t, fmt } = useView();
  const price = priceOf(props.id, game.products);
  const coins = catalogItem(props.id)?.grants?.coins ?? 0;
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
      <Icon name="coin" size={34} />
      <span class="pack__amount">{t('shop.coins', { coins: fmt(coins) })}</span>
      <span class="pack__name g1-small">{t(`shop.${props.id}`)}</span>
      <span class="pack__price">{price ?? '…'}</span>
    </button>
  );
}

type OneTime = 'market_kit' | 'remove_ads' | 'canal_collection';

const ONE_TIME_ICONS: Record<OneTime, IconName> = { market_kit: 'basket', remove_ads: 'noads', canal_collection: 'postcard' };

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
  const kit = R.hasEntitlement(s, 'market_kit');
  const collection = R.hasEntitlement(s, 'canal_collection');
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
        <Icon name="coin" size={32} />
        <div class="offer__body">
          <strong>{t('shop.free')}</strong>
          <span class="g1-small g1-muted">{t('shop.free.desc', { coins: FREE_COINS, left: R.adsLeft(s, 'free_coins', day) })}</span>
        </div>
        <Button
          small
          variant="ad"
          testId="watch-free"
          disabled={!game.adOffered('free_coins') || game.busy}
          onPress={() => {
            void game.watchAd('free_coins');
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
          <div class="packs" data-testid="coin-packs">
            {COIN_PACKS.map((id) => (
              <PackCard key={id} id={id} />
            ))}
          </div>
          {(kit || R.marketKitOffered(s)) && <OfferRow id="market_kit" owned={kit} />}
          <OfferRow id="remove_ads" owned={free} />
          {(collection || R.collectionOffered(s)) && <OfferRow id="canal_collection" owned={collection} />}
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
