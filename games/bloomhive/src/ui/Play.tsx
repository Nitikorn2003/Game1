import { Button, useBackHandler } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { TOOLS, type Tool } from '../sim/content.js';
import { COLOURS, reachedPip } from '../sim/hive.js';
import { zoneOf } from '../sim/levels.js';
import { MORE_SHOTS, NECTAR_FULL, goalsLeft, type Goal } from '../sim/round.js';
import * as R from '../sim/rules.js';
import { levelOf, type Current, type RoundResult } from '../sim/state.js';
import { PollenArt, ToolBall } from './art.js';
import { Board } from './Board.js';
import { Icon } from './Icon.js';
import { budSize, reducedMotion, useContentSize } from './layout.js';
import { useView } from './view.js';

/** How long the board shows the goals reached before the results. */
const FINALE_MS = 1000;
/** Pollen left at which the count starts to warn. */
const FEW_SHOTS = 3;

export function Play(): JSX.Element | null {
  const { game, s, t, ui } = useView();
  const { go, open } = ui;
  const live = s.current;
  // The round the screen shows: the state lets go of a round the moment it reaches its goals.
  const [kept, setKept] = useState<Current | null>(live);
  const [ended, setEnded] = useState<RoundResult | null>(null);
  // A new round, after the results of the last one.
  if (live && live !== kept) {
    setKept(live);
    setEnded(null);
  }
  const [tool, setTool] = useState<Tool | null>(null);
  const spaceRef = useRef<HTMLDivElement>(null);
  const space = useContentSize(spaceRef);

  useBackHandler(() => {
    if (tool) setTool(null);
    else go({ kind: 'home' });
    return true;
  });

  useEffect(() => {
    const offShot = game.events.on('shot', (e) => {
      if (e.result) setEnded(e.result);
    });
    // Five more pollen that blew away the last bee in the way end the round without a shot.
    const offEnded = game.events.on('ended', (result) => {
      setEnded(result);
      window.setTimeout(
        () => {
          open({ kind: 'results' });
        },
        reducedMotion() ? 100 : FINALE_MS,
      );
    });
    return () => {
      offShot();
      offEnded();
    };
  }, [game, open]);

  const current = live ?? (ended ? kept : null);
  useEffect(() => {
    if (!current) go({ kind: 'home' });
  });
  if (!current) return null;

  const level = levelOf(current);
  const r = current.round;
  const left = goalsLeft(r, level);
  const stuck = live !== null && R.isStuck(s);
  const atPip = stuck && reachedPip(r.board);
  const tip = live ? R.tipFor(s, live) : null;
  const zone = current.mode === 'meadow' ? zoneOf(current.level) : null;
  const size = budSize(space);

  /** Once the last shot has played out: the results, or the sheet for a round that is stuck. */
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

  const pick = (next: Tool) => {
    if (ended || stuck) return;
    if (game.state.tools[next] <= 0) {
      setTool(null);
      open({ kind: 'tool', tool: next });
      return;
    }
    setTool(tool === next ? null : next);
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
          <small class="topbar__where">{zone ? t(`zone.${zone}`) : current.mode === 'daily' ? t('play.dailyNote') : t('zone.wild')}</small>
        </h1>
        <CoinCount />
      </header>

      <section class="goals" aria-label={t('play.goals')}>
        <div class={`shots${r.shotsLeft <= FEW_SHOTS && !r.bomb ? ' shots--few' : ''}`} data-testid="shots" role="img" aria-label={t('play.shots', { n: r.shotsLeft })}>
          <span class="shots__n">{r.shotsLeft}</span>
          <span class="shots__label">{t('play.shotsShort')}</span>
        </div>
        <ul class="goal-list">
          {level.goals.map((goal, i) => (
            <GoalChip key={i} goal={goal} left={left[i] ?? 0} size={30} testId={`goal-${String(i)}`} />
          ))}
        </ul>
        <JarMeter nectar={r.nectar} full={r.bomb} />
      </section>

      <div class="space" ref={spaceRef}>
        {space.width > 0 && (
          <Board
            key={`${current.mode}:${String(current.level)}:${String(current.day)}:${String(s.stats.rounds)}`}
            level={level}
            round={r}
            size={size}
            tool={tool}
            onToolUsed={() => {
              setTool(null);
            }}
            onCancelTool={() => {
              setTool(null);
            }}
            onRest={rest}
            disabled={ended !== null || stuck}
          />
        )}
        {ended && (
          <div class="banner" data-testid="reached" role="status">
            <strong>{t('play.reached')}</strong>
            <span class="banner__stars" aria-label={t('result.stars', { n: ended.stars })}>
              {[1, 2, 3].map((n) => (
                <Icon key={n} name={n <= ended.stars ? 'star' : 'starEmpty'} size={30} />
              ))}
            </span>
          </div>
        )}
      </div>

      <div class="dock" role="toolbar" aria-label={t('play.tools')}>
        {TOOLS.map((id) => (
          <button
            key={id}
            type="button"
            class={`toolbtn${tool === id ? ' toolbtn--on' : ''}`}
            data-testid={`tool-${id}`}
            aria-pressed={tool === id}
            aria-label={t('play.toolLabel', { name: t(`tool.${id}`), n: s.tools[id] })}
            disabled={ended !== null || stuck}
            onClick={() => {
              pick(id);
            }}
          >
            <ToolBall tool={id} size={32} />
            <span class="toolbtn__name">{t(`tool.${id}`)}</span>
            <span class="toolbtn__badge" data-testid={`tool-${id}-count`}>
              {s.tools[id] > 0 ? s.tools[id] : '+'}
            </span>
          </button>
        ))}
      </div>

      {/* Always there, so the board does not move when a note comes or goes. */}
      <div class="foot">
        {stuck && !ended ? (
          <div class="note note--alert" role="alert" data-testid="stuck-note">
            <p>{atPip ? t('stuck.pip') : t('stuck.title')}</p>
            <Button
              small
              testId="stuck-open"
              onPress={() => {
                open({ kind: 'stuck' });
              }}
            >
              {t('stuck.more', { n: MORE_SHOTS })}
            </Button>
          </div>
        ) : tool ? (
          <p class="note note--tool" data-testid="tool-note">
            {t(`use.${tool}`)}{' '}
            <button
              type="button"
              class="linkbtn"
              data-testid="tool-cancel"
              onClick={() => {
                setTool(null);
              }}
            >
              {t('common.cancel')}
            </button>
          </p>
        ) : r.bomb ? (
          <p class="note note--tool" data-testid="jar-note">
            {t('play.jarFull')}
          </p>
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

/** One goal of a round: its bud or sign, and how much of it is still to do. */
export function GoalChip(props: { goal: Goal; left: number; size: number; testId?: string }): JSX.Element {
  const { t } = useView();
  const { goal, left: n } = props;
  const label = goal.kind === 'collect' ? t('goal.collect', { n, colour: t(`colour.${COLOURS[goal.colour] ?? COLOURS[0]}`) }) : t(`goal.${goal.kind}`, { n });
  return (
    <li class={`goal${n === 0 ? ' goal--done' : ''}`} data-testid={props.testId} data-left={n} aria-label={label}>
      {goal.kind === 'collect' ? <PollenArt colour={goal.colour} size={props.size} /> : <Icon name={goal.kind === 'bees' ? 'bee' : 'top'} size={props.size - 2} />}
      <span class="goal__n">{n === 0 ? <Icon name="check" size={18} /> : n}</span>
    </li>
  );
}

/** The nectar jar: it fills with every bud popped or fallen, and a full one gives a bomb. */
function JarMeter(props: { nectar: number; full: boolean }): JSX.Element {
  const { t } = useView();
  const share = props.full ? 1 : props.nectar / NECTAR_FULL;
  return (
    <div
      class={`jar${props.full ? ' jar--full' : ''}`}
      data-testid="jar"
      data-nectar={props.nectar}
      role="img"
      aria-label={props.full ? t('play.bomb') : t('play.jar', { n: props.nectar, of: NECTAR_FULL })}
      style={{ '--fill': share.toFixed(3) }}
    >
      <span class="jar__lid" />
      <span class="jar__glass">
        <span class="jar__honey" />
      </span>
    </div>
  );
}

/** The honey a player has; tapping it opens the shop. */
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
