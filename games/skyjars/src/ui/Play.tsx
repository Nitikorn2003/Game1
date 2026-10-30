import { useBackHandler } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { COLOURS, type Mode, type Tool } from '../sim/content.js';
import * as J from '../sim/jars.js';
import * as R from '../sim/rules.js';
import type { Shelf } from '../sim/state.js';
import { Icon, type IconName } from './Icon.js';
import { JarArt } from './Jar.js';
import { useView } from './view.js';

/** How many jars stand on each row of the shelf: one row for a few, then two, then three. */
export function rowsOf(count: number): number[] {
  if (count <= 5) return [count];
  if (count <= 14) {
    const top = Math.ceil(count / 2);
    return [top, count - top];
  }
  const per = Math.ceil(count / 3);
  return [per, per, count - 2 * per];
}

/** The units that just arrived in a jar, for the drop they make. */
interface Arrival {
  shelf: Shelf;
  to: number;
  n: number;
  id: number;
}

let pourIds = 0;

/** How long the solved shelf shows before its results. */
const FINALE_MS = 1200;

/** While mounted, the back button and Escape call `onBack` first. */
function BackCatcher(props: { onBack: () => void }): null {
  useBackHandler(() => {
    props.onBack();
    return true;
  });
  return null;
}

export function Play(props: { mode: Mode }): JSX.Element | null {
  const { game, s, t, ui, jarStyle } = useView();
  const { mode } = props;
  const { go, open } = ui;
  const live = s.shelves[mode];
  const [lifted, setLifted] = useState<{ shelf: Shelf; jar: number } | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  // The shelf just solved, shown a moment before its results; the state has none by then.
  const [finale, setFinale] = useState<Shelf | null>(null);
  // The jars as they stood when a hint found no way forward: the note goes once they change.
  const [noWay, setNoWay] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  useBackHandler(() => {
    go({ kind: 'home' });
    return true;
  });

  useEffect(
    () =>
      game.events.on('pour', (e) => {
        if (e.mode !== mode) return;
        setArrival({ shelf: e.shelf, to: e.to, n: e.n, id: ++pourIds });
        if (e.result) {
          setFinale(e.shelf);
          setTimeout(() => {
            open({ kind: 'results' });
          }, FINALE_MS);
        }
      }),
    [game, mode, open],
  );

  // Restart asks for a second tap, which has to come soon.
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => {
      setArmed(false);
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [armed]);

  const shelf = live ?? finale;
  useEffect(() => {
    if (!shelf) go({ kind: 'home' });
  });
  if (!shelf) return null;

  const solving = live === null;
  const puzzle = R.puzzleOf(shelf);
  const stuck = !solving && J.stuck(puzzle);
  const liftedJar = lifted?.shelf === shelf ? lifted.jar : null;
  const arrived = arrival?.shelf === shelf ? arrival : null;
  const hint = solving ? null : shelf.hint;
  const layout = shelf.jars.map((jar) => jar.join(',')).join('|');
  const liftable = (i: number) => {
    const jar = shelf.jars[i] ?? [];
    return jar.length > 0 && !J.complete(jar, shelf.capacity);
  };

  const tap = (i: number) => {
    if (solving) return;
    if (liftedJar === null) {
      if (liftable(i)) {
        setLifted({ shelf, jar: i });
        game.pick();
      } else game.nope();
      return;
    }
    if (liftedJar === i) {
      setLifted(null);
      return;
    }
    if (J.canPour(puzzle, liftedJar, i)) {
      setLifted(null);
      game.pour(mode, liftedJar, i);
      return;
    }
    // Not a pour: the tapped jar is lifted instead, when it can be.
    if (liftable(i)) {
      setLifted({ shelf, jar: i });
      game.pick();
    } else {
      setLifted(null);
      game.nope();
    }
  };

  const reset = () => {
    setLifted(null);
    setArrival(null);
  };
  const undo = () => {
    if (shelf.undosLeft > 0) {
      if (game.undo(mode)) reset();
    } else open({ kind: 'tool', mode, tool: 'moreUndos' });
  };
  const restart = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    if (game.restart(mode)) reset();
  };
  const help = (tool: Tool) => {
    setLifted(null);
    // A hint that finds no way forward says so, and costs nothing.
    if (tool === 'hint' && !game.toolOffered(mode, 'hint')) {
      setNoWay(layout);
      game.nope();
      return;
    }
    open({ kind: 'tool', mode, tool });
  };

  const rows = rowsOf(shelf.jars.length);
  const perRow = Math.max(...rows);
  let next = 0;
  const label = (i: number) => {
    const jar = shelf.jars[i] ?? [];
    const text =
      jar.length === 0
        ? t('play.jarEmpty', { n: i + 1 })
        : t('play.jar', { n: i + 1, units: jar.map((colour) => t(`colour.${(COLOURS[colour] ?? COLOURS[0]).id}`)).join(', ') });
    return liftedJar === i ? `${text}, ${t('play.lifted')}` : text;
  };

  return (
    <div class={`play${solving ? ' play--solved' : ''}`} data-testid="play">
      {liftedJar !== null && (
        <BackCatcher
          onBack={() => {
            setLifted(null);
          }}
        />
      )}
      <header class="topbar">
        <button
          type="button"
          class="iconbtn"
          aria-label={t('common.back')}
          data-testid="go-home"
          onClick={() => {
            go({ kind: 'home' });
          }}
        >
          <Icon name="home" size={24} />
        </button>
        <h1 class="topbar__title" data-testid="shelf-title">
          {mode === 'daily' ? (
            <>
              <Icon name="moon" size={20} /> {t('play.daily')}
            </>
          ) : (
            t('play.level', { level: shelf.level })
          )}
        </h1>
        <StardustCount />
      </header>
      <p class="goal g1-small">{t('play.goal')}</p>

      <div class="shelf" role="group" aria-label={t('play.shelf')} data-testid="shelf" style={{ '--per-row': perRow }}>
        {rows.map((count, r) => (
          <div class="shelf__row" key={r}>
            {Array.from({ length: count }, () => {
              const i = next++;
              const jar = shelf.jars[i] ?? [];
              const from = hint?.[0] === i;
              const to = hint?.[1] === i;
              return (
                <button
                  type="button"
                  key={i}
                  class={`jarbtn${liftedJar === i ? ' jarbtn--lifted' : ''}${from ? ' jarbtn--from' : ''}${to ? ' jarbtn--to' : ''}`}
                  aria-label={label(i)}
                  aria-pressed={liftedJar === i}
                  data-testid={`jar-${String(i)}`}
                  data-units={jar.join(',')}
                  onClick={() => {
                    tap(i);
                  }}
                >
                  {from && (
                    <span class="jarbtn__mark" data-testid="hint-from">
                      <Icon name="hint" size={20} />
                    </span>
                  )}
                  {to && (
                    <span class="jarbtn__mark jarbtn__mark--to" data-testid="hint-to">
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 21 4 11h5V3h6v8h5l-8 10Z" fill="currentColor" />
                      </svg>
                    </span>
                  )}
                  <JarArt units={jar} capacity={shelf.capacity} look={jarStyle} arrived={arrived?.to === i ? arrived.n : 0} pourId={arrived?.id ?? 0} />
                </button>
              );
            })}
          </div>
        ))}
        {solving && (
          <div class="solved" data-testid="solved">
            <Icon name="stardust" size={34} />
            <strong>{t('play.solved')}</strong>
          </div>
        )}
      </div>

      <div class="tools">
        <ToolButton
          icon="undo"
          label={shelf.undosLeft > 0 ? t('tool.undo') : t('tool.moreUndos')}
          badge={shelf.undosLeft > 0 ? String(shelf.undosLeft) : '+'}
          disabled={solving || shelf.history.length === 0}
          onPress={undo}
          testId="tool-undo"
        />
        <ToolButton icon="restart" label={armed ? t('tool.restartSure') : t('tool.restart')} active={armed} disabled={solving || shelf.history.length === 0} onPress={restart} testId="tool-restart" />
        <ToolButton
          icon="jar"
          label={t('tool.extraJar')}
          disabled={solving || shelf.extraJar}
          onPress={() => {
            help('extraJar');
          }}
          testId="tool-extraJar"
        />
        <ToolButton
          icon="hint"
          label={t('tool.hint')}
          disabled={solving || shelf.hint !== null}
          onPress={() => {
            help('hint');
          }}
          testId="tool-hint"
        />
      </div>
      {/* Always there, so the shelf does not move when a note comes or goes. */}
      <div class="foot">
        {stuck ? (
          <p class="note note--alert" role="alert" data-testid="stuck">
            <strong>{t('stuck.title')}</strong> {t('stuck.body')}
          </p>
        ) : noWay === layout ? (
          <p class="note" role="status" data-testid="no-way">
            {t('play.noWay')}
          </p>
        ) : hint ? (
          <p class="note" data-testid="hint-note">
            {t('play.hinted')}
          </p>
        ) : (
          !s.taught && (
            <p class="note" data-testid="teach">
              {t('play.teach')}
            </p>
          )
        )}
      </div>
    </div>
  );
}

function ToolButton(props: { icon: IconName; label: string; badge?: string; active?: boolean; disabled: boolean; onPress: () => void; testId: string }): JSX.Element {
  return (
    <button type="button" class={`tool${props.active ? ' tool--active' : ''}`} disabled={props.disabled} data-testid={props.testId} onClick={props.onPress}>
      <Icon name={props.icon} size={24} />
      <span class="tool__name">{props.label}</span>
      {props.badge !== undefined && <span class="tool__badge">{props.badge}</span>}
    </button>
  );
}

/** The stardust a player has; tapping it opens the shop. */
export function StardustCount(): JSX.Element {
  const { s, t, ui, fmt } = useView();
  return (
    <button
      type="button"
      class="res"
      data-testid="stardust"
      aria-label={`${t('res.stardust')}: ${fmt(s.stardust)}`}
      onClick={() => {
        ui.open({ kind: 'shop' });
      }}
    >
      <Icon name="stardust" size={22} />
      <span class="res__value">{fmt(s.stardust)}</span>
    </button>
  );
}
