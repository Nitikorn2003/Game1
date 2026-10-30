import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { PASTRIES } from '../sim/counter.js';
import { RACK, TRAY, hidden, shut, takeable, uncovered, type Level, type Round } from '../sim/round.js';
import * as R from '../sim/rules.js';
import { PastryArt } from './art.js';
import { EDGE, RIM, geometryOf, reducedMotion, type Spot } from './layout.js';
import { useView } from './view.js';

/** How long a pastry takes to fly to its place, and a set of three to box up once its last pastry lands. */
const FLY_MS = 230;
const BOX_MS = 430;
/** How long the rolling pin takes to roll the counter. */
const ROLL_MS = 560;
/** A player who has not taken a pastry for this long is shown one to take. */
const HINT_MS = 9000;
/** How long a tile shakes when it cannot be taken. */
const NOPE_MS = 320;

/** Tiles boxed up a moment ago, shown where they were boxed up until they have gone. */
interface Ghost {
  id: number;
  tiles: readonly number[];
  kinds: readonly number[];
  /** Where on the tray they boxed up, or null for a set the whisk whipped up above it. */
  at: number | null;
}

export interface TableProps {
  level: Level;
  round: Round;
  space: { width: number; height: number };
  /** No taking while a sheet is open or the round is over. */
  disabled: boolean;
  /** Called once what a take or a tool did has played out, and the table shows the round as it is. */
  onRest: () => void;
}

