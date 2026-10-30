import { Button, useBackHandler } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { TOOLS, type Tool } from '../sim/content.js';
import { zoneOf } from '../sim/levels.js';
import { MORE_ROOM, STAR_PEAKS, tilesLeft } from '../sim/round.js';
import * as R from '../sim/rules.js';
import { levelOf, type Current, type RoundResult } from '../sim/state.js';
import { Icon } from './Icon.js';
import { reducedMotion, useContentSize } from './layout.js';
import { Table } from './Table.js';
import { useView } from './view.js';

/** How long the table shows the counter cleared before the results. */
const FINALE_MS = 900;

export function Play(): JSX.Element | null {
  const { game, s, t, ui } = useView();
  const { go, open } = ui;
  const live = s.current;
  // The round the screen shows: the state lets go of a round the moment its counter is cleared.
  const [kept, setKept] = useState<Current | null>(live);
  const [ended, setEnded] = useState<RoundResult | null>(null);
  // A new round, after the results of the last one.
  if (live && live !== kept) {
    setKept(live);
    setEnded(null);
  }
  const spaceRef = useRef<HTMLDivElement>(null);
  const space = useContentSize(spaceRef);

  useBackHandler(() => {
    go({ kind: 'home' });
    return true;
  });

  useEffect(() => {
    const offTook = game.events.on('took', (e) => {
      if (e.result) setEnded(e.result);
    });
    const offTool = game.events.on('tool', (e) => {
      if (e.result) setEnded(e.result);
    });
    return () => {
      offTook();
      offTool();
    };
  }, [game]);

  const current = live ?? (ended ? kept : null);
  useEffect(() => {
    if (!current) go({ kind: 'home' });
  });
  if (!current) return null;

  const level = levelOf(current);
  const r = current.round;
  const stuck = live !== null && R.isStuck(s);
  const tip = live ? R.tipFor(s, live) : null;
  const zone = current.mode === 'lane' ? zoneOf(current.level) : null;
  const left = tilesLeft(r);

  /** Once what a take or a tool did has played out: the results, or the sheet for a full tray. */
  const rest = () => {
    if (ended) {
      setTimeout(
        () => {
          open({ kind: 'results' });
        },
        reducedMotion() ? 100 : FINALE_MS,
      );
    } else if (R.isStuck(game.state)) open({ kind: 'stuck' });
  };

  const use = (tool: Tool) => {
    if (ended) return;
    if (game.state.tools[tool] <= 0) {
      open({ kind: 'tool', tool });
      return;
    }
    game.applyTool(tool);
  };

  return (
    <div class={`play${ended ? ' play--ended' : ''}`} data-testid="play" data-mode={current.mode} data-level={current.level}>
      <header class="topbar">
        <button
          type="button"
          class="iconbtn"
          aria-label={t('common.home')}
          data-testid="go-home"
          onClick={() => {
            go({ kind: 'home' });
          }}
        >
          <Icon name="home" size={24} />
        </button>
        <h1 class="topbar__title">
          <span data-testid="round-title">{current.mode === 'daily' ? t('play.daily') : t('play.level', { n: current.level })}</span>
          <small class="topbar__where">{zone ? t(`zone.${zone}`) : current.mode === 'daily' ? t('play.dailyNote') : t('zone.late')}</small>
        </h1>
        <CoinCount />
      </header>

      <section class="status" aria-label={t('play.status')}>
        <span class="status__left" data-testid="left" data-left={left}>
          <Icon name="box" size={20} /> {t('play.left', { n: left })}
        </span>
        <StarMeter peak={r.peak} />
      </section>

      <div class="space" ref={spaceRef}>
        {space.width > 0 && (
          <Table
            key={`${current.mode}:${String(current.level)}:${String(current.day)}:${String(r.seed)}`}
            level={level}
            round={r}
            space={space}
            disabled={ended !== null}
            onRest={rest}
          />
        )}
        {ended && (
          <div class="banner" data-testid="cleared" role="status">
            <strong>{t('play.cleared')}</strong>
            <span class="banner__stars" aria-label={t('result.stars', { n: ended.stars })}>
              {[1, 2, 3].map((n) => (
                <Icon key={n} name={n <= ended.stars ? 'star' : 'starEmpty'} size={30} />
              ))}
            </span>
          </div>
        )}
      </div>

      <div class="dock" role="toolbar" aria-label={t('play.tools')}>
        {TOOLS.map((id) => {
          const works = R.toolWorks(s, id);
          return (
            <button
              key={id}
              type="button"
              class={`toolbtn toolbtn--${id}`}
              data-testid={`tool-${id}`}
              aria-label={t('play.toolLabel', { name: t(`tool.${id}`), n: s.tools[id] })}
              disabled={ended !== null || !works}
              onClick={() => {
                use(id);
              }}
            >
              <Icon name={id} size={30} />
              <span class="toolbtn__name">{t(`tool.${id}`)}</span>
              <span class="toolbtn__badge" data-testid={`tool-${id}-count`}>
                {s.tools[id] > 0 ? s.tools[id] : '+'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Always there, so the table does not move when a note comes or goes. */}
      <div class="foot">
        {stuck && !ended ? (
          <div class="note note--alert" role="alert" data-testid="stuck-note">
            <p>{t('stuck.title')}</p>
            <Button
              small
              testId="stuck-open"
              onPress={() => {
                open({ kind: 'stuck' });
              }}
            >
              <Icon name="room" size={16} /> {t('stuck.more', { n: MORE_ROOM })}
            </Button>
          </div>
        ) : (
          tip && (
            <div class="note" data-testid="tip" data-tip={tip}>
              <p>{t(`tip.${tip}`)}</p>
              <Button
                small
                variant="ghost"
                testId="tip-ok"
                onPress={() => {
                  game.seeTip(tip);
                }}
              >
                {t('common.gotIt')}
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/** The stars the round is on course for: three while the tray has never held more than four. */
function StarMeter(props: { peak: number }): JSX.Element {
  const { t } = useView();
  const stars = props.peak <= STAR_PEAKS[0] ? 3 : props.peak <= STAR_PEAKS[1] ? 2 : 1;
  return (
    <span class="status__stars" data-testid="star-meter" data-stars={stars} role="img" aria-label={t('play.onCourse', { n: stars })}>
      {[1, 2, 3].map((n) => (
        <Icon key={n} name={n <= stars ? 'star' : 'starEmpty'} size={20} />
      ))}
    </span>
  );
}

/** The sugar a player has; tapping it opens the shop. */
export function CoinCount(): JSX.Element {
  const { s, t, ui, fmt } = useView();
  return (
    <button
      type="button"
      class="res"
      data-testid="coins"
      aria-label={`${t('res.coins')}: ${fmt(s.coins)}`}
      onClick={() => {
        ui.open({ kind: 'shop' });
      }}
    >
      <Icon name="coin" size={22} />
      <span class="res__value">{fmt(s.coins)}</span>
    </button>
  );
}
