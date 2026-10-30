import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { PEARL, TURTLE, adjacent, crawlTo, exitsOf, xOf, yOf, type Blast, type Board as BoardState, type Move, type Piece } from '../sim/board.js';
import type { Tool } from '../sim/content.js';
import type { Dive, Level, Step } from '../sim/dive.js';
import { turtleGoal } from '../sim/dive.js';
import * as R from '../sim/rules.js';
import { KelpArt, PieceArt, RockArt } from './art.js';
import { reducedMotion } from './layout.js';
import { useView } from './view.js';

/** How long each part of a move shows, in milliseconds, one after another. */
const TIMES: Readonly<Record<Step['kind'], number>> = { swap: 180, clear: 300, fall: 280, save: 520, shuffle: 520 };
/** A swap that does nothing: the two pieces lean in and go back. */
const BOUNCE_MS = 300;
/** A player who has not moved for this long is shown a swap that works. */
const HINT_MS = 7000;

/** What the board shows at one moment: a step of a move as it plays out, or the dive at rest. */
interface Frame {
  kind: Step['kind'] | 'rest';
  pieces: readonly (Piece | null)[];
  sand: readonly number[];
  rock: readonly number[];
  kelp: readonly number[];
  /** Pieces new in this frame, by id, and how many cells above their place they fall in from. */
  drops: ReadonlyMap<number, number>;
  /** Pieces cleared in this frame, shown as they pop. */
  popped: readonly { piece: Piece; cell: number }[];
  blasts: readonly Blast[];
  /** Special pieces made in this frame. */
  made: readonly number[];
  /** Turtles leaving the board, from these cells. */
  saved: readonly { piece: Piece; cell: number }[];
}

const NO_DROPS: ReadonlyMap<number, number> = new Map();

function restFrame(b: BoardState): Frame {
  return { kind: 'rest', pieces: b.pieces, sand: b.sand, rock: b.rock, kelp: b.kelp, drops: NO_DROPS, popped: [], blasts: [], made: [], saved: [] };
}

/** New pieces fall in as a column from above the board, each to its own place. */
function dropsOf(b: Pick<BoardState, 'width' | 'height' | 'open'>, before: readonly (Piece | null)[], after: readonly (Piece | null)[]): Map<number, number> {
  const had = new Set(before.flatMap((piece) => (piece ? [piece.id] : [])));
  const drops = new Map<number, number>();
  for (let x = 0; x < b.width; x++) {
    const fresh: { id: number; y: number }[] = [];
    let top = b.height;
    for (let y = 0; y < b.height; y++) {
      const cell = y * b.width + x;
      if (b.open[cell]) top = Math.min(top, y);
      const piece = after[cell];
      if (piece && !had.has(piece.id)) fresh.push({ id: piece.id, y });
    }
    fresh.forEach(({ id, y }, i) => drops.set(id, y - (top - fresh.length + i)));
  }
  return drops;
}

function frameOf(b: BoardState, step: Step, before: readonly (Piece | null)[]): Frame {
  return {
    kind: step.kind,
    pieces: step.pieces,
    sand: step.sand,
    rock: step.rock,
    kelp: step.kelp,
    drops: step.kind === 'fall' ? dropsOf(b, before, step.pieces) : NO_DROPS,
    popped: step.cleared?.popped ?? [],
    blasts: step.cleared?.blasts ?? [],
    made: step.cleared?.made ?? [],
    saved: step.saved.flatMap((cell) => {
      const piece = before[cell];
      return piece ? [{ piece, cell }] : [];
    }),
  };
}

type Dir = 'up' | 'down' | 'left' | 'right';

/** The cell a swipe from a cell reaches: a neighbour, or for a turtle crawling down, the next cell below past a gap. */
function targetOf(b: BoardState, cell: number, dir: Dir): number | null {
  const x = xOf(b, cell);
  switch (dir) {
    case 'left':
      return x > 0 && b.open[cell - 1] ? cell - 1 : null;
    case 'right':
      return x < b.width - 1 && b.open[cell + 1] ? cell + 1 : null;
    case 'down':
      if (b.pieces[cell]?.kind === TURTLE) return crawlTo(b, cell);
      return cell + b.width < b.pieces.length && b.open[cell + b.width] ? cell + b.width : null;
    case 'up': {
      if (cell - b.width >= 0 && b.open[cell - b.width]) return cell - b.width;
      // A turtle above a gap may crawl down past it into this cell.
      for (let c = cell - b.width; c >= 0; c -= b.width) if (b.open[c]) return b.pieces[c]?.kind === TURTLE && crawlTo(b, c) === cell ? c : null;
      return null;
    }
  }
}

