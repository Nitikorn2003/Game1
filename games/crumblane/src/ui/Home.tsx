import { Button, ProgressBar } from '@game1/ui';
import type { JSX } from 'preact';
import { LANE_LEVELS, LEVELS_PER_ZONE, ZONES, levelsOf, zoneOf, type ZoneId } from '../sim/levels.js';
import { tilesLeft } from '../sim/round.js';
import * as R from '../sim/rules.js';
import { HazelArt, ShopArt } from './art.js';
import { Icon } from './Icon.js';
import { CoinCount } from './Play.js';
import { useView } from './view.js';

export function Home(): JSX.Element {
  const { s, t, ui } = useView();
  const next = R.nextLevel(s);
  const current = zoneOf(Math.min(next, LANE_LEVELS));
  return (
    <div class="home" data-testid="home">
      <header class="topbar">
        <h1 class="brand">
          <Icon name="lane" size={30} />
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
        <Lane />
        <h2 class="home__heading">
          <span>{t('home.shops')}</span>
          <span class="home__stars" data-testid="total-stars" aria-label={t('home.stars', { n: R.totalStars(s), of: LANE_LEVELS * 3 })}>
            <Icon name="star" size={18} /> {Math.min(R.totalStars(s), LANE_LEVELS * 3)}/{LANE_LEVELS * 3}
          </span>
        </h2>
        <ul class="zones">
          {ZONES.map((zone) => (
            <ZoneCard key={zone} zone={zone} open={zone === current} />
          ))}
        </ul>
        {next > LANE_LEVELS && (
          <p class="home__late g1-small" data-testid="late-note">
            <Icon name="late" size={20} /> {t('home.late')}
          </p>
        )}
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

/** Goes to the counter for a level: the round in progress there, or a new try. */
export function useRound(): { level: (n: number) => void; daily: () => void } {
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

/** The round in progress, to go on with; or the next level to clear. */
function NextCard(): JSX.Element {
  const { s, t } = useView();
  const round = useRound();
  const c = s.current;
  const going = c && c.mode === 'lane' ? c : null;
  const n = going ? going.level : R.nextLevel(s);
  const zone = zoneOf(n);
  const total = going ? going.round.kinds.length : 0;
  const left = going ? tilesLeft(going.round) : 0;
  return (
    <section class="card next-card" data-testid="next-card">
      <span class="next-card__badge" aria-hidden="true">
        <HazelArt size={74} />
      </span>
      <div class="next-card__body">
        <h2 data-testid="next-title">{going ? t('home.continue', { n }) : t('home.next', { n })}</h2>
        <p class="g1-small g1-muted" data-testid="next-where">
          {zone ? t(`zone.${zone}`) : t('zone.late')}
        </p>
        {going && <ProgressBar value={(total - left) / Math.max(1, total)} label={t('home.left', { n: left })} />}
        <div class="next-card__actions">
          <Button
            testId="play-next"
            onPress={() => {
              round.level(n);
            }}
          >
            <Icon name="play" size={16} /> {t('home.bake')}
          </Button>
        </div>
      </div>
    </section>
  );
}

function DailyCard(): JSX.Element {
  const { s, t, day, fmt } = useView();
  const round = useRound();
  const going = s.current?.mode === 'daily' && s.current.day === day;
  const done = R.dailyDoneToday(s, day);
  const streak = R.dailyStreak(s, day);
  return (
    <section class={`card mode mode--daily${done ? ' mode--done' : ''}`} data-testid="mode-daily">
      <span class="mode__badge" aria-hidden="true">
        <Icon name="daily" size={44} />
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
            <Button testId="play-daily" onPress={round.daily}>
              <Icon name="play" size={16} /> {going ? t('home.continueShort') : t('home.bake')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** The lane itself: a shopfront for each shop, open once every level of the shop is cleared. */
function Lane(): JSX.Element {
  const { s, t, ui } = useView();
  const opened = ZONES.filter((zone) => R.zoneDone(s, zone)).length;
  return (
    <section class="card lane" data-testid="lane" aria-label={`${t('home.lane')}: ${t('home.lane.count', { n: opened, of: ZONES.length })}`}>
      <div class="lane__head">
        <h2>{t('home.lane')}</h2>
        <span class="g1-small g1-muted">{t('home.lane.count', { n: opened, of: ZONES.length })}</span>
      </div>
      <ul class="lane__street">
        {ZONES.map((zone) => (
          <li key={zone}>
            <button
              type="button"
              class="lane__shop"
              data-testid={`lane-${zone}`}
              data-open={R.zoneDone(s, zone) ? 'true' : 'false'}
              aria-label={R.zoneDone(s, zone) ? t('home.zone.done', { name: t(`zone.${zone}`) }) : t(`zone.${zone}`)}
              onClick={() => {
                ui.open({ kind: 'zone', zone });
              }}
            >
              <ShopArt zone={zone} open={R.zoneDone(s, zone)} size={40} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A shop of the lane: its front, how much of it is cleared, and its levels when it is the shop being played. */
function ZoneCard(props: { zone: ZoneId; open: boolean }): JSX.Element {
  const { s, t, ui } = useView();
  const { zone } = props;
  const levels = levelsOf(zone);
  const cleared = levels.filter((n) => R.starsOf(s, n) > 0).length;
  const opened = R.zoneOpen(s, zone);
  const done = R.zoneDone(s, zone);
  return (
    <li class={`card zone zone--${zone}${opened ? '' : ' zone--locked'}${done ? ' zone--done' : ''}`} data-testid={`zone-${zone}`}>
      <button
        type="button"
        class="zone__head"
        data-testid={`zone-open-${zone}`}
        aria-label={opened ? t('home.zone.label', { name: t(`zone.${zone}`), n: cleared, of: LEVELS_PER_ZONE }) : t('home.zone.locked', { name: t(`zone.${zone}`) })}
        onClick={() => {
          ui.open({ kind: 'zone', zone });
        }}
      >
        <span class="zone__art">
          <ShopArt zone={zone} open={done || opened} size={50} />
          {!opened && (
            <span class="zone__lock">
              <Icon name="lock" size={16} />
            </span>
          )}
        </span>
        <span class="zone__text">
          <strong class="zone__name">{t(`zone.${zone}`)}</strong>
          <span class="g1-small g1-muted">
            {done ? t('home.zone.opened') : opened ? t('home.zone.count', { n: cleared, of: LEVELS_PER_ZONE }) : t('home.zone.opens', { n: levels[0] ?? 1 })}
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

/** The twelve levels of a shop: cleared ones with their stars, the next one to clear, and the rest still closed. */
export function LevelGrid(props: { zone: ZoneId; onPick?: () => void }): JSX.Element {
  const { s, t } = useView();
  const round = useRound();
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
                round.level(n);
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
