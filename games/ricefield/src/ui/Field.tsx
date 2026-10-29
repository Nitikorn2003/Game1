import type { JSX, RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Puzzle } from '../sim/fields.js';
import { lineDone } from '../sim/fields.js';
import { EMPTY, FILLED, UNKNOWN, type Axis, type LineRef } from '../sim/nonogram.js';
import { FIELD_GREEN, INKS, isInk } from '../sim/palette.js';
import type { Picture } from '../sim/pictures.js';
import type * as R from '../sim/rules.js';
import type { Field } from '../sim/state.js';
import { MARKERS, SPROUT } from './Icon.js';
import { useView } from './view.js';

/** The biggest and smallest a cell of the field gets, in pixels. */
const MAX_CELL = 56;
const MIN_CELL = 14;
/** How long the grown picture's colour takes to sweep across the field. */
const WAVE_MS = 900;

/** How big a field's cells and clues are in the space it has. */
export interface BoardSize {
  cell: number;
  /** The clue numbers' size, and the room each one takes. */
  font: number;
  step: number;
  /** The clues to the left of the rows, and above the columns. */
  rowBand: number;
  colBand: number;
}

function sizeFor(cell: number, rowRuns: number, colRuns: number): BoardSize {
  const font = Math.max(11, Math.min(17, Math.round(cell * 0.5)));
  const step = Math.round(font * 1.32);
  return { cell, font, step, rowBand: rowRuns * step + 8, colBand: colRuns * step + 6 };
}

/** The biggest cells that fit the whole field, clues and all, in the space. */
export function boardSize(space: { width: number; height: number }, puzzle: Puzzle): BoardSize {
  const { width, height } = puzzle.shape;
  const rowRuns = Math.max(1, ...puzzle.clues.rows.map((clue) => clue.length));
  const colRuns = Math.max(1, ...puzzle.clues.cols.map((clue) => clue.length));
  for (let cell = MAX_CELL; cell > MIN_CELL; cell--) {
    const size = sizeFor(cell, rowRuns, colRuns);
    if (size.rowBand + width * cell <= space.width && size.colBand + height * cell <= space.height) return size;
  }
  return sizeFor(MIN_CELL, rowRuns, colRuns);
}