/** Whether a second tap on `to` after `from` swaps them: neighbours, or a turtle and the cell it crawls to. */
function pairs(b: BoardState, from: number, to: number): boolean {
  if (adjacent(b, from, to)) return true;
  const top = Math.min(from, to);
  return b.pieces[top]?.kind === TURTLE && crawlTo(b, top) === Math.max(from, to);
}

export interface BoardProps {
  level: Level;
  dive: Dive;
  cell: number;
  /** A tool chosen from the bag, waiting for a cell. */
  tool: Tool | null;
  onToolUsed: () => void;
  /** Called once a move has played out on the board, and it shows the dive as it is again. */
  onRest: () => void;
  /** No moves while a sheet is open, or the dive is out of moves. */
  disabled: boolean;
}

export function Board(props: BoardProps): JSX.Element {
  const { game, s, t } = useView();
  const { level, dive, cell, tool, disabled } = props;
  const b = dive.board;
  const [frame, setFrame] = useState<Frame | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [bounce, setBounce] = useState<Move | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [pressedRow, setPressedRow] = useState<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const pressRef = useRef<{ cell: number; x: number; y: number; id: number; swiped: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The latest callback, for the timer that ends a move.
  const onRestRef = useRef(props.onRest);
  useEffect(() => {
    onRestRef.current = props.onRest;
  });
  const busy = frame !== null;
  const shown = frame ?? restFrame(b);

  useEffect(
    () => () => {
      for (const id of timersRef.current) clearTimeout(id);
    },
    [],
  );

  useEffect(
    () =>
      game.events.on('move', (e) => {
        for (const id of timersRef.current) clearTimeout(id);
        timersRef.current = [];
        const quick = reducedMotion();
        let at = 0;
        // A move starts with a swap or a clear, which bring in no new pieces and send off no turtles.
        let before = e.played.steps[0]?.pieces ?? [];
        const frames = e.played.steps.map((step) => {
          const f = frameOf(b, step, before);
          before = step.pieces;
          return f;
        });
        frames.forEach((f, i) => {
          if (i === 0) setFrame(f);
          else
            timersRef.current.push(
              window.setTimeout(() => {
                setFrame(f);
              }, at),
            );
          at += quick ? 60 : TIMES[f.kind === 'rest' ? 'swap' : f.kind];
        });
        timersRef.current.push(
          window.setTimeout(() => {
            setFrame(null);
            onRestRef.current();
          }, at),
        );
        setSelected(null);
        setHint(null);
      }),
    // The board of a dive is the same object all through it.
    [game, b],
  );

  // A swap that works, shown after a while without a move.
  const version = `${String(dive.movesMade)}:${String(s.stats.toolsUsed)}:${String(dive.continues)}`;
  useEffect(() => {
    setHint(null);
    if (busy || disabled) return undefined;
    const id = window.setTimeout(() => {
      setHint(R.hintMove(game.state));
    }, HINT_MS);
    return () => {
      clearTimeout(id);
    };
  }, [game, version, busy, disabled]);

  const tryMove = (from: number, to: number) => {
    setSelected(null);
    setHint(null);
    if (busy || disabled) return;
    if (tool === 'crab') {
      if (game.playTool({ tool: 'crab', from, to })) props.onToolUsed();
      return;
    }
    if (game.swap(from, to)) return;
    // Nothing matched: the pieces lean in and go back.
    setBounce({ from, to });
    timersRef.current.push(
      window.setTimeout(() => {
        setBounce(null);
      }, BOUNCE_MS),
    );
  };

  const toolAt = (at: number) => {
    if (busy || disabled) return;
    if (tool === 'claw') {
      if (game.playTool({ tool: 'claw', cell: at })) props.onToolUsed();
    } else if (tool === 'tide') {
      if (game.playTool({ tool: 'tide', row: yOf(b, at) })) props.onToolUsed();
    }
  };

  /** A tap: a tool's cell, or a piece picked, or the second of two pieces to swap. */
  const tap = (at: number) => {
    if (tool === 'claw' || tool === 'tide') {
      toolAt(at);
      return;
    }
    if (selected !== null && selected !== at && pairs(b, selected, at)) tryMove(selected, at);
    else setSelected(selected === at || !b.pieces[at] ? null : at);
  };

  const cellAt = (clientX: number, clientY: number): number | null => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.floor((clientX - rect.left) / cell);
    const y = Math.floor((clientY - rect.top) / cell);
    if (x < 0 || y < 0 || x >= b.width || y >= b.height) return null;
    const at = y * b.width + x;
    return b.open[at] ? at : null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (busy || disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const at = cellAt(e.clientX, e.clientY);
    if (at === null) return;
    setHint(null);
    pressRef.current = { cell: at, x: e.clientX, y: e.clientY, id: e.pointerId, swiped: false };
    if (tool === 'tide') setPressedRow(yOf(b, at));
    rootRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    const press = pressRef.current;
    if (!press || press.swiped || press.id !== e.pointerId || tool === 'claw' || tool === 'tide') return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    const far = cell * 0.32;
    if (Math.abs(dx) < far && Math.abs(dy) < far) return;
    press.swiped = true;
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    const to = targetOf(b, press.cell, dir);
    if (to !== null) tryMove(press.cell, to);
  };

  const onPointerUp = (e: PointerEvent) => {
    const press = pressRef.current;
    pressRef.current = null;
    setPressedRow(null);
    if (!press || press.id !== e.pointerId || press.swiped) return;
    tap(press.cell);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const dirs: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const dir = dirs[e.key];
    const at = cursor ?? b.open.findIndex((open) => open);
    if (dir) {
      e.preventDefault();
      if (selected !== null && tool !== 'claw' && tool !== 'tide') {
        const to = targetOf(b, selected, dir);
        if (to !== null) tryMove(selected, to);
        return;
      }
      // The first arrow shows the cursor; the next ones move it to the next cell that way, past any gap.
      if (cursor === null) {
        setCursor(at);
        return;
      }
      const step = dir === 'up' ? -b.width : dir === 'down' ? b.width : dir === 'left' ? -1 : 1;
      for (let c = at + step; c >= 0 && c < b.pieces.length; c += step) {
        if ((dir === 'left' || dir === 'right') && yOf(b, c) !== yOf(b, at)) break;
        if (b.open[c]) {
          setCursor(c);
          break;
        }
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setCursor(at);
      tap(at);
    } else if (e.key === 'Escape' && selected !== null) {
      // Lets go of the piece only: the same key with nothing picked goes home.
      e.preventDefault();
      e.stopPropagation();
      setSelected(null);
    }
  };

  const exits = turtleGoal(level) > 0 ? new Set(exitsOf(b)) : new Set<number>();
  const at = (c: number) => ({ left: xOf(b, c) * cell, top: yOf(b, c) * cell });
  /** How far a piece of a swap that did nothing leans towards the other, in cells. */
  const leanOf = (c: number): { x: number; y: number } | null => {
    const other = !bounce ? null : bounce.from === c ? bounce.to : bounce.to === c ? bounce.from : null;
    return other === null ? null : { x: (xOf(b, other) - xOf(b, c)) * 0.22, y: (yOf(b, other) - yOf(b, c)) * 0.22 };
  };
  const hinted = (c: number) => hint !== null && (hint.from === c || hint.to === c);
  const cursorCell = cursor !== null && b.open[cursor] ? cursor : null;

  return (
    <div
      ref={rootRef}
      class={`board board--${shown.kind}${tool ? ` board--tool board--${tool}` : ''}${disabled ? ' board--off' : ''}`}
      data-testid="board"
      data-width={b.width}
      data-height={b.height}
      data-busy={busy ? 'true' : 'false'}
      style={{ width: `${String(b.width * cell)}px`, height: `${String(b.height * cell)}px`, '--cell': `${String(cell)}px` }}
      role="application"
      aria-label={t('board.label', { width: b.width, height: b.height })}
      aria-describedby="board-help"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        pressRef.current = null;
        setPressedRow(null);
      }}
      onKeyDown={onKeyDown}
    >
      <p id="board-help" class="sr-only">
        {t('board.help')}
      </p>
      <div class="cells" aria-hidden="true">
        {b.open.map((open, c) =>
          open ? (
            <div
              key={c}
              class={`cell${(xOf(b, c) + yOf(b, c)) % 2 ? ' cell--odd' : ''}${(shown.sand[c] ?? 0) > 0 ? ` cell--sand${String(shown.sand[c])}` : ''}${exits.has(c) ? ' cell--exit' : ''}${pressedRow === yOf(b, c) ? ' cell--row' : ''}`}
              data-testid={`cell-${String(c)}`}
              data-sand={shown.sand[c] ?? 0}
              style={at(c)}
            />
          ) : null,
        )}
      </div>
      <div class="pieces" aria-hidden="true">
        {shown.pieces.map((piece, c) => {
          if (!piece) return null;
          const drop = shown.drops.get(piece.id);
          const lean = leanOf(c);
          return (
            <div
              key={piece.id}
              class={`pc pc--k${String(piece.kind)}${drop !== undefined ? ' pc--new' : ''}${selected === c ? ' pc--picked' : ''}${hinted(c) ? ' pc--hint' : ''}${lean ? ' pc--bounce' : ''}${shown.made.includes(c) ? ' pc--made' : ''}${piece.special !== 0 || piece.kind === PEARL ? ' pc--special' : ''}`}
              data-cell={c}
              data-kind={piece.kind}
              data-special={piece.special}
              style={{
                transform: `translate(${String(xOf(b, c) * cell)}px, ${String(yOf(b, c) * cell)}px)`,
                ...(drop !== undefined ? { '--drop': String(drop) } : {}),
                ...(lean ? { '--lean-x': String(lean.x), '--lean-y': String(lean.y) } : {}),
              }}
            >
              <PieceArt kind={piece.kind} special={piece.special} size={cell} />
            </div>
          );
        })}
        {shown.popped.map(({ piece, cell: c }) => (
          <div key={`pop-${String(piece.id)}`} class="pc pc--pop" style={{ transform: `translate(${String(xOf(b, c) * cell)}px, ${String(yOf(b, c) * cell)}px)` }}>
            <PieceArt kind={piece.kind} special={piece.special} size={cell} />
          </div>
        ))}
        {shown.saved.map(({ piece, cell: c }) => (
          <div key={`saved-${String(piece.id)}`} class="pc pc--saved" style={{ transform: `translate(${String(xOf(b, c) * cell)}px, ${String(yOf(b, c) * cell)}px)` }}>
            <PieceArt kind={TURTLE} size={cell} />
          </div>
        ))}
      </div>
      <div class="blockers" aria-hidden="true">
        {shown.rock.map((hits, c) =>
          hits > 0 ? (
            <div key={`rock-${String(c)}`} class="rock" data-testid={`rock-${String(c)}`} data-hits={hits} style={at(c)}>
              <RockArt hits={hits} />
            </div>
          ) : null,
        )}
        {shown.kelp.map((kelp, c) =>
          kelp > 0 ? (
            <div key={`kelp-${String(c)}`} class="kelp" data-testid={`kelp-${String(c)}`} style={at(c)}>
              <KelpArt />
            </div>
          ) : null,
        )}
      </div>
      <div class="blasts" aria-hidden="true">
        {shown.blasts.map((blast, i) => (
          <BlastMark key={`${String(i)}-${blast.kind}-${String(blast.cell)}`} blast={blast} b={b} cell={cell} />
        ))}
      </div>
      {cursorCell !== null && <div class="cursor" style={at(cursorCell)} />}
    </div>
  );
}

function BlastMark(props: { blast: Blast; b: BoardState; cell: number }): JSX.Element {
  const { blast, b, cell } = props;
  const x = xOf(b, blast.cell);
  const y = yOf(b, blast.cell);
  switch (blast.kind) {
    case 'row':
      return <div class="beam beam--row" style={{ top: `${String(y * cell)}px`, height: `${String(cell)}px` }} />;
    case 'col':
      return <div class="beam beam--col" style={{ left: `${String(x * cell)}px`, width: `${String(cell)}px` }} />;
    case 'bomb': {
      const size = (blast.radius * 2 + 1) * cell;
      return <div class="ring" style={{ left: `${String((x - blast.radius) * cell)}px`, top: `${String((y - blast.radius) * cell)}px`, width: `${String(size)}px`, height: `${String(size)}px` }} />;
    }
    case 'colour':
    case 'all':
      return <div class={`flash flash--${blast.kind}`} style={{ left: `${String(x * cell)}px`, top: `${String(y * cell)}px` }} />;
  }
}
