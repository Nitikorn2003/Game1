import { Rng } from '@game1/engine';
import type { JSX } from 'preact';
import { STOPS_PER_CANAL, type Scene } from '../sim/content.js';
import { Icon } from './Icon.js';

interface Ripple {
  x: number;
  y: number;
  w: number;
  delay: number;
}

interface Pad {
  x: number;
  y: number;
  r: number;
  /** Where the notch of the leaf points, in radians. */
  turn: number;
}

interface Light {
  y: number;
  delay: number;
  duration: number;
}

/** The same water every time, so the canal does not jump between screens. */
const rng = new Rng(20261029);
const RIPPLES: readonly Ripple[] = Array.from({ length: 34 }, () => ({ x: rng.next() * 96, y: rng.next() * 196, w: 4 + rng.next() * 6, delay: rng.next() * 8 }));
const PADS: readonly Pad[] = [
  { x: 6, y: 20, r: 10, turn: 0.6 },
  { x: 97, y: 64, r: 12, turn: 2.6 },
  { x: 3, y: 128, r: 9, turn: 5.4 },
  { x: 95, y: 176, r: 11, turn: 3.6 },
  { x: 14, y: 194, r: 7, turn: 1.4 },
];
const LIGHTS: readonly Light[] = Array.from({ length: 9 }, (_, i) => ({ y: 8 + i * 10.5 + rng.next() * 4, delay: -rng.next() * 60, duration: 46 + rng.next() * 30 }));

/** A lily pad: a circle with a notch cut to its middle. */
function padPath(p: Pad): string {
  const a = p.turn - 0.32;
  const b = p.turn + 0.32;
  const at = (angle: number) => `${(p.x + p.r * Math.cos(angle)).toFixed(2)} ${(p.y + p.r * Math.sin(angle)).toFixed(2)}`;
  return `M${p.x.toFixed(2)} ${p.y.toFixed(2)}L${at(b)}A${String(p.r)} ${String(p.r)} 0 1 1 ${at(a)}Z`;
}

/** The canal water behind everything, in the scene the player chose. */
export function SceneBackdrop(props: { scene: Scene }): JSX.Element {
  const { scene } = props;
  return (
    <div class={`backdrop backdrop--${scene}`} aria-hidden="true">
      {scene === 'sunset' && <div class="sun-glow" />}
      {/* As tall as a phone, and cropped to the screen, so the pads stay round. */}
      <svg class="water" viewBox="0 0 100 200" preserveAspectRatio="xMidYMid slice">
        {RIPPLES.map((r, i) => (
          <path
            key={i}
            class="ripple"
            d={`M${r.x.toFixed(1)} ${r.y.toFixed(1)}q${(r.w / 4).toFixed(2)} -1 ${(r.w / 2).toFixed(2)} 0t${(r.w / 2).toFixed(2)} 0`}
            style={{ animationDelay: `${r.delay.toFixed(2)}s` }}
          />
        ))}
        {PADS.map((p, i) => (
          <path key={i} class="pad" d={padPath(p)} />
        ))}
        {/* One lotus in flower on the second pad. */}
        <g class="bloom" transform="translate(88.5 56) scale(0.55)">
          <path d="M12 2.8C14.9 6.4 15.4 10.5 12 15.2 8.6 10.5 9.1 6.4 12 2.8Z" fill="#ffc2dc" />
          <path d="M2.8 8.2C7.6 8.5 10.7 11.3 11.6 15.9 6.8 15.6 3.7 12.8 2.8 8.2ZM21.2 8.2C16.4 8.5 13.3 11.3 12.4 15.9 17.2 15.6 20.3 12.8 21.2 8.2Z" fill="#ff8fc0" />
        </g>
      </svg>
      {scene === 'rain' && <div class="rain" />}
      {scene === 'lanterns' && (
        <div class="lights">
          {LIGHTS.map((light, i) => (
            <span key={i} style={{ top: `${light.y.toFixed(1)}%`, animationDelay: `${light.delay.toFixed(1)}s`, animationDuration: `${light.duration.toFixed(1)}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The little map's drawing box: as wide as the canal, and as tall as the boat on its highest bend. */
const TRIP_W = 220;
const TRIP_TOP = 8;
const TRIP_H = 46;

/** Where each stop of a canal lies on the little map: left to right, along a gentle bend. */
const STOPS: readonly (readonly [number, number])[] = Array.from({ length: STOPS_PER_CANAL }, (_, i) => [14 + (i * (TRIP_W - 28)) / (STOPS_PER_CANAL - 1), 38 + 7 * Math.sin(i * 0.95)] as const);

/** A smooth line through the stops: each bend turns at a stop and passes halfway between two. */
const CANAL_PATH = (() => {
  const [first = [0, 0]] = STOPS;
  let d = `M${String(first[0] - 14)} ${first[1].toFixed(2)}L${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  for (let i = 1; i < STOPS.length; i++) {
    const [x0, y0] = STOPS[i - 1] ?? first;
    const [x1, y1] = STOPS[i] ?? first;
    d += `Q${x0.toFixed(2)} ${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)}`;
  }
  const [lx, ly] = STOPS[STOPS.length - 1] ?? first;
  return `${d}T${lx.toFixed(2)} ${ly.toFixed(2)}L${String(lx + 14)} ${ly.toFixed(2)}`;
})();

/**
 * One canal on a little map: its ten stops, the ones passed in marigold, and the boat at the
 * stop being played. With `stop` past the last one the boat has reached the end.
 */
export function TripLine(props: { stop: number; class?: string }): JSX.Element {
  const stop = Math.max(0, Math.min(STOPS_PER_CANAL, props.stop));
  const [bx, by] = STOPS[Math.min(stop, STOPS_PER_CANAL - 1)] ?? [0, 0];
  return (
    <svg class={`trip ${props.class ?? ''}`} viewBox={`0 ${String(TRIP_TOP)} ${String(TRIP_W)} ${String(TRIP_H)}`} aria-hidden="true">
      <path class="trip__bank" d={CANAL_PATH} />
      <path class="trip__water" d={CANAL_PATH} />
      {STOPS.map(([x, y], i) => (
        <circle key={i} class={`trip__stop${i < stop ? ' trip__stop--passed' : ''}${i === STOPS_PER_CANAL - 1 ? ' trip__stop--end' : ''}`} cx={x} cy={y} r={i === STOPS_PER_CANAL - 1 ? 5 : 3.4} />
      ))}
      <g transform={`translate(${(bx - 13).toFixed(2)} ${(by - 25).toFixed(2)})`}>
        {/* Bobbing on its own group: an animated transform would replace the one placing it. */}
        <g class="trip__boat">
          <Icon name="boat" size={26} />
        </g>
      </g>
    </svg>
  );
}
