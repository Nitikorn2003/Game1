import { Button } from '@game1/ui';
import type { JSX } from 'preact';
import { CANALS, DAILY_COINS, STOPS_PER_CANAL } from '../sim/content.js';
import * as R from '../sim/rules.js';
import { canalsDone, placeOf } from '../sim/trip.js';
import { Face } from './Card.js';
import { CanalArt, Icon } from './Icon.js';
import { CoinCount } from './Play.js';
import { TripLine } from './Scene.js';
import { useView } from './view.js';

export function Home(): JSX.Element {
  const { t, ui } = useView();
  return (
    <div class="home" data-testid="home">
      <header class="topbar">
        <h1 class="brand">
          <Icon name="wild" size={30} />
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
        <TripCard />
        <LevelCard />
        <DailyCard />
        <div class="home__row">
          <Button
            variant="ghost"
            testId="open-map"
            onPress={() => {
              ui.open({ kind: 'map' });
            }}
          >
            <Icon name="map" size={20} /> {t('home.map')}
          </Button>
          <Button
            variant="ghost"
            testId="open-looks"
            onPress={() => {
              ui.open({ kind: 'looks' });
            }}
          >
            <Icon name="looks" size={20} /> {t('home.looks')}
          </Button>
        </div>
      </main>
    </div>
  );
}

/** The canal the boat is on, with the stop the next level takes it to. */
function TripCard(): JSX.Element {
  const { s, t, ui } = useView();
  const place = placeOf(s.level);
  const done = canalsDone(s.level - 1);
  const last = CANALS[CANALS.length - 1] ?? CANALS[0];
  return (
    <button
      type="button"
      class="card trip-card"
      data-testid="trip-card"
      onClick={() => {
        ui.open({ kind: 'map' });
      }}
    >
      <span class="trip-card__head">
        <CanalArt id={place?.canal ?? last} size={38} />
        <span class="trip-card__body">
          <strong class="trip-card__name" data-testid="canal-name">
            {place ? t(`canal.${place.canal}`) : t('home.trip.open')}
          </strong>
          <span class="g1-small" data-testid="trip-progress">
            {place ? t('home.trip.stop', { stop: place.stop + 1, stops: STOPS_PER_CANAL }) : t('home.trip.openDesc')}
          </span>
        </span>
      </span>
      <TripLine stop={place ? place.stop : STOPS_PER_CANAL} />
      <span class="g1-small g1-muted">{t('home.trip.canals', { done, total: CANALS.length })}</span>
    </button>
  );
}

/** Three cards in a run, to show what the game is about. */
function Fan(): JSX.Element {
  return (
    <span class="fan" aria-hidden="true">
      {[18, 6, 33].map((card) => (
        <span key={card} class="fan__card">
          <Face card={card} />
        </span>
      ))}
    </span>
  );
}

function LevelCard(): JSX.Element {
  const { s, t, ui } = useView();
  const deal = s.deals.level;
  const started = deal !== null && deal.moves.length > 0;
  return (
    <section class="card mode" data-testid="mode-level">
      <Fan />
      <div class="mode__body">
        <h2 data-testid="level-name">{t('home.level', { level: s.level })}</h2>
        <p class="g1-small g1-muted">{t('home.level.desc')}</p>
        <div class="mode__actions">
          <Button
            testId="play-level"
            onPress={() => {
              ui.go({ kind: 'play', mode: 'level' });
            }}
          >
            <Icon name="play" size={16} /> {started ? t('home.continue') : t('home.play')}
          </Button>
        </div>
      </div>
    </section>
  );
}

function DailyCard(): JSX.Element {
  const { s, t, ui, day } = useView();
  const deal = s.deals.daily;
  const started = deal !== null && deal.day === day && deal.moves.length > 0;
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
          {done ? t('home.daily.done') : t('home.daily.desc', { coins: DAILY_COINS })}
        </p>
        {streak > 0 && (
          <p class="mode__streak" data-testid="daily-streak">
            {t('home.daily.streak', { days: streak })}
          </p>
        )}
        {!done && (
          <div class="mode__actions">
            <Button
              testId="play-daily"
              onPress={() => {
                ui.go({ kind: 'play', mode: 'daily' });
              }}
            >
              <Icon name="play" size={16} /> {started ? t('home.continue') : t('home.play')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
