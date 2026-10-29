import { Button, useBackHandler } from '@game1/ui';
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import * as B from '../sim/board.js';
import { TOOL_COSTS, type Tool } from '../sim/content.js';
import * as Q from '../sim/quilt.js';
import * as R from '../sim/rules.js';
import { SHAPES, type Shape } from '../sim/shapes.js';
import { fabricStyle, lookOf } from './fabrics.js';
import { Icon, type IconName } from './Icon.js';
import { PatchArt } from './Patch.js';
import { useView } from './view.js';

interface Drag {
  slot: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  /** A finger hides what is under it, so a patch dragged by touch rides above it. */
  lifted: boolean;
  /** Where the board was and how big its squares were when the drag started. */
  boardLeft: number;
  boardTop: number;
  cell: number;
}

/** A drag shorter than this is a tap. */
const DRAG_START_PX = 8;

/** The screen position of a dragged patch's top left corner. */
function ghostCorner(drag: Drag, shape: Shape): [number, number] {
  const w = shape.width * drag.cell;
  const h = shape.height * drag.cell;
  return [drag.x - w / 2, drag.lifted ? drag.y - h - drag.cell * 0.8 : drag.y - h / 2];
}

interface Preview {
  slot: number;
  x: number;
  y: number;
  ok: boolean;
}

interface Effect {
  id: number;
  stitch: Q.Stitch;
}

let effectIds = 0;

/** While mounted, the back button and Escape call `onBack` first. */
function BackCatcher(props: { onBack: () => void }): null {
  useBackHandler(() => {
    props.onBack();
    return true;
  });
  return null;
}

