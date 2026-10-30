import { Button, ProgressBar } from '@game1/ui';
import type { JSX } from 'preact';
import { DAILY_SEEDS } from '../sim/content.js';
import { ALBUM_IDS, albumOf, isPictureId, pictureOf, picturesOf, puzzleOf } from '../sim/fields.js';
import * as R from '../sim/rules.js';
import { MiniField } from './Field.js';
import { AlbumArt, Icon } from './Icon.js';
import { SeedCount } from './Play.js';
import { useView } from './view.js';

export function Home(): JSX.Element {
  const { t, ui } = useView();
  return (
    <div class="home" data-testid="home">
      <header class="topbar">
        <h1 class="brand">
          <Icon name="sprout" size={30} />
          <span>{t('app.title')}</span>
        </h1>
        <SeedCount />
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
        <h2 class="home__heading">{t('home.albums')}</h2>
        <ul class="albums">
          {ALBUM_IDS.map((id) => (
            <AlbumCard key={id} id={id} />
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

/** The album field played last, to go on with; or the next picture to start. */
function NextCard(): JSX.Element {
  const { s, t, ui, fmt } = useView();
  const last = R.lastField(s);
  const next = last && isPictureId(last.id) ? last.id : R.nextPicture(s);
  if (!next)
    return (
      <section class="card next-card" data-testid="next-card">
        <Icon name="star" size={40} />
        <div class="next-card__body">
          <h2>{t('home.allGrown')}</h2>
          <p class="g1-small g1-muted">{t('home.allGrown.desc')}</p>
        </div>
      </section>
    );
  const puzzle = puzzleOf(pictureOf(next));
  const { width, height } = puzzle.shape;
  const album = albumOf(next);
  // A field opened but not yet planted is still a new one.
  const started = last && R.touched(last) ? last : null;
  return (
    <section class="card next-card" data-testid="next-card">
      <span class="next-card__field">
        {started ? (
          <MiniField field={started} puzzle={puzzle} size={64} />
        ) : (
          <span class="next-card__new" aria-hidden="true">
            ?
          </span>
        )}
      </span>
      <div class="next-card__body">
        <h2>{started ? t('home.continue') : t('home.next')}</h2>
        <p class="g1-small g1-muted" data-testid="next-where">
          {t('home.where', { album: t(`album.${album}`), width, height })}
        </p>
        {started && <ProgressBar value={R.progressOf(started)} label={t('home.progress', { n: fmt(Math.round(R.progressOf(started) * 100)) })} />}
        <div class="next-card__actions">
          <Button
            testId="play-next"
            onPress={() => {
              ui.go({ kind: 'play', key: next });
            }}
          >
            <Icon name="play" size={16} /> {t('home.play')}
          </Button>
        </div>
      </div>
    </section>
  );
}

function DailyCard(): JSX.Element {
  const { s, t, ui, day } = useView();
  const field = s.daily.field;
  const started = field !== null && field.id === day && R.touched(field);
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
          {done ? t('home.daily.done') : t('home.daily.desc', { seeds: DAILY_SEEDS })}
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
                ui.go({ kind: 'play', key: 'daily' });
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

function AlbumCard(props: { id: (typeof ALBUM_IDS)[number] }): JSX.Element {
  const { s, t, ui } = useView();
  const { id } = props;
  const open = R.albumOpen(s, id);
  const grown = R.grownIn(s, id);
  const pictures = picturesOf(id);
  const before = ALBUM_IDS[ALBUM_IDS.indexOf(id) - 1];
  return (
    <li>
      <button
        type="button"
        class={`card album-card${open ? '' : ' album-card--locked'}${R.albumDone(s, id) ? ' album-card--done' : ''}`}
        data-testid={`album-${id}`}
        aria-label={open ? t('home.album.label', { name: t(`album.${id}`), grown, total: pictures.length }) : t('home.album.locked', { name: t(`album.${id}`) })}
        onClick={() => {
          ui.open({ kind: 'album', album: id });
        }}
      >
        <span class="album-card__art">
          <AlbumArt id={id} size={44} />
          {!open && (
            <span class="album-card__lock">
              <Icon name="lock" size={18} />
            </span>
          )}
        </span>
        <strong class="album-card__name">{t(`album.${id}`)}</strong>
        {open ? (
          <span class="album-card__count g1-small">{t('home.album.count', { grown, total: pictures.length })}</span>
        ) : (
          <span class="album-card__count g1-small g1-muted">{before && t('home.album.opens', { n: R.neededToOpen(s, id), album: t(`album.${before}`) })}</span>
        )}
        <span class="album-card__dots" aria-hidden="true">
          {pictures.map((picture) => (
            <span key={picture} class={`dot${s.grown.includes(picture) ? ' dot--grown' : ''}`} />
          ))}
        </span>
      </button>
    </li>
  );
}
