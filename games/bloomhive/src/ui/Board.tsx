import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ShotEvent } from '../game.js';
import type { Tool } from '../sim/content.js';
import { BOARD_HEIGHT, COLOURS, COLS, LAST_ROW, MAX_ANGLE, MIN_ANGLE, RADIUS, ROW_H, SHOOTER, aimTo, beamCells, centreOf, clampAngle, rowOf, trace, type Bud, type Gone, type Point } from '../sim/hive.js';
import { BOMB_REACH, type Level, type Round, type ShotKind, type Step } from '../sim/round.js';
import * as R from '../sim/rules.js';
import type { Aim } from '../sim/bot.js';
import { BudArt, PipArt, PollenArt, ToolBall } from './art.js';
import { reducedMotion } from './layout.js';
import { useView } from './view.js';

/** How long each part of a shot shows, in milliseconds, one after another, after the ball's flight. */
const TIMES: Readonly<Record<Step['kind'], number>> = { stick: 110, pop: 300, fall: 480, butterflies: 320 };
/** The ball flies a bud's width in this many milliseconds, within these bounds. */
const FLY_MS = 28;
const FLY_MIN = 160;
const FLY_MAX = 720;
/** A player who has not shot for this long is shown a shot that helps. */
const HINT_MS = 7500;
/** Degrees an arrow key turns the aim; with Shift held, more. */
const KEY_STEP = 2;
const KEY_STEP_BIG = 8;
/** Where the meadow's grass starts: a bud in the last row would sit in it, at Pip's feet. */
const GRASS_Y = RADIUS + LAST_ROW * ROW_H - RADIUS;

/** What the board shows at one moment: a part of a shot as it plays out, or the round at rest. */
interface Frame {
  kind: 'fly' | Step['kind'];
  cells: readonly (Bud | null)[];
  popped: readonly Gone[];
  fallen: readonly Gone[];
  melted: readonly number[];
  changed: readonly number[];
  /** The cell the ball just stuck in. */
  landed: number | null;
  /** Where a bomb went off. */
  blast: Point | null;
}

/** The ball in flight. */
interface Flight {
  id: number;
  kind: ShotKind;
  colour: number;
  points: readonly Point[];
  ms: number;
}

const lengthOf = (points: readonly Point[]): number =>
  points.reduce((sum, p, i) => {
    const q = points[i - 1];
    return q ? sum + Math.hypot(p.x - q.x, p.y - q.y) : sum;
  }, 0);

function framesOf(e: ShotEvent): Frame[] {
  const s = e.shot;
  const bomb = (s.kind === 'bomb' || s.kind === 'jar') && s.cell !== null ? centreOf(s.cell) : null;
  return [
    { kind: 'fly', cells: e.before, popped: [], fallen: [], melted: [], changed: [], landed: null, blast: null },
    ...s.steps.map((step) => ({
      kind: step.kind,
      cells: step.cells,
      popped: step.popped,
      fallen: step.fallen,
      melted: step.melted,
      changed: step.changed,
      landed: step.kind === 'stick' ? s.cell : null,
      blast: step.kind === 'pop' ? bomb : null,
    })),
  ];
}

/** The ball as Pip holds it: a tool, the jar's bomb, or the pollen in hand. */
function HeldBall(props: { tool: Tool | null; round: Round; size: number }): JSX.Element {
  const { tool, round, size } = props;
  if (tool) return <ToolBall tool={tool} size={size} class={`ball ball--${tool}`} />;
  if (round.bomb) return <ToolBall tool="bomb" size={size} class="ball ball--jar" />;
  return <PollenArt colour={round.queue[0]} size={size} class="ball" />;
}

function FlyingBall(props: { flight: Flight; size: number }): JSX.Element {
  const { flight, size } = props;
  if (flight.kind === 'pollen' || flight.kind === 'rainbow') {
    return flight.kind === 'rainbow' ? <ToolBall tool="rainbow" size={size} /> : <PollenArt colour={flight.colour} size={size} />;
  }
  return <ToolBall tool={flight.kind === 'jar' ? 'bomb' : flight.kind} size={size} />;
}

