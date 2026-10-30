import { Button, useBackHandler } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { COLOURS } from '../sim/board.js';
import { TOOLS, type Tool } from '../sim/content.js';
import { MORE_MOVES, goalsLeft, type Goal } from '../sim/dive.js';
import { zoneOf } from '../sim/levels.js';
import * as R from '../sim/rules.js';
import { levelOf, type Current, type DiveResult } from '../sim/state.js';
import { BuddyArt, PieceArt } from './art.js';
import { Board } from './Board.js';
import { Icon } from './Icon.js';
import { cellSize, reducedMotion, useContentSize } from './layout.js';
import { useView } from './view.js';

/** How long the board shows the goals reached before the results. */
const FINALE_MS = 900;
/** Moves left at which the count starts to warn. */
const FEW_MOVES = 5;

export function Play(): JSX.Element | null {
  const { game, s, t, ui, buddy } = useView();
  const { go, open } = ui;
  const live = s.current;
  // The dive the screen shows: the state lets go of a dive the moment it reaches its goals.
  const [kept, setKept] = useState<Current | null>(live);
  const [ended, setEnded] = useState<DiveResult | null>(null);
  // A new dive, after the results of the last one.
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

  useEffect(
    () =>
      game.events.on('move', (e) => {
        if (e.result) setEnded(e.result);
      }),
    [game],
  );

  const current = live ?? (ended ? kept : null);
  useEffect(() => {
    if (!current) go({ kind: 'home' });
  });
  if (!current) return null;

  const level = levelOf(current);
  const d = current.dive;
  const left = goalsLeft(d, level);
  const stuck = live !== null && R.isStuck(s);
  const noMoves = live !== null && R.noMoves(s);
  const tip = live ? R.tipFor(s, live) : null;
  const zone = current.mode === 'reef' ? zoneOf(current.level) : null;
  const b = d.board;
  const cell = cellSize(space, b.width, b.height);

  /** Once the last move has played out: the results, or the sheet for a dive out of moves. */
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
          <span data-testid="dive-title">{current.mode === 'daily' ? t('play.daily') : t('play.level', { n: current.level })}</span>
          <small class="topbar__where">{zone ? t(`zone.${zone}`) : current.mode === 'daily' ? t('play.dailyNote') : t('zone.sea')}</small>
        </h1>
        <CoinCount />
      </header>

      <section class="goals" aria-label={t('play.goals')}>
        <div class={`moves${d.movesLeft <= FEW_MOVES ? ' moves--few' : ''}`} data-testid="moves" role="img" aria-label={t('play.moves', { n: d.movesLeft })}>
          <span class="moves__n">{d.movesLeft}</span>
          <span class="moves__label">{t('play.movesShort')}</span>
        </div>
        <ul class="goal-list">
          {level.goals.map((goal, i) => (
            <GoalChip key={i} goal={goal} left={left[i] ?? 0} size={30} testId={`goal-${String(i)}`} />
          ))}
        </ul>
        <BuddyArt buddy={buddy} size={44} class="buddy--swim" />
      </section>

      <div class="space" ref={spaceRef}>
        {space.width > 0 && (
          <Board
            key={`${current.mode}:${String(current.level)}:${String(current.day)}:${String(s.stats.dives)}`}
            level={level}
            dive={d}
            cell={cell}
            tool={tool}
            onToolUsed={() => {
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
            <Icon name={id} size={30} />
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
          <div class="note note--alert" role="alert" data-testid="out-of-moves">
            <p>{t('stuck.title')}</p>
            <Button
              small
              testId="out-of-moves-open"
              onPress={() => {
                open({ kind: 'stuck' });
              }}
            >
              {t('stuck.more', { n: MORE_MOVES })}
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
        ) : noMoves ? (
          <div class="note note--alert" role="alert" data-testid="no-moves">
            <p>{t('play.noMoves')}</p>
            <Button
              small
              variant="ghost"
              testId="no-moves-end"
              onPress={() => {
                game.giveUp();
                open({ kind: 'results' });
              }}
            >
              {t('stuck.end')}
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

/** One goal of a dive: its piece or sign, and how much of it is still to do. */
export function GoalChip(props: { goal: Goal; left: number; size: number; testId?: string }): JSX.Element {
  const { t } = useView();
  const { goal, left: n } = props;
  const label = goal.kind === 'collect' ? t('goal.collect', { n, colour: t(`colour.${COLOURS[goal.colour] ?? COLOURS[0]}`) }) : t(`goal.${goal.kind}`, { n });
  return (
    <li class={`goal${n === 0 ? ' goal--done' : ''}`} data-testid={props.testId} data-left={n} aria-label={label}>
      {goal.kind === 'collect' ? <PieceArt kind={goal.colour} size={props.size} /> : <Icon name={goal.kind} size={props.size - 2} />}
      <span class="goal__n">{n === 0 ? <Icon name="check" size={18} /> : goal.kind === 'turtle' ? `${String(goal.count - n)}/${String(goal.count)}` : n}</span>
    </li>
  );
}

/** The sand dollars a player has; tapping them opens the shop. */
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
