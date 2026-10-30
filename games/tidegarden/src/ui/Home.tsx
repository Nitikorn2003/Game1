import { Button, ProgressBar } from '@game1/ui';
import type { JSX } from 'preact';
import { LEVELS_PER_ZONE, REEF_LEVELS, ZONES, levelsOf, zoneOf, type ZoneId } from '../sim/levels.js';
import * as R from '../sim/rules.js';
import { CreatureArt } from './art.js';
import { Icon } from './Icon.js';
import { CoinCount } from './Play.js';
import { useView } from './view.js';

export function Home(): JSX.Element {
  const { s, t, ui } = useView();
  const next = R.nextLevel(s);
  const current = zoneOf(Math.min(next, REEF_LEVELS));
  return (
    <div class="home" data-testid="home">
      <header class="topbar">
        <h1 class="brand">
          <Icon name="turtle" size={30} />
          <span>{t('app.title')}</span>
        </h1>
        <CoinCount />
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
      <main class="home__body">
        <NextCard />
        <DailyCard />
        <h2 class="home__heading">
          <span>{t('home.reef')}</span>
          <span class="home__stars" data-testid="total-stars" aria-label={t('home.stars', { n: R.totalStars(s), of: REEF_LEVELS * 3 })}>
            <Icon name="star" size={18} /> {Math.min(R.totalStars(s), REEF_LEVELS * 3)}/{REEF_LEVELS * 3}
          </span>
        </h2>
        <ul class="zones">
          {ZONES.map((zone) => (
            <ZoneCard key={zone} zone={zone} open={zone === current} />
          ))}
        </ul>
        <div class="home__row">
          <Button
            variant="ghost"
            testId="open-looks"
            onPress={() => {
              ui.open({ kind: 'looks' });
            }}
          >
            <Icon name="looks" size={20} /> {t('home.looks')}
          </Button>
          <Button
            variant="ghost"
            testId="open-rules"
            onPress={() => {
              ui.open({ kind: 'rules' });
            }}
          >
            <Icon name="help" size={20} /> {t('home.rules')}
          </Button>
        </div>
      </main>
    </div>
  );
}

/** Goes to the board for a level: the dive in progress there, or a new try. */
export function useDive(): { level: (n: number) => void; daily: () => void } {
  const { game, ui } = useView();
  return {
    level: (n) => {
      if (game.startLevel(n)) ui.go({ kind: 'play' });
    },
    daily: () => {
      if (game.openDaily()) ui.go({ kind: 'play' });
    },
  };
}

/** The dive in progress, to go on with; or the next level to reach. */
function NextCard(): JSX.Element {
  const { s, t } = useView();
  const dive = useDive();
  const c = s.current;
  const going = c && c.mode === 'reef' ? c : null;
  const n = going ? going.level : R.nextLevel(s);
  const zone = zoneOf(n);
  return (
    <section class="card next-card" data-testid="next-card">
      <span class="next-card__badge" aria-hidden="true">
        {zone ? <CreatureArt zone={zone} size={60} home={true} /> : <Icon name="sea" size={48} />}
      </span>
      <div class="next-card__body">
        <h2 data-testid="next-title">{going ? t('home.continue', { n }) : t('home.next', { n })}</h2>
        <p class="g1-small g1-muted" data-testid="next-where">
          {zone ? t(`zone.${zone}`) : t('home.sea')}
        </p>
        {going && <ProgressBar value={going.dive.movesMade / Math.max(1, going.dive.movesMade + going.dive.movesLeft)} label={t('home.movesLeft', { n: going.dive.movesLeft })} />}
        <div class="next-card__actions">
          <Button
            testId="play-next"
            onPress={() => {
              dive.level(n);
            }}
          >
            <Icon name="play" size={16} /> {t('home.dive')}
          </Button>
        </div>
      </div>
    </section>
  );
}