export interface BoardProps {
  level: Level;
  round: Round;
  /** A bud's width, in pixels. */
  size: number;
  /** A tool loaded from the pouch, shot instead of the pollen. */
  tool: Tool | null;
  onToolUsed: () => void;
  onCancelTool: () => void;
  /** Called once a shot has played out on the board, and it shows the round as it is again. */
  onRest: () => void;
  /** No shots while a sheet is open, or the round is stuck. */
  disabled: boolean;
}

export function Board(props: BoardProps): JSX.Element {
  const { game, s, t, hat } = useView();
  const { round, size, tool, disabled } = props;
  const b = round.board;
  const [frame, setFrame] = useState<Frame | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [aim, setAim] = useState<number | null>(null);
  const [keyAim, setKeyAim] = useState<number | null>(null);
  const [hint, setHint] = useState<Aim | null>(null);
  const timersRef = useRef<number[]>([]);
  const pressRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const shotsRef = useRef(0);
  // The latest callback, for the timer that ends a shot.
  const onRestRef = useRef(props.onRest);
  useEffect(() => {
    onRestRef.current = props.onRest;
  });
  const busy = frame !== null;
  const cells = frame?.cells ?? b.cells;

  useEffect(
    () => () => {
      for (const id of timersRef.current) clearTimeout(id);
    },
    [],
  );

  useEffect(
    () =>
      game.events.on('shot', (e) => {
        for (const id of timersRef.current) clearTimeout(id);
        timersRef.current = [];
        const quick = reducedMotion();
        const later = (ms: number, run: () => void) => {
          timersRef.current.push(window.setTimeout(run, ms));
        };
        const frames = framesOf(e);
        const ms = quick ? 60 : Math.round(Math.min(FLY_MAX, Math.max(FLY_MIN, lengthOf(e.shot.points) * FLY_MS)));
        shotsRef.current += 1;
        setFrame(frames[0] ?? null);
        setFlight({ id: shotsRef.current, kind: e.shot.kind, colour: e.shot.colour, points: e.shot.points, ms });
        setAim(null);
        setHint(null);
        let at = ms;
        later(at, () => {
          setFlight(null);
          game.landed(e.shot);
        });
        frames.slice(1).forEach((f) => {
          later(at, () => {
            setFrame(f);
          });
          at += quick ? 60 : TIMES[f.kind === 'fly' ? 'stick' : f.kind];
        });
        later(at, () => {
          setFrame(null);
          onRestRef.current();
        });
      }),
    [game],
  );

  // The ball flies along its path, bounces and all.
  useLayoutEffect(() => {
    const el = flyRef.current;
    if (!flight || !el) return;
    const total = lengthOf(flight.points) || 1;
    let run = 0;
    const frames = flight.points.map((p, i) => {
      const q = flight.points[i - 1];
      if (q) run += Math.hypot(p.x - q.x, p.y - q.y);
      return { transform: `translate(${String((p.x - RADIUS) * size)}px, ${String((p.y - RADIUS) * size)}px)`, offset: Math.min(1, run / total) };
    });
    const last = frames.at(-1);
    // A WebView too old to animate shows the ball where it lands.
    if (typeof (el as { animate?: unknown }).animate !== 'function') {
      if (last) el.style.transform = last.transform;
      return;
    }
    el.animate(frames, { duration: flight.ms, easing: 'linear', fill: 'forwards' });
  }, [flight, size]);

  // A shot that helps, shown after a while without one.
  const version = `${String(round.shotsMade)}:${String(s.stats.toolsUsed)}:${String(round.continues)}:${String(round.queue[0])}`;
  useEffect(() => {
    setHint(null);
    if (busy || disabled || tool) return undefined;
    const id = window.setTimeout(() => {
      setHint(R.hintAim(game.state));
    }, HINT_MS);
    return () => {
      clearTimeout(id);
    };
  }, [game, version, busy, disabled, tool]);

  const fire = (angle: number) => {
    if (busy || disabled) return;
    const shot = game.shoot(angle, tool);
    if (shot && tool) props.onToolUsed();
  };

  const pointOf = (e: PointerEvent): Point | null => {
    const rect = rootRef.current?.getBoundingClientRect();
    return rect ? { x: (e.clientX - rect.left) / size, y: (e.clientY - rect.top) / size } : null;
  };
  /** The aim at a point; none at or below Pip, where letting go takes the shot back. */
  const angleAt = (p: Point | null): number | null => (p && p.y < SHOOTER.y - 0.3 ? clampAngle(aimTo(p)) : null);

  const onPointerDown = (e: PointerEvent) => {
    if (busy || disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pressRef.current = e.pointerId;
    setKeyAim(null);
    setHint(null);
    setAim(angleAt(pointOf(e)));
    rootRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const pressing = pressRef.current === e.pointerId;
    if (busy || disabled || (!pressing && e.pointerType !== 'mouse')) return;
    setAim(angleAt(pointOf(e)));
  };
  const onPointerUp = (e: PointerEvent) => {
    if (pressRef.current !== e.pointerId) return;
    pressRef.current = null;
    const angle = angleAt(pointOf(e));
    if (e.pointerType !== 'mouse') setAim(null);
    if (angle !== null) fire(angle);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
    const from = keyAim ?? aim ?? 90;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setKeyAim(Math.min(MAX_ANGLE, from + step));
        return;
      case 'ArrowRight':
        e.preventDefault();
        setKeyAim(Math.max(MIN_ANGLE, from - step));
        return;
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        e.preventDefault();
        setKeyAim(from);
        fire(from);
        return;
      case 'ArrowDown':
        e.preventDefault();
        if (!busy && !disabled) game.swapPollen();
        return;
      case 'Escape':
        // Puts the tool back only: the same key with no tool goes home.
        if (tool) {
          e.preventDefault();
          e.stopPropagation();
          props.onCancelTool();
        }
        return;
    }
  };

  // The aim line: where the ball would go, and where it would stick.
  const shown = busy || disabled ? null : (aim ?? keyAim ?? hint?.angle ?? null);
  const loaded: ShotKind = tool ?? (round.bomb ? 'jar' : 'pollen');
  const path = shown === null ? null : trace(b, shown, loaded === 'sunbeam');
  const ghost = path && path.cell !== null ? centreOf(path.cell) : null;
  const beamed = path && loaded === 'sunbeam' ? new Set(beamCells(path.points)) : null;
  const points = (list: readonly Point[]) => list.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
  const danger = cells.some((bud, c) => bud !== null && rowOf(c) >= LAST_ROW - 2);
  const place = (c: number) => {
    const p = centreOf(c);
    return `translate(${String((p.x - RADIUS) * size)}px, ${String((p.y - RADIUS) * size)}px)`;
  };
  const at = (p: Point, w = 1) => ({ left: `${String((p.x - w / 2) * size)}px`, top: `${String((p.y - w / 2) * size)}px`, width: `${String(w * size)}px`, height: `${String(w * size)}px` });
  const canSwap = !busy && !disabled && !round.bomb && round.queue[0] !== round.queue[1];
  const freed = frame ? [...frame.popped, ...frame.fallen].filter((g) => g.bud.bee) : [];

  return (
    <div
      ref={rootRef}
      class={`board board--${frame?.kind ?? 'rest'}${tool ? ` board--tool board--${tool}` : ''}${disabled ? ' board--off' : ''}${danger ? ' board--danger' : ''}`}
      data-testid="board"
      data-busy={busy ? 'true' : 'false'}
      data-aim={shown === null ? '' : shown.toFixed(1)}
      style={{ width: `${String(COLS * size)}px`, height: `${String(BOARD_HEIGHT * size)}px`, '--bud': `${String(size)}px` }}
      role="application"
      aria-label={t('board.label')}
      aria-describedby="board-help"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && pressRef.current === null) setAim(null);
      }}
      onPointerCancel={() => {
        pressRef.current = null;
        setAim(null);
      }}
      onKeyDown={onKeyDown}
      onBlur={() => {
        setKeyAim(null);
      }}
    >
      <p id="board-help" class="sr-only">
        {t('board.help')}
      </p>
      <div class="board__branch" aria-hidden="true" />
      <div class="board__grass" aria-hidden="true" style={{ top: `${String(GRASS_Y * size)}px` }} />
      <svg class="aim" aria-hidden="true" viewBox={`0 0 ${String(COLS)} ${BOARD_HEIGHT.toFixed(3)}`} width={COLS * size} height={BOARD_HEIGHT * size} data-testid="aim">
        {path && <polyline class={`aim__path aim__path--${loaded}${hint && aim === null && keyAim === null ? ' aim__path--hint' : ''}`} points={points(path.points)} />}
        {ghost && (loaded === 'bomb' || loaded === 'jar') && <circle class="aim__blast" cx={ghost.x} cy={ghost.y} r={BOMB_REACH * ROW_H + 0.5} />}
        {ghost && <circle class="aim__ghost" cx={ghost.x} cy={ghost.y} r="0.44" />}
        {flight?.kind === 'sunbeam' && <polyline key={flight.id} class="sunbeam" points={points(flight.points)} pathLength={1} style={{ animationDuration: `${String(flight.ms)}ms` }} />}
      </svg>
      <div class="buds" aria-hidden="true">
        {cells.map((bud, c) => {
          if (!bud) return null;
          const lit = beamed?.has(c) === true;
          return (
            <div
              key={bud.id}
              class={`bud${frame?.landed === c ? ' bud--landed' : ''}${frame?.changed.includes(c) ? ' bud--changed' : ''}${frame?.melted.includes(c) ? ' bud--melted' : ''}${rowOf(c) >= LAST_ROW - 2 ? ' bud--danger' : ''}${lit ? ' bud--lit' : ''}`}
              data-testid={`bud-${String(c)}`}
              data-cell={c}
              data-kind={bud.kind}
              data-colour={bud.colour}
              data-bee={bud.bee ? 'true' : undefined}
              data-honey={bud.honey ? 'true' : undefined}
              data-butterfly={bud.butterfly ? 'true' : undefined}
              style={{ transform: place(c) }}
            >
              <BudArt bud={bud} size={size} />
            </div>
          );
        })}
        {frame?.popped.map(({ bud, cell }) => (
          <div key={`pop-${String(bud.id)}`} class="bud bud--pop" style={{ transform: place(cell) }}>
            <BudArt bud={bud} size={size} />
          </div>
        ))}
        {frame?.fallen.map(({ bud, cell }) => (
          <div key={`fall-${String(bud.id)}`} class="bud bud--fall" style={{ transform: place(cell), '--drift': String(((bud.id * 37) % 9) - 4) }}>
            <BudArt bud={bud} size={size} />
          </div>
        ))}
        {freed.map(({ bud, cell }) => (
          <div key={`bee-${String(bud.id)}`} class="freebee" style={{ transform: place(cell) }}>
            <svg viewBox="0 0 100 100" width={size} height={size}>
              <use href="#bh-bee" />
            </svg>
          </div>
        ))}
        {frame?.blast && <div class="blast" style={at(frame.blast, (BOMB_REACH * 2 + 1) * ROW_H + 1)} />}
      </div>
      <div class="pipspot" aria-hidden="true" style={at({ x: SHOOTER.x - 2.35, y: SHOOTER.y + 0.05 }, 2.1)}>
        <PipArt hat={hat} size={size * 2.1} mood={danger ? 'worried' : 'happy'} class="pip--board" />
      </div>
      <div class="launcher" aria-hidden="true" style={at(SHOOTER, 1.5)}>
        <span class="launcher__cup" />
      </div>
      <div class="held" data-testid="ball-in-hand" data-kind={loaded} data-colour={round.queue[0]} aria-hidden="true" style={at(SHOOTER)}>
        {!flight && <HeldBall tool={tool} round={round} size={size} />}
      </div>
      <button
        type="button"
        class={`nextball${hint?.swap && aim === null && keyAim === null ? ' nextball--hint' : ''}`}
        data-testid="next-ball"
        data-colour={round.queue[round.bomb ? 0 : 1]}
        style={at({ x: SHOOTER.x + 1.75, y: SHOOTER.y + 0.3 }, 1.05)}
        disabled={!canSwap}
        aria-label={round.bomb ? t('play.bomb') : t('play.next', { colour: t(`colour.${COLOURS[round.queue[1]] ?? 'rose'}`) })}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={() => {
          if (canSwap) game.swapPollen();
        }}
      >
        <PollenArt colour={round.queue[round.bomb ? 0 : 1]} size={Math.round(size * 0.78)} />
        {canSwap && <span class="nextball__swap" />}
      </button>
      {flight && flight.kind !== 'sunbeam' && (
        <div ref={flyRef} key={flight.id} class="ball ball--fly" data-testid="flying-ball" style={{ transform: `translate(${String((SHOOTER.x - RADIUS) * size)}px, ${String((SHOOTER.y - RADIUS) * size)}px)` }}>
          <FlyingBall flight={flight} size={size} />
        </div>
      )}
    </div>
  );
}
