import { Button, ProgressBar } from '@game1/ui';
import type { JSX } from 'preact';
import { EggArt } from '../art/EggArt.js';
import { Icon } from '../art/Icon.js';
import * as C from '../sim/content.js';
import * as R from '../sim/rules.js';
import { useView } from './view.js';

function Incubator(props: { slot: number }): JSX.Element {
  const { game, s, t, now, time, ui } = useView();
  const slot = props.slot;
  const egg = s.incubators[slot];
  if (!egg) {
    return (
      <div class="card incubator incubator--empty" data-testid={`incubator-${slot}`}>
        <span class="incubator__nest" aria-hidden="true" />
        <span class="muted">{t('eggs.empty')}</span>
      </div>
    );
  }
  const ready = now >= egg.readyAt;
  const total = egg.readyAt - egg.startedAt;
  const progress = total > 0 ? (now - egg.startedAt) / total : 1;
  const gems = R.instantHatchGems(s, slot, now);
  return (
    <div class={`card incubator ${ready ? 'incubator--ready' : ''}`} data-testid={`incubator-${slot}`}>
      <EggArt kind={egg.kind} size={64} wobble={ready} />
      <span class="incubator__name">{t(`egg.${egg.kind}`)}</span>
      {ready ? (
        <Button
          small
          variant="good"
          testId={`hatch-${slot}`}
          onPress={() => {
            const result = game.hatch(slot);
            if (result) ui.open({ kind: 'hatch', result });
          }}
        >
          {t('eggs.hatch')}
        </Button>
      ) : (
        <>
          <ProgressBar value={progress} from="#7bd88f" to="#c2f59a" />
          <span class="incubator__time">{time((egg.readyAt - now) / 1000)}</span>
          <div class="row row--tight">
            <Button
              small
              variant="gem"
              testId={`finish-${slot}`}
              disabled={s.gems < gems}
              onPress={() => {
                game.finishEgg(slot);
              }}
            >
              <Icon name="gem" size={14} /> {t('eggs.finish', { gems })}
            </Button>
            {game.adOffered('egg_rush', slot) && (
              <Button
                small
                variant="ad"
                testId={`rush-${slot}`}
                disabled={game.busy}
                onPress={() => {
                  void game.watchAd('egg_rush', slot);
                }}
              >
                <Icon name="play" size={14} /> {t('eggs.rush')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EggOffer(props: { kind: 'pebble' | 'geode' | 'prism' }): JSX.Element {
  const { game, s, t, time } = useView();
  const def = C.EGGS[props.kind];
  const price = def.gemPrice ?? 0;
  const full = s.eggs.length >= C.EGG_STORAGE;
  return (
    <div class="card row-card" data-testid={`egg-offer-${props.kind}`}>
      <div class="row-card__art">
        <EggArt kind={props.kind} size={48} />
      </div>
      <div class="row-card__body">
        <div class="row-card__title">
          {t(`egg.${props.kind}`)} <span class="lv">{time(R.hatchSeconds(s, props.kind))}</span>
        </div>
        <div class="row-card__sub small">
          {t('eggs.odds', { common: def.odds.common, rare: def.odds.rare, epic: def.odds.epic, legendary: def.odds.legendary })}
        </div>
      </div>
      <Button
        small
        variant="gem"
        testId={`buy-egg-${props.kind}`}
        disabled={s.gems < price || full || game.busy}
        onPress={() => {
          game.buyEgg(props.kind);
        }}
      >
        <Icon name="gem" size={14} /> {price}
      </Button>
    </div>
  );
}

export function Eggs(): JSX.Element {
  const { game, s, t } = useView();
  const price = R.nextIncubatorPrice(s);
  return (
    <div class="list">
      <h3 class="section">{t('eggs.incubators')}</h3>
      <div class="incubators">
        {s.incubators.map((_, slot) => (
          <Incubator key={slot} slot={slot} />
        ))}
        {price !== null && (
          <button
            type="button"
            class="card incubator incubator--buy"
            data-testid="buy-incubator"
            disabled={s.gems < price}
            onClick={() => {
              game.buyIncubator();
            }}
          >
            <span class="plus" aria-hidden="true">
              +
            </span>
            <span>{t('eggs.buyIncubator')}</span>
            <span class="buy__cost">
              <Icon name="gem" size={14} />
              {price}
            </span>
          </button>
        )}
      </div>
      <h3 class="section">{t('eggs.basket', { count: s.eggs.length, max: C.EGG_STORAGE })}</h3>
      {s.eggs.length === 0 ? (
        <p class="muted">{t('eggs.basketEmpty')}</p>
      ) : (
        <div class="basket" data-testid="basket">
          {s.eggs.map((kind, i) => (
            <EggArt key={i} kind={kind} size={36} />
          ))}
        </div>
      )}
      <h3 class="section">{t('eggs.shop')}</h3>
      <EggOffer kind="pebble" />
      <EggOffer kind="geode" />
      <EggOffer kind="prism" />
    </div>
  );
}