/** The counter with its tiles, the cooling rack and the tray: every tile in one place, so a pastry can fly from one to another. */
export function Table(props: TableProps): JSX.Element {
  const { game, s, t } = useView();
  const { level, round: r, disabled } = props;
  const g = geometryOf(props.space, level.slots);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [rolling, setRolling] = useState(0);
  const [moving, setMoving] = useState(false);
  const [nope, setNope] = useState<number | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const ghostsRef = useRef(0);
  // The latest round and callback, for the events and timers.
  const onRestRef = useRef(props.onRest);
  const roundRef = useRef(r);
  useEffect(() => {
    onRestRef.current = props.onRest;
    roundRef.current = props.round;
  });

  useEffect(() => {
    const quick = () => reducedMotion();
    const later = (ms: number, run: () => void) => {
      timersRef.current.push(window.setTimeout(run, ms));
    };
    const settle = (ms: number) => {
      for (const id of timersRef.current) clearTimeout(id);
      timersRef.current = [];
      setMoving(true);
      setHint(null);
      later(ms, () => {
        setMoving(false);
        setGhost(null);
        setRolling(0);
        onRestRef.current();
      });
    };
    const offTook = game.events.on('took', ({ take }) => {
      const fly = quick() ? 40 : FLY_MS;
      if (take.set) {
        ghostsRef.current += 1;
        setGhost({ id: ghostsRef.current, tiles: take.set, kinds: take.set.map((tile) => roundRef.current.kinds[tile] ?? 0), at: take.slot - 2 });
        settle(fly + (quick() ? 60 : BOX_MS));
      } else {
        setGhost(null);
        settle(fly);
      }
    });
    const offTool = game.events.on('tool', (use) => {
      if (use.whisk) {
        ghostsRef.current += 1;
        setGhost({ id: ghostsRef.current, tiles: use.whisk.set, kinds: use.whisk.set.map(() => use.whisk?.kind ?? 0), at: null });
        settle((quick() ? 40 : FLY_MS * 1.6) + (quick() ? 60 : BOX_MS));
      } else if (use.tool === 'rollingpin') {
        setGhost(null);
        setRolling((n) => n + 1);
        settle(quick() ? 80 : ROLL_MS);
      } else {
        setGhost(null);
        settle(quick() ? 40 : FLY_MS);
      }
    });
    const offRoom = game.events.on('room', () => {
      setGhost(null);
      settle(quick() ? 40 : FLY_MS * 1.4);
    });
    return () => {
      offTook();
      offTool();
      offRoom();
      for (const id of timersRef.current) clearTimeout(id);
    };
  }, [game]);

  // A pastry to take, shown after a while without one.
  const version = `${String(s.stats.taken)}:${String(s.stats.toolsUsed)}:${String(r.continues)}`;
  useEffect(() => {
    setHint(null);
    if (moving || disabled) return undefined;
    const id = window.setTimeout(() => {
      setHint(R.hintTile(game.state));
    }, HINT_MS);
    return () => {
      clearTimeout(id);
    };
  }, [game, version, moving, disabled]);

  const free = uncovered(r, level);
  const can = takeable(r, level);
  // The tray as it is shown: a set boxing up keeps its places until it has gone.
  const shownTray: number[] = [...r.tray];
  if (ghost?.at !== null && ghost !== null) shownTray.splice(Math.max(0, Math.min(shownTray.length, ghost.at)), 0, ...ghost.tiles);
  const trayPlace = new Map(shownTray.map((tile, i) => [tile, i]));
  const rackPlace = new Map(r.rack.map((tile, i) => [tile, i]));
  const ghostOf = new Map((ghost?.tiles ?? []).map((tile, k) => [tile, k]));

  const spotOf = (tile: number): Spot | null => {
    const k = ghostOf.get(tile);
    if (k !== undefined && ghost) return ghost.at === null ? g.whisked(k) : g.onTray(trayPlace.get(tile) ?? 0);
    switch (r.at[tile]) {
      case 'counter': {
        const slot = level.slots[tile];
        return slot ? g.onCounter(slot) : null;
      }
      case 'tray':
        return g.onTray(trayPlace.get(tile) ?? 0);
      case 'rack':
        return g.onRack(rackPlace.get(tile) ?? 0);
      default:
        return null;
    }
  };

  const tap = (tile: number) => {
    if (disabled) return;
    if (!game.take(tile)) {
      setNope(tile);
      window.setTimeout(() => {
        setNope((n) => (n === tile ? null : n));
      }, NOPE_MS);
    }
  };

  const tiles = r.at.flatMap((_, tile) => {
    const spot = spotOf(tile);
    return spot ? [{ tile, spot }] : [];
  });

  return (
    <div
      class={`table${rolling > 0 ? ' table--rolling' : ''}${disabled ? ' table--off' : ''}`}
      data-testid="table"
      data-busy={moving ? 'true' : 'false'}
      style={{ width: `${String(g.width)}px`, height: `${String(g.height)}px`, '--t': `${String(g.tile)}px` }}
    >
      <div class="counter" aria-hidden="true" style={boxStyle(g.counter.x - RIM, g.counter.y - RIM, g.counter.w + 2 * RIM, g.counter.h + 2 * RIM)} />
      <div class={`rack${r.rack.length > 0 ? ' rack--used' : ''}`} data-testid="rack" data-count={r.rack.length} style={boxStyle(g.rack.x, g.rack.y, g.rack.w, g.rack.h)}>
        {g.rack.places.map((x, i) => (
          <span key={i} class="rack__place" style={boxStyle(x - g.rack.x, 8, g.rack.tile, g.rack.tile)} />
        ))}
        {r.rack.length === 0 && <span class="rack__label">{t('play.rack', { n: RACK })}</span>}
      </div>
      <div class={`tray${R.isStuck(s) ? ' tray--full' : ''}`} data-testid="tray" data-count={r.tray.length} style={boxStyle(g.tray.x, g.tray.y, g.tray.w, g.tray.h)} role="img" aria-label={t('play.tray', { n: r.tray.length, of: TRAY })}>
        {g.tray.places.map((x, i) => (
          <span key={i} class={`tray__place${i >= TRAY - 2 ? ' tray__place--warn' : ''}`} style={boxStyle(x - g.tray.x, 8, g.tray.tile, g.tray.tile)} />
        ))}
      </div>
      <div class="tiles">
        {tiles.map(({ tile, spot }) => {
          const place = r.at[tile] ?? 'gone';
          const k = ghostOf.get(tile);
          const boxing = k !== undefined;
          const kind = boxing ? (ghost?.kinds[k] ?? 0) : (r.kinds[tile] ?? 0);
          const onCounter = place === 'counter' && !boxing;
          const covered = onCounter && !(free[tile] ?? false);
          const bag = onCounter && hidden(r, level, tile, free);
          const box = onCounter && shut(r, level, tile) && !(can[tile] ?? false) ? (level.locks[tile] ?? 0) - r.sets : 0;
          const takes = !boxing && !disabled && (place === 'rack' || (onCounter && (can[tile] ?? false)));
          const name = t(`pastry.${PASTRIES[kind] ?? 'donut'}`);
          const label = bag
            ? t('tile.bag')
            : box > 0
              ? t('tile.box', { name, n: box })
              : covered
                ? t('tile.covered', { name })
                : place === 'tray'
                  ? t('tile.onTray', { name })
                  : place === 'rack'
                    ? t('tile.onRack', { name })
                    : name;
          return (
            <button
              key={`t${String(tile)}`}
              type="button"
              class={`tile tile--${boxing ? 'boxing' : place}${covered ? ' tile--covered' : ''}${box > 0 ? ' tile--boxed' : ''}${takes ? ' tile--takes' : ''}${hint === tile ? ' tile--hint' : ''}${nope === tile ? ' tile--nope' : ''}${boxing && ghost?.at === null ? ' tile--whisked' : ''}`}
              data-testid={`tile-${String(tile)}`}
              data-place={boxing ? 'boxing' : place}
              data-kind={bag ? 'hidden' : String(kind)}
              data-index={boxing ? undefined : place === 'tray' ? trayPlace.get(tile) : place === 'rack' ? rackPlace.get(tile) : undefined}
              data-free={takes ? 'true' : 'false'}
              data-box={box > 0 ? String(box) : undefined}
              style={{
                transform: `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) scale(${spot.scale.toFixed(4)})`,
                zIndex: spot.z,
                // The three squeeze toward the middle one, once the last of them has landed.
                ...(boxing ? { '--k': String(k - 1) } : {}),
                ...(boxing && ghost?.at !== null ? { '--delay': `${String(reducedMotion() ? 40 : FLY_MS)}ms` } : {}),
              }}
              tabIndex={takes ? 0 : -1}
              aria-label={label}
              aria-disabled={!takes}
              onClick={() => {
                if (!boxing && place !== 'tray') tap(tile);
              }}
            >
              <span class="tile__edge" />
              <span class={`tile__face${level.sprinkles[tile] ? ' tile__face--sprinkled' : ''}`}>
                {level.sprinkles[tile] && (
                  <svg class="tile__sprinkles" viewBox="0 0 100 100" aria-hidden="true">
                    <use href="#cl-sprinkles" />
                  </svg>
                )}
                {bag ? (
                  <svg class="tile__bag" viewBox="0 0 100 100" aria-hidden="true">
                    <use href="#cl-bag" />
                  </svg>
                ) : (
                  <PastryArt kind={kind} size={Math.round(g.tile * 0.78)} class={`tile__art${rolling > 0 && onCounter ? ' tile__art--roll' : ''}`} />
                )}
                {box > 0 && (
                  <>
                    <svg class="tile__ribbon" viewBox="0 0 100 100" aria-hidden="true">
                      <use href="#cl-ribbon" />
                    </svg>
                    <span class="tile__lock">{box}</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
        {ghost && (
          <span
            key={`box${String(ghost.id)}`}
            class="boxed"
            aria-hidden="true"
            style={{
              ...boxStyle(...boxedAt(ghost.at === null ? g.whisked(1) : g.onTray(Math.max(0, ghost.at) + 1), g.tile)),
              animationDelay: `${String(reducedMotion() ? 40 : ghost.at === null ? FLY_MS * 1.6 : FLY_MS)}ms`,
            }}
          >
            <svg viewBox="0 0 100 100">
              <use href="#cl-box" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

function boxStyle(x: number, y: number, w: number, h: number): Record<string, string> {
  return { left: `${x.toFixed(1)}px`, top: `${y.toFixed(1)}px`, width: `${w.toFixed(1)}px`, height: `${h.toFixed(1)}px` };
}

/** Where the pastry box of a set shows: over the middle tile of the three. */
function boxedAt(spot: Spot, tile: number): [number, number, number, number] {
  const size = tile * spot.scale;
  return [spot.x, spot.y - size * 0.1, size, size * (1 + EDGE)];
}