export function Play(props: { mode: Q.Mode }): JSX.Element | null {
  const { game, s, t, ui, fmt, fabrics, day } = useView();
  const { mode } = props;
  const q = s.quilts[mode];
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState<[number, number]>([3, 3]);
  const [snipping, setSnipping] = useState(false);
  const [effects, setEffects] = useState<Effect[]>([]);

  useBackHandler(() => {
    ui.go({ kind: 'home' });
    return true;
  });

  useEffect(
    () =>
      game.events.on('stitch', (e) => {
        if (e.mode !== mode || (e.stitch.seams.length === 0 && !e.stitch.cleared)) return;
        const id = ++effectIds;
        setEffects((list) => [...list.slice(-2), { id, stitch: e.stitch }]);
        setTimeout(() => {
          setEffects((list) => list.filter((effect) => effect.id !== id));
        }, 1100);
      }),
    [game, mode],
  );

  const place = (slot: number, x: number, y: number): boolean => {
    const done = game.place(mode, slot, x, y) !== null;
    if (done) setSelected(null);
    return done;
  };

  // Arrow keys move a selected patch over the quilt, Enter sews it. A layout effect, so the
  // listener knows the new aim before the next key: with a plain effect it waited for a paint,
  // and a quick Enter after an arrow sewed the patch where it had been.
  useLayoutEffect(() => {
    if (selected === null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      const patch = q?.tray[selected];
      if (!patch) return;
      const shape = SHAPES[patch.shape];
      const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const move = moves[e.key];
      if (move) {
        e.preventDefault();
        setCursor(([x, y]) => [Math.max(0, Math.min(B.SIZE - shape.width, x + move[0])), Math.max(0, Math.min(B.SIZE - shape.height, y + move[1]))]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        place(selected, cursor[0], cursor[1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  if (!q) return null;

  let preview: Preview | null = null;
  if (drag?.moved) {
    const patch = q.tray[drag.slot];
    if (patch) {
      const shape = SHAPES[patch.shape];
      const [left, top] = ghostCorner(drag, shape);
      const x = Math.round((left - drag.boardLeft) / drag.cell);
      const y = Math.round((top - drag.boardTop) / drag.cell);
      preview = { slot: drag.slot, x, y, ok: B.fits(q.board, shape, x, y) };
    }
  } else if (selected !== null && q.tray[selected]) {
    preview = { slot: selected, x: cursor[0], y: cursor[1], ok: Q.canPlace(q, selected, cursor[0], cursor[1]) };
  }

  // What the patch would sew, and the seams it would finish.
  let previewSquares: number[] = [];
  let previewSeams = new Set<number>();
  const previewPatch = preview ? q.tray[preview.slot] : null;
  if (preview && previewPatch) {
    const shape = SHAPES[previewPatch.shape];
    if (preview.ok) {
      const copy = [...q.board];
      previewSquares = B.sew(copy, shape, preview.x, preview.y, previewPatch.fabric);
      previewSeams = new Set(B.fullSeams(copy).flatMap(B.seamSquares));
    } else if (!drag) {
      previewSquares = shape.cells
        .map(([cx, cy]) => [preview.x + cx, preview.y + cy] as const)
        .filter(([x, y]) => x < B.SIZE && y < B.SIZE)
        .map(([x, y]) => B.indexOf(x, y));
    }
  }

  const onSquare = (x: number, y: number) => {
    if (snipping) {
      if (game.snip(mode, x, y)) setSnipping(false);
      return;
    }
    if (selected === null) return;
    const patch = q.tray[selected];
    if (!patch) return;
    const [px, py] = B.aimAt(SHAPES[patch.shape], x, y);
    setCursor([px, py]);
    place(selected, px, py);
  };

  const target = mode === 'daily' ? R.dailyTarget(day) : null;
  const dailyDone = mode === 'daily' && R.dailyDoneToday(s, day);
  const ghostPatch = drag?.moved ? q.tray[drag.slot] : null;

  return (
    <div class="play" data-testid="play">
      {selected !== null && (
        <BackCatcher
          onBack={() => {
            setSelected(null);
          }}
        />
      )}
      {snipping && (
        <BackCatcher
          onBack={() => {
            setSnipping(false);
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
            ui.go({ kind: 'home' });
          }}
        >
          <Icon name="home" size={24} />
        </button>
        <div class="score" data-testid="score">
          <span class="score__label">{t('play.score')}</span>
          <strong class="score__value">{fmt(q.score)}</strong>
        </div>
        <div class="score__side g1-small g1-muted" data-testid="goal">
          {target === null ? t('play.best', { score: fmt(Math.max(s.best, q.score)) }) : dailyDone ? t('play.targetDone') : t('play.target', { score: fmt(target) })}
        </div>
        <SpoolCount />
      </header>

      <div class="board-wrap">
        <div class={`board${snipping ? ' board--snipping' : ''}`} ref={boardRef} role="group" aria-label={t('play.board')} data-testid="board">
          {q.board.map((fabric, i) => {
            const x = i % B.SIZE;
            const y = Math.floor(i / B.SIZE);
            const seam = previewSeams.has(i);
            return (
              <div
                key={i}
                class={`sq${fabric === B.EMPTY ? '' : ' sq--sewn'}${seam ? ' sq--seam' : ''}`}
                style={fabric === B.EMPTY ? undefined : fabricStyle(lookOf(fabrics, fabric))}
                data-square={`${x},${y}`}
                onClick={() => {
                  onSquare(x, y);
                }}
                onPointerEnter={(e) => {
                  const patch = selected === null ? null : q.tray[selected];
                  if (patch && e.pointerType === 'mouse') setCursor(B.aimAt(SHAPES[patch.shape], x, y));
                }}
              />
            );
          })}
          {previewPatch &&
            previewSquares.map((i) => (
              <div
                key={`p${i}`}
                class={`sq sq--ghost${preview?.ok ? '' : ' sq--bad'}`}
                style={{ ...(preview?.ok ? fabricStyle(lookOf(fabrics, previewPatch.fabric)) : {}), left: `${(i % B.SIZE) * 12.5}%`, top: `${Math.floor(i / B.SIZE) * 12.5}%` }}
              />
            ))}
          {effects.map(({ id, stitch }) => (
            <div key={id} class="effect">
              {stitch.unpicked.map(({ at, fabric }) => (
                <div
                  key={at}
                  class="sq sq--sewn sq--unpicked"
                  style={{ ...fabricStyle(lookOf(fabrics, fabric)), left: `${(at % B.SIZE) * 12.5}%`, top: `${Math.floor(at / B.SIZE) * 12.5}%` }}
                />
              ))}
              <div class="effect__label" data-testid="effect">
                <strong>+{fmt(stitch.points)}</strong>
                {stitch.cleared && <span>{t('play.cleared')}</span>}
                {stitch.perfect > 0 && <span>{t('play.perfect')}</span>}
                {stitch.streak > 1 && <span>{t('play.streak', { factor: Q.streakFactor(stitch.streak) })}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div class="tray" role="group" aria-label={t('play.tray')} data-testid="tray">
        {q.tray.map((patch, slot) => {
          const dragging = drag?.slot === slot && drag.moved;
          const fits = patch !== null && B.fitsAnywhere(q.board, SHAPES[patch.shape]);
          return (
            <button
              type="button"
              key={slot}
              class={`tray__slot${selected === slot ? ' tray__slot--selected' : ''}${patch && !fits ? ' tray__slot--stuck' : ''}`}
              disabled={patch === null}
              aria-label={patch ? t('play.patch', { squares: SHAPES[patch.shape].cells.length }) : undefined}
              aria-pressed={selected === slot}
              data-testid={`patch-${slot}`}
              onPointerDown={(e) => {
                if (!patch || e.button > 0) return;
                e.preventDefault();
                try {
                  // The rest of the drag comes to this button, wherever the pointer goes.
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // A pointer that is already gone; touch drags are captured by the browser anyway.
                }
                const rect = boardRef.current?.getBoundingClientRect();
                setSnipping(false);
                setDrag({
                  slot,
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                  x: e.clientX,
                  y: e.clientY,
                  moved: false,
                  lifted: e.pointerType !== 'mouse',
                  boardLeft: rect?.left ?? 0,
                  boardTop: rect?.top ?? 0,
                  cell: rect ? rect.width / B.SIZE : 40,
                });
                game.pick();
              }}
              onPointerMove={(e) => {
                if (drag?.pointerId !== e.pointerId) return;
                const moved = drag.moved || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_START_PX;
                setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
              }}
              onPointerUp={(e) => {
                if (drag?.pointerId !== e.pointerId) return;
                setDrag(null);
                if (!drag.moved) {
                  // A tap picks the patch up; tapping the quilt or Enter sews it.
                  setSelected(selected === slot ? null : slot);
                  return;
                }
                if (preview?.ok) place(slot, preview.x, preview.y);
              }}
              onPointerCancel={() => {
                setDrag(null);
              }}
              onClick={(e) => {
                // Keyboard presses arrive here; pointer presses were handled above.
                if (e.detail === 0 && patch) setSelected(selected === slot ? null : slot);
              }}
            >
              {patch && !dragging && <PatchArt shape={patch.shape} fabric={patch.fabric} set={fabrics} cell={tinyCell(SHAPES[patch.shape])} />}
            </button>
          );
        })}
      </div>

      <div class="tools">
        <ToolButton mode={mode} tool="unpick" icon="unpick" onUse={() => game.unpick(mode)} cost={R.unpickCost(s, mode) ?? TOOL_COSTS.unpick} />
        <ToolButton mode={mode} tool="newPatches" icon="shuffle" onUse={() => game.newPatches(mode)} cost={TOOL_COSTS.newPatches} />
        <ToolButton
          mode={mode}
          tool="snip"
          icon="scissors"
          active={snipping}
          onUse={() => {
            setSelected(null);
            setSnipping(!snipping);
            return true;
          }}
          cost={TOOL_COSTS.snip}
        />
      </div>
      {/* Always there, so the quilt does not move when a hint comes or goes. */}
      <div class="foot">
        {snipping ? (
          <p class="hint" data-testid="snip-hint">
            {t('tool.snipHint')}
          </p>
        ) : R.stuck(s, mode) ? (
          <StuckPanel mode={mode} />
        ) : (
          !s.hintDone && (
            <p class="hint" data-testid="hint">
              {t('play.hint')}
            </p>
          )
        )}
      </div>

      {drag && ghostPatch && (
        <div class="ghost" style={ghostStyle(drag, SHAPES[ghostPatch.shape])}>
          <PatchArt shape={ghostPatch.shape} fabric={ghostPatch.fabric} set={fabrics} cell={drag.cell} />
        </div>
      )}
    </div>
  );
}

/** Tray patches are drawn small enough that the widest, five squares, fits its slot. */
function tinyCell(shape: Shape): number {
  return Math.max(shape.width, shape.height) > 3 ? 17 : 22;
}

function ghostStyle(drag: Drag, shape: Shape): { left: string; top: string } {
  const [left, top] = ghostCorner(drag, shape);
  return { left: `${left}px`, top: `${top}px` };
}

/** No patch fits: a second chance, a tool, or the end of the quilt. */
function StuckPanel(props: { mode: Q.Mode }): JSX.Element {
  const { game, s, t, ui } = useView();
  const offered = game.adOffered('second_chance', R.slotOf(props.mode));
  return (
    <div class="stuck" role="alert" data-testid="stuck">
      <p class="stuck__text">
        <strong>{t('stuck.title')}</strong> {t('stuck.body')}
      </p>
      {offered && <p class="g1-small g1-muted">{t('stuck.secondChance.desc')}</p>}
      <div class="stuck__actions">
        {offered && (
          <Button
            variant="ad"
            testId="second-chance"
            disabled={game.busy}
            onPress={() => {
              void game.watchAd('second_chance', R.slotOf(props.mode));
            }}
          >
            {!R.hasEntitlement(s, 'remove_ads') && <Icon name="play" size={16} />} {t('stuck.secondChance')}
          </Button>
        )}
        <Button
          variant={offered ? 'ghost' : 'primary'}
          testId="finish"
          onPress={() => {
            if (game.finish(props.mode)) ui.open({ kind: 'results' });
            else ui.go({ kind: 'home' });
          }}
        >
          {t('stuck.finish')}
        </Button>
      </div>
    </div>
  );
}

function ToolButton(props: { mode: Q.Mode; tool: Tool; icon: IconName; cost: number; active?: boolean; onUse: () => boolean }): JSX.Element {
  const { s, t } = useView();
  const usable = R.canUse(s, props.mode, props.tool);
  return (
    <button
      type="button"
      class={`tool${props.active ? ' tool--active' : ''}`}
      disabled={!usable && !props.active}
      data-testid={`tool-${props.tool}`}
      onClick={() => {
        props.onUse();
      }}
    >
      <Icon name={props.icon} size={22} />
      <span class="tool__name">{t(`tool.${props.tool}`)}</span>
      <span class="tool__cost">
        <Icon name="spool" size={14} /> {props.cost}
      </span>
    </button>
  );
}

export function SpoolCount(): JSX.Element {
  const { s, t, fmt } = useView();
  return (
    <div class="res" data-testid="spools" aria-label={t('res.spools')}>
      <Icon name="spool" size={22} />
      <span class="res__value">{fmt(s.spools)}</span>
    </div>
  );
}
