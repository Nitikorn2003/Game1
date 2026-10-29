import { Button } from '@game1/ui';
import type { JSX } from 'preact';
import { EggArt } from '../art/EggArt.js';
import { Icon, type IconName } from '../art/Icon.js';
import { GEM_PACKS, catalogItem, type GemPack, type Offer } from '../catalog.js';
import { GEM_CRATE_GEMS, SKILL_IDS, SKILL_RESET_GEMS, type AdPlacement } from '../sim/content.js';
import * as R from '../sim/rules.js';
import { useView } from './view.js';

function AdOffer(props: { placement: AdPlacement; icon: IconName; title: string; desc: string }): JSX.Element {
  const { game, s, t } = useView();
  const offered = game.adOffered(props.placement);
  const free = R.hasEntitlement(s, 'remove_ads');
  return (
    <div class="card row-card" data-testid={`ad-offer-${props.placement}`}>
      <div class="row-card__art row-card__art--icon">
        <Icon name={props.icon} size={32} />
      </div>
      <div class="row-card__body">
        <div class="row-card__title">{props.title}</div>
        <div class="row-card__sub small">{props.desc}</div>
      </div>
      <Button
        small
        variant="ad"
        testId={`watch-${props.placement}`}
        disabled={!offered || game.busy}
        onPress={() => {
          void game.watchAd(props.placement);
        }}
      >
        {free ? (
          t('daily.claim')
        ) : (
          <>
            <Icon name="play" size={16} /> {t('shop.watch')}
          </>
        )}
      </Button>
    </div>
  );
}

function priceOf(id: string, prices: ReadonlyMap<string, { price: string | null }>): string | null {
  return prices.get(id)?.price ?? null;
}

function OfferCard(props: { id: Offer; owned: boolean }): JSX.Element {
  const { game, t } = useView();
  const price = priceOf(props.id, game.products);
  const item = catalogItem(props.id);
  return (
    <div class={`card offer offer--${props.id}`} data-testid={`offer-${props.id}`}>
      <div class="offer__art">
        {props.id === 'starter_pack' && <EggArt kind="prism" size={54} />}
        {props.id === 'remove_ads' && <Icon name="mute" size={40} />}
        {props.id === 'ore_doubler' && <Icon name="ore" size={44} />}
      </div>
      <div class="offer__body">
        <div class="row-card__title">{t(`shop.${props.id}`)}</div>
        <div class="row-card__sub small">{t(`shop.${props.id}.desc`)}</div>
        {item?.grants?.gems !== undefined && (
          <div class="small">
            <Icon name="gem" size={14} /> {item.grants.gems}
          </div>
        )}
        {!props.owned && game.needsGoogleFor(props.id) && <div class="small muted">{t('shop.needsGoogle')}</div>}
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

function GemPackCard(props: { id: GemPack }): JSX.Element {
  const { game, t } = useView();
  const price = priceOf(props.id, game.products);
  const gems = catalogItem(props.id)?.grants?.gems ?? 0;
  return (
    <button
      type="button"
      class={`card gempack gempack--${props.id}`}
      data-testid={`buy-${props.id}`}
      disabled={price === null || game.busy}
      onClick={() => {
        void game.purchase(props.id);
      }}
    >
      <Icon name="gem" size={36} />
      <span class="gempack__amount">{t('shop.gemsAmount', { gems })}</span>
      <span class="gempack__name small">{t(`shop.${props.id}`)}</span>
      <span class="gempack__price">{price ?? '…'}</span>
    </button>
  );
}

export function Shop(): JSX.Element {
  const { game, s, t, day, now } = useView();
  const cooling = SKILL_IDS.some((id) => R.skillUnlocked(s, id) && now < s.skills[id].readyAt);
  return (
    <div class="list">
      {game.testMode && (
        <p class="note" data-testid="test-note">
          {t('shop.testNote')}
        </p>
      )}
      {game.storeError && <p class="note note--bad">{t('shop.offline')}</p>}
      <h3 class="section">{t('shop.free')}</h3>
      <AdOffer placement="gem_crate" icon="gem" title={t('shop.freeGems')} desc={t('shop.freeGems.desc', { gems: GEM_CRATE_GEMS, left: R.adsLeft(s, 'gem_crate', day) })} />
      <AdOffer placement="blessing" icon="star" title={t('shop.blessing')} desc={t('shop.blessing.desc')} />
      <h3 class="section">{t('shop.offers')}</h3>
      {!s.shop.starterBought && <OfferCard id="starter_pack" owned={false} />}
      <OfferCard id="remove_ads" owned={R.hasEntitlement(s, 'remove_ads')} />
      <OfferCard id="ore_doubler" owned={R.hasEntitlement(s, 'ore_doubler')} />
      <h3 class="section">{t('shop.gemsTitle')}</h3>
      <div class="gem-grid">
        {GEM_PACKS.map((id) => (
          <GemPackCard key={id} id={id} />
        ))}
      </div>
      <h3 class="section">{t('shop.gemShop')}</h3>
      <div class="card row-card">
        <div class="row-card__art row-card__art--icon">
          <Icon name="frenzy" size={32} />
        </div>
        <div class="row-card__body">
          <div class="row-card__title">{t('shop.refreshSkills')}</div>
        </div>
        <Button
          small
          variant="gem"
          testId="refresh-skills"
          disabled={!cooling || s.gems < SKILL_RESET_GEMS}
          onPress={() => {
            game.resetSkills();
          }}
        >
          <Icon name="gem" size={14} /> {SKILL_RESET_GEMS}
        </Button>
      </div>
    </div>
  );
}