/** The size of an element's content box, kept up to date as the screen changes. */
export function useContentSize(ref: RefObject<HTMLElement>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const style = getComputedStyle(el);
      const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setSize((old) => (old.width === width && old.height === height ? old : { width, height }));
    };
    measure();
    // Old WebViews have no ResizeObserver; there the window's size is all that changes.
    const Observer = (window as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (!Observer) {
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('resize', measure);
      };
    }
    const observer = new Observer(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The colour of a picture's cell once it has grown: its ink, or the ground around the picture. */
export function inkOf(picture: Picture, row: number, col: number): string {
  const letter = picture.rows[row]?.[col] ?? '.';
  if (isInk(letter)) return INKS[letter];
  return picture.ground ? INKS[picture.ground] : FIELD_GREEN;
}

/** A picture as it looks grown, as small or as big as it is needed. */
export function PictureArt(props: { picture: Picture; size: number; class?: string }): JSX.Element {
  const { picture, size } = props;
  const width = picture.rows[0]?.length ?? 1;
  const height = picture.rows.length;
  const unit = size / Math.max(width, height);
  return (
    <svg class={`picture ${props.class ?? ''}`} width={width * unit} height={height * unit} viewBox={`0 0 ${String(width)} ${String(height)}`} aria-hidden="true">
      <rect width={width} height={height} fill={picture.ground ? INKS[picture.ground] : FIELD_GREEN} />
      {picture.rows.map((row, r) =>
        row.split('').map((letter, c) => (isInk(letter) ? <rect key={`${String(r)}-${String(c)}`} x={c} y={r} width="1.02" height="1.02" fill={INKS[letter]} /> : null)),
      )}
      {/* Rows of rice plants, to give the field some grain. */}
      <path
        d={Array.from({ length: height }, (_, r) => `M0 ${String(r + 0.5)}h${String(width)}`).join('')}
        stroke="rgba(255,255,255,0.12)"
        stroke-width="0.14"
        fill="none"
      />
    </svg>
  );
}

/** A field in progress, small: the rice planted so far on its water. */
export function MiniField(props: { field: Field; puzzle: Puzzle; size: number }): JSX.Element {
  const { field, puzzle, size } = props;
  const { width, height } = puzzle.shape;
  const unit = size / Math.max(width, height);
  return (
    <svg class="mini-field" width={width * unit} height={height * unit} viewBox={`0 0 ${String(width)} ${String(height)}`} aria-hidden="true">
      <rect width={width} height={height} class="mini-field__water" />
      {field.board.map((state, cell) =>
        state === FILLED ? <rect key={cell} x={cell % width} y={Math.floor(cell / width)} width="1.02" height="1.02" class="mini-field__rice" /> : null,
      )}
    </svg>
  );
}

/** The thin lines between cells, and a thicker one every five, which help count along a line. */
function GridLines(props: { width: number; height: number }): JSX.Element {
  const { width, height } = props;
  let thin = '';
  let thick = '';
  for (let c = 1; c < width; c++) {
    if (c % 5 === 0) thick += `M${String(c)} 0V${String(height)}`;
    else thin += `M${String(c)} 0V${String(height)}`;
  }
  for (let r = 1; r < height; r++) {
    if (r % 5 === 0) thick += `M0 ${String(r)}H${String(width)}`;
    else thin += `M0 ${String(r)}H${String(width)}`;
  }
  return (
    <svg class="grid-lines" viewBox={`0 0 ${String(width)} ${String(height)}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={thin} class="grid-lines__thin" vector-effect="non-scaling-stroke" />
      <path d={thick} class="grid-lines__thick" vector-effect="non-scaling-stroke" />
      <rect width={width} height={height} class="grid-lines__edge" vector-effect="non-scaling-stroke" />
    </svg>
  );
}

/** A short light on part of the field: a finished line, a hint, a wrong move. */
interface Flash {
  id: number;
  kind: 'line' | 'hint' | 'wrong';
  line?: LineRef;
  cell?: number;
}

let flashIds = 0;

/** A drag across the field: it plants or pebbles every cell along the row or the column it started on. */
interface Stroke {
  pointer: number;
  from: number;
  last: number;
  axis: Axis | null;
  action: R.Action;
}

export interface BoardProps {
  fieldKey: R.FieldKey;
  field: Field;
  puzzle: Puzzle;
  size: BoardSize;
  action: R.Action;
  /** The field has grown, and its picture comes up in colour. */
  grown: boolean;
}

/**
 * The field: the clues above and beside it, and its cells. A tap plants or pebbles a cell, a
 * drag does a whole stretch of a row or a column, and the arrow keys move between cells.
 */
export function Board(props: BoardProps): JSX.Element {
  const { game, t, marker } = useView();
  const { fieldKey, field, puzzle, size, action, grown } = props;
  const { width, height } = puzzle.shape;
  const { cell } = size;
  const cellsRef = useRef<HTMLDivElement>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const wilted = field.hearts <= 0 && !grown;

  const flash = (items: Omit<Flash, 'id'>[]) => {
    if (items.length === 0) return;
    const added = items.map((item) => ({ ...item, id: ++flashIds }));
    setFlashes((list) => [...list.slice(-6), ...added]);
    setTimeout(() => {
      setFlashes((list) => list.filter((f) => !added.includes(f)));
    }, 900);
  };

  useEffect(
    () =>
      game.events.on('act', (e) => {
        if (e.key !== fieldKey) return;
        flash([...(e.acted.mistake ? [{ kind: 'wrong' as const, cell: e.acted.cell }] : []), ...e.acted.lines.map((line) => ({ kind: 'line' as const, line }))]);
      }),
    [game, fieldKey],
  );
  useEffect(
    () =>
      game.events.on('hint', (e) => {
        if (e.key !== fieldKey) return;
        flash([{ kind: 'hint', line: e.hinted.line }, ...e.hinted.lines.map((line) => ({ kind: 'line' as const, line }))]);
      }),
    [game, fieldKey],
  );

  const cellAt = (x: number, y: number): number | null => {
    const rect = cellsRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const c = Math.floor((x - rect.left) / cell);
    const r = Math.floor((y - rect.top) / cell);
    return c < 0 || r < 0 || c >= width || r >= height ? null : r * width + c;
  };

  /** Acts on one cell; false once the stroke should stop, after a wrong move. */
  const actOn = (at: number, how: R.Action): boolean => {
    if (field.board[at] !== UNKNOWN) return true;
    const acted = game.act(fieldKey, at, how);
    return acted === null || !acted.mistake;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (grown || wilted || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const at = cellAt(e.clientX, e.clientY);
    if (at === null) return;
    e.preventDefault();
    cellsRef.current?.setPointerCapture(e.pointerId);
    setFocus(at);
    strokeRef.current = actOn(at, action) ? { pointer: e.pointerId, from: at, last: at, axis: null, action } : null;
  };

  const onPointerMove = (e: PointerEvent) => {
    const st = strokeRef.current;
    if (!st || st.pointer !== e.pointerId) return;
    const at = cellAt(e.clientX, e.clientY);
    if (at === null || at === st.last) return;
    const fr = Math.floor(st.from / width);
    const fc = st.from % width;
    const r = Math.floor(at / width);
    const c = at % width;
    // The stroke keeps to the line it first moved along.
    st.axis ??= Math.abs(c - fc) >= Math.abs(r - fr) ? 'row' : 'col';
    const target = st.axis === 'row' ? fr * width + c : r * width + fc;
    const stepBy = st.axis === 'row' ? 1 : width;
    const dir = Math.sign(target - st.last);
    if (dir === 0) return;
    for (let next = st.last + dir * stepBy; dir > 0 ? next <= target : next >= target; next += dir * stepBy) {
      st.last = next;
      setFocus(next);
      if (!actOn(next, st.action)) {
        strokeRef.current = null;
        return;
      }
    }
  };

  const endStroke = () => {
    strokeRef.current = null;
  };

  const focusCell = (at: number) => {
    setFocus(at);
    cellsRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${String(at)}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, at: number) => {
    const r = Math.floor(at / width);
    const c = at % width;
    const moves: Record<string, number | undefined> = {
      ArrowLeft: c > 0 ? at - 1 : undefined,
      ArrowRight: c < width - 1 ? at + 1 : undefined,
      ArrowUp: r > 0 ? at - width : undefined,
      ArrowDown: r < height - 1 ? at + width : undefined,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = moves[e.key];
    if (next !== undefined) focusCell(next);
  };

  const here = focus ?? 0;
  const focusRow = focus === null ? -1 : Math.floor(focus / width);
  const focusCol = focus === null ? -1 : focus % width;
  const px = (n: number) => `${String(n)}px`;

  const stateName = (state: number) => (state === FILLED ? t('cell.rice') : state === EMPTY ? t('cell.pebble') : t('cell.unknown'));

  return (
    <div
      class={`board${grown ? ' board--grown' : ''}${wilted ? ' board--wilted' : ''}`}
      data-testid="board"
      data-width={width}
      data-height={height}
      style={{
        '--cell': px(cell),
        '--cols': String(width),
        '--clue': px(size.font),
        '--step': px(size.step),
        gridTemplateColumns: `${px(size.rowBand)} ${px(width * cell)}`,
        gridTemplateRows: `${px(size.colBand)} ${px(height * cell)}`,
      }}
    >
      <svg class="board__symbols" width="0" height="0" aria-hidden="true">
        <defs>
          <symbol id="rf-sprout" viewBox="0 0 24 24">
            {SPROUT}
          </symbol>
          <symbol id="rf-marker" viewBox="0 0 24 24">
            {MARKERS[marker]}
          </symbol>
        </defs>
      </svg>
      <div class="board__corner" aria-hidden="true" />
      <div class="clues clues--cols" aria-hidden="true">
        {puzzle.clues.cols.map((clue, c) => (
          <div key={c} class={`clue${lineDone(puzzle, field.board, { axis: 'col', index: c }) ? ' clue--done' : ''}${c === focusCol ? ' clue--here' : ''}`} data-testid={`clue-col-${String(c)}`}>
            {(clue.length > 0 ? clue : [0]).map((n, i) => (
              <span key={i}>{n}</span>
            ))}
          </div>
        ))}
      </div>
      <div class="clues clues--rows" aria-hidden="true">
        {puzzle.clues.rows.map((clue, r) => (
          <div key={r} class={`clue${lineDone(puzzle, field.board, { axis: 'row', index: r }) ? ' clue--done' : ''}${r === focusRow ? ' clue--here' : ''}`} data-testid={`clue-row-${String(r)}`}>
            {(clue.length > 0 ? clue : [0]).map((n, i) => (
              <span key={i}>{n}</span>
            ))}
          </div>
        ))}
      </div>
      <div
        class="cells"
        ref={cellsRef}
        role="group"
        aria-label={t('play.board', { width, height })}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onLostPointerCapture={endStroke}
      >
        {field.board.map((state, at) => {
          const r = Math.floor(at / width);
          const c = at % width;
          const wrong = field.wrong.includes(at);
          // The colour sweeps across from the top left corner in under a second, whatever the field's size.
          const style = grown ? { '--ink': inkOf(puzzle.picture, r, c), '--wave': `${String(Math.round(((r + c) / Math.max(1, width + height - 2)) * WAVE_MS))}ms` } : undefined;
          return (
            <button
              type="button"
              key={at}
              class={`cell cell--${state === FILLED ? 'rice' : state === EMPTY ? 'pebble' : 'open'}${wrong ? ' cell--wrong' : ''}`}
              style={style}
              data-cell={at}
              data-testid={`cell-${String(at)}`}
              data-state={state}
              tabIndex={at === here ? 0 : -1}
              aria-label={t('cell.label', { row: r + 1, col: c + 1, state: stateName(state) })}
              onFocus={() => {
                setFocus(at);
              }}
              onKeyDown={(e) => {
                onKeyDown(e, at);
              }}
              onClick={(e) => {
                // Taps and drags are handled as pointer events; a click with no pointer is a key.
                if (e.detail === 0 && !grown && !wilted) actOn(at, action);
              }}
            >
              {state === FILLED && (
                <svg class="cell__glyph" viewBox="0 0 24 24" aria-hidden="true">
                  <use href="#rf-sprout" />
                </svg>
              )}
              {state === EMPTY && (
                <svg class="cell__glyph cell__glyph--marker" viewBox="0 0 24 24" aria-hidden="true">
                  <use href="#rf-marker" />
                </svg>
              )}
            </button>
          );
        })}
        <GridLines width={width} height={height} />
        {focus !== null && !grown && (
          <>
            <div class="cross" style={{ top: px(focusRow * cell), height: px(cell), left: 0, right: 0 }} />
            <div class="cross" style={{ left: px(focusCol * cell), width: px(cell), top: 0, bottom: 0 }} />
          </>
        )}
        {flashes.map((f) =>
          f.line ? (
            <div
              key={f.id}
              class={`flash flash--${f.kind}`}
              style={
                f.line.axis === 'row'
                  ? { top: px(f.line.index * cell), height: px(cell), left: 0, right: 0 }
                  : { left: px(f.line.index * cell), width: px(cell), top: 0, bottom: 0 }
              }
            />
          ) : (
            <div
              key={f.id}
              class={`flash flash--${f.kind}`}
              style={{ left: px(((f.cell ?? 0) % width) * cell), top: px(Math.floor((f.cell ?? 0) / width) * cell), width: px(cell), height: px(cell) }}
            />
          ),
        )}
      </div>
    </div>
  );
}
