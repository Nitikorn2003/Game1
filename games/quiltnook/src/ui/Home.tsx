import { Button, ProgressBar } from '@game1/ui';
import type { JSX } from 'preact';
import { DAILY_SPOOLS } from '../sim/content.js';
import * as B from '../sim/board.js';
import type { Mode, Quilt } from '../sim/quilt.js';
import * as R from '../sim/rules.js';
import { fabricStyle, lookOf } from './fabrics.js';
import { Icon } from './Icon.js';
import { SpoolCount } from './Play.js';
import { useView } from './view.js';

export function Home(): JSX.Element {
  const { t, ui } = useView();
  return (
    <div class="home" data-testid="home">
      <header class="topbar">
        <h1 class="brand">
          <Icon name="swatch" size={26} />
          <span>{t('app.title')}</span>
        </h1>
        <SpoolCount />
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
        <EndlessCard />
        <DailyCard />
        <QuiltBook />
        <Button
          variant="ghost"
          block
          testId="open-fabrics"
          onPress={() => {
            ui.open({ kind: 'fabrics' });
          }}
        >
          <Icon name="swatch" size={20} /> {t('home.fabrics')}
        </Button>
      </main>
    </div>
  );
}

/** A quilt in progress drawn small, or an empty one. */
function MiniQuilt(props: { quilt: Quilt | null }): JSX.Element {
  const { fabrics } = useView();
  const board = props.quilt?.board ?? B.emptyBoard();
  return (
    <div class="mini" aria-hidden="true">
      {board.map((fabric, i) => (
        <span key={i} class={fabric === B.EMPTY ? 'mini__sq' : 'mini__sq mini__sq--sewn'} style={fabric === B.EMPTY ? undefined : fabricStyle(lookOf(fabrics, fabric))} />
      ))}
    </div>
  );
}

/** The quilt to show for a mode: today's daily quilt only. */
function current(quilt: Quilt | null, mode: Mode, day: string): Quilt | null {
  return quilt && (mode === 'endless' || quilt.day === day) ? quilt : null;
}

function EndlessCard(): JSX.Element {
  const { s, t, ui, fmt, day } = useView();
  const quilt = current(s.quilts.endless, 'endless', day);
  const started = quilt !== null && quilt.patches > 0;
  return (
    <section class="card mode" data-testid="mode-endless">
      <MiniQuilt quilt={quilt} />
      <div class="mode__body">
        <h2>{t('home.endless')}</h2>
        <p class="g1-small g1-muted">{t('home.endless.desc')}</p>
        {s.best > 0 && (
          <p class="mode__best" data-testid="best">
            <Icon name="star" size={16} /> {t('home.best', { score: fmt(s.best) })}
          </p>
        )}
        <div class="mode__actions">
          <Button
            testId="play-endless"
            onPress={() => {
              ui.go({ kind: 'play', mode: 'endless' });
            }}
          >
            <Icon name="play" size={16} /> {started ? t('home.continue') : t('home.start')}
          </Button>
          {started && (
            <Button
              small
              variant="ghost"
              testId="new-endless"
              onPress={() => {
                ui.open({ kind: 'confirmNew', mode: 'endless' });
              }}
            >
              {t('home.newQuilt')}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function DailyCard(): JSX.Element {
  const { s, t, ui, fmt, day } = useView();
  const quilt = current(s.quilts.daily, 'daily', day);
  const started = quilt !== null && quilt.patches > 0;
  const done = R.dailyDoneToday(s, day);
  const streak = R.dailyStreak(s, day);
  return (
    <section class={`card mode mode--daily${done ? ' mode--done' : ''}`} data-testid="mode-daily">
      <MiniQuilt quilt={quilt} />
      <div class="mode__body">
        <h2>
          {t('home.daily')} {done && <Icon name="check" size={18} />}
        </h2>
        <p class="g1-small g1-muted" data-testid="daily-status">
          {done ? t('home.daily.done') : t('home.daily.desc', { target: fmt(R.dailyTarget(day)), spools: DAILY_SPOOLS })}
        </p>
        {streak > 0 && (
          <p class="mode__best" data-testid="daily-streak">
            <Icon name="calendar" size={16} /> {t('home.daily.streak', { days: streak })}
          </p>
        )}
        <div class="mode__actions">
          <Button
            variant={done ? 'ghost' : 'primary'}
            testId="play-daily"
            onPress={() => {
              ui.go({ kind: 'play', mode: 'daily' });
            }}
          >
            <Icon name="play" size={16} /> {started ? t('home.continue') : t('home.start')}
          </Button>
        </div>
      </div>
    </section>
  );
}

function QuiltBook(): JSX.Element {
  const { game, s, t, fmt } = useView();
  return (
    <section class="card book" data-testid="book">
      <h2>
        <Icon name="book" size={20} /> {t('home.book')}
      </h2>
      <p class="g1-small g1-muted">{t('home.book.desc')}</p>
      <ul class="book__list">
        {s.commissions.map((c, i) => {
          const target = R.commissionTarget(c);
          const done = R.commissionDone(c);
          return (
            <li key={`${c.kind}-${i}`} class={`commission${done ? ' commission--done' : ''}`} data-testid={`commission-${i}`}>
              <div class="commission__body">
                <span class="commission__text">{t(`commission.${c.kind}`)}</span>
                <ProgressBar value={c.progress / target} label={t(`commission.${c.kind}`)} from="#e9a17f" to="#c45a3c" />
                <span class="g1-small g1-muted">{t('commission.progress', { progress: fmt(Math.min(c.progress, target)), target: fmt(target) })}</span>
              </div>
              {done ? (
                <Button
                  small
                  variant="good"
                  testId={`claim-${i}`}
                  onPress={() => {
                    game.claimCommission(i);
                  }}
                >
                  {t('commission.claim')} <Icon name="spool" size={14} /> {R.commissionReward(c)}
                </Button>
              ) : (
                <span class="commission__reward">
                  <Icon name="spool" size={14} /> {R.commissionReward(c)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