function DailyCard(): JSX.Element {
  const { s, t, day, fmt } = useView();
  const dive = useDive();
  const going = s.current?.mode === 'daily' && s.current.day === day;
  const done = R.dailyDoneToday(s, day);
  const streak = R.dailyStreak(s, day);
  return (
    <section class={`card mode mode--daily${done ? ' mode--done' : ''}`} data-testid="mode-daily">
      <span class="mode__badge" aria-hidden="true">
        <Icon name="sun" size={44} />
      </span>
      <div class="mode__body">
        <h2>
          {t('home.daily')} {done && <Icon name="check" size={18} />}
        </h2>
        <p class="g1-small g1-muted" data-testid="daily-status">
          {done ? t('home.daily.done') : t('home.daily.desc', { coins: fmt(R.dailyPay(s, day)) })}
        </p>
        {streak > 0 && (
          <p class="mode__streak" data-testid="daily-streak">
            {t('home.daily.streak', { days: streak })}
          </p>
        )}
        {!done && (
          <div class="mode__actions">
            <Button testId="play-daily" onPress={dive.daily}>
              <Icon name="play" size={16} /> {going ? t('home.continueShort') : t('home.dive')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** A zone of the reef: its creature, how much of it is reached, and its levels when it is the zone being played. */
function ZoneCard(props: { zone: ZoneId; open: boolean }): JSX.Element {
  const { s, t, ui } = useView();
  const { zone } = props;
  const levels = levelsOf(zone);
  const reached = levels.filter((n) => R.starsOf(s, n) > 0).length;
  const opened = R.zoneOpen(s, zone);
  const home = R.zoneDone(s, zone);
  return (
    <li class={`card zone zone--${zone}${opened ? '' : ' zone--locked'}${home ? ' zone--home' : ''}`} data-testid={`zone-${zone}`}>
      <button
        type="button"
        class="zone__head"
        data-testid={`zone-open-${zone}`}
        aria-label={opened ? t('home.zone.label', { name: t(`zone.${zone}`), n: reached, of: LEVELS_PER_ZONE }) : t('home.zone.locked', { name: t(`zone.${zone}`) })}
        onClick={() => {
          ui.open({ kind: 'zone', zone });
        }}
      >
        <span class="zone__art">
          <CreatureArt zone={zone} size={48} home={home} />
          {!opened && (
            <span class="zone__lock">
              <Icon name="lock" size={16} />
            </span>
          )}
        </span>
        <span class="zone__text">
          <strong class="zone__name">{t(`zone.${zone}`)}</strong>
          <span class="g1-small g1-muted">
            {home ? t('home.zone.home', { creature: t(`creature.${zone}`) }) : opened ? t('home.zone.count', { n: reached, of: LEVELS_PER_ZONE }) : t('home.zone.opens', { n: levels[0] ?? 1 })}
          </span>
        </span>
        <span class="zone__stars g1-small">
          <Icon name="star" size={14} /> {R.zoneStars(s, zone)}/{LEVELS_PER_ZONE * 3}
        </span>
      </button>
      {props.open && opened && <LevelGrid zone={zone} />}
    </li>
  );
}

/** The twelve levels of a zone: reached ones with their stars, the next one to reach, and the rest still closed. */
export function LevelGrid(props: { zone: ZoneId; onPick?: () => void }): JSX.Element {
  const { s, t } = useView();
  const dive = useDive();
  const next = R.nextLevel(s);
  return (
    <ol class="levels">
      {levelsOf(props.zone).map((n) => {
        const stars = R.starsOf(s, n);
        const open = R.levelOpen(s, n);
        return (
          <li key={n}>
            <button
              type="button"
              class={`lvl${stars > 0 ? ' lvl--done' : ''}${n === next ? ' lvl--next' : ''}`}
              data-testid={`level-${String(n)}`}
              data-stars={stars}
              disabled={!open}
              aria-label={stars > 0 ? t('home.level.done', { n, stars }) : open ? t('home.level.next', { n }) : t('home.level.locked', { n })}
              onClick={() => {
                props.onPick?.();
                dive.level(n);
              }}
            >
              <span class="lvl__n">{open ? n : <Icon name="lock" size={14} />}</span>
              <span class="lvl__stars" aria-hidden="true">
                {[1, 2, 3].map((k) => (
                  <span key={k} class={`lvl__star${k <= stars ? ' lvl__star--on' : ''}`} />
                ))}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
