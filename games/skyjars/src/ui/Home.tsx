import { Button } from '@game1/ui';
import type { JSX } from 'preact';
import { CONSTELLATIONS, DAILY_STARDUST } from '../sim/content.js';
import * as R from '../sim/rules.js';
import { TOTAL_STARS, current, starsLit } from '../sim/sky.js';
import { Icon } from './Icon.js';
import { JarArt } from './Jar.js';
import { StardustCount } from './Play.js';
import { Figure } from './Sky.js';
import { useView } from './view.js';

export function Home(): JSX.Element {
  const { t, ui } = useView();
  return (
    <div class="home" data-testid="home">
      <header class="topbar">
        <h1 class="brand">
          <Icon name="stardust" size={26} />
          <span>{t('app.title')}</span>
        </h1>
        <StardustCount />
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
        <AtlasCard />
        <LevelCard />
        <DailyCard />
        <div class="home__row">
          <Button
            variant="ghost"
            testId="open-atlas"
            onPress={() => {
              ui.open({ kind: 'atlas' });
            }}
          >
            <Icon name="atlas" size={20} /> {t('home.atlas')}
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

/** The constellation being lit, star by star, one for every level. */
function AtlasCard(): JSX.Element {
  const { s, t, ui } = useView();
  const solved = s.level - 1;
  const place = current(solved);
  const last = CONSTELLATIONS[CONSTELLATIONS.length - 1] ?? CONSTELLATIONS[0];
  const c = place ? (CONSTELLATIONS[place.index] ?? last) : last;
  const lit = place ? place.star : c.stars;
  return (
    <button
      type="button"
      class="card atlas-card"
      data-testid="atlas-card"
      onClick={() => {
        ui.open({ kind: 'atlas' });
      }}
    >
      <Figure id={c.id} lit={lit} size={116} />
      <span class="atlas-card__body">
        <strong class="atlas-card__name">{t(`constellation.${c.id}`)}</strong>
        <span class="g1-small" data-testid="atlas-progress">
          {place ? t('home.atlas.next', { lit, stars: c.stars }) : t('home.atlas.full')}
        </span>
        <span class="g1-small g1-muted">{t('home.atlas.lit', { lit: starsLit(solved), total: TOTAL_STARS })}</span>
      </span>
    </button>
  );
}

/** Three small jars, sorted and not quite, to show what the game is about. */
function JarTrio(props: { daily?: boolean }): JSX.Element {
  const { jarStyle } = useView();
  const sets = props.daily
    ? [
        [5, 6, 5],
        [6, 5, 6, 6],
        [5, 5],
      ]
    : [
        [0, 3, 0],
        [3, 3, 0, 3],
        [0, 2],
      ];
  return (
    <span class="trio" aria-hidden="true">
      {sets.map((units, i) => (
        <JarArt key={i} units={units} capacity={4} look={jarStyle} />
      ))}
    </span>
  );
}

function LevelCard(): JSX.Element {
  const { s, t, ui } = useView();
  const shelf = s.shelves.level;
  const started = shelf !== null && shelf.history.length > 0;
  return (
    <section class="card mode" data-testid="mode-level">
      <JarTrio />
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
  const shelf = s.shelves.daily;
  const started = shelf !== null && shelf.day === day && shelf.history.length > 0;
  const done = R.dailyDoneToday(s, day);
  const streak = R.dailyStreak(s, day);
  return (
    <section class={`card mode mode--daily${done ? ' mode--done' : ''}`} data-testid="mode-daily">
      <JarTrio daily />
      <div class="mode__body">
        <h2>
          <Icon name="moon" size={20} /> {t('home.daily')} {done && <Icon name="check" size={18} />}
        </h2>
        <p class="g1-small g1-muted" data-testid="daily-status">
          {done ? t('home.daily.done') : t('home.daily.desc', { stardust: DAILY_STARDUST })}
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
