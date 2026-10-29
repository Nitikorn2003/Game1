import { Rng } from '@game1/engine';
import type { JSX } from 'preact';
import type { ConstellationId, Sky } from '../sim/content.js';
import { figureOf } from '../sim/sky.js';

interface Twinkle {
  x: number;
  y: number;
  r: number;
  delay: number;
}

/** The same scattered stars every time, so the sky does not jump between screens. */
const STARS: readonly Twinkle[] = (() => {
  const rng = new Rng(20261029);
  return Array.from({ length: 90 }, () => ({ x: rng.next() * 100, y: rng.next() * 100, r: 0.12 + rng.next() * rng.next() * 0.3, delay: rng.next() * 6 }));
})();

/** The night behind everything: a sky look, with stars that twinkle slowly. */
export function SkyBackdrop(props: { sky: Sky }): JSX.Element {
  return (
    <div class={`backdrop backdrop--${props.sky}`} aria-hidden="true">
      {props.sky === 'aurora' && (
        <div class="aurora">
          <span />
          <span />
          <span />
        </div>
      )}
      {/* As tall as a phone, and cropped to the screen, so the stars stay round. */}
      <svg class="starfield" viewBox="0 0 100 200" preserveAspectRatio="xMidYMid slice">
        {STARS.map((star, i) => (
          <circle key={i} class="twinkle" cx={star.x} cy={star.y * 2} r={star.r * 1.6} style={{ animationDelay: `${star.delay.toFixed(2)}s` }} />
        ))}
      </svg>
      {props.sky === 'moonrise' && <div class="moon" />}
      {props.sky === 'meteors' && (
        <div class="meteors">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

export interface FigureProps {
  id: ConstellationId;
  /** Stars lit, from the first. */
  lit: number;
  size?: number;
  /** The star that was just lit, which flares. */
  flare?: number;
}

/** A constellation: lit stars and the lines between them; stars to come are faint dots. */
export function Figure(props: FigureProps): JSX.Element {
  const figure = figureOf(props.id);
  const size = props.size ?? 120;
  return (
    <svg class="figure" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {figure.lines.map(([a, b], i) => {
        const [ax, ay] = figure.points[a] ?? [0, 0];
        const [bx, by] = figure.points[b] ?? [0, 0];
        return <line key={i} class={b < props.lit ? 'figure__line figure__line--lit' : 'figure__line'} x1={ax * 100} y1={ay * 100} x2={bx * 100} y2={by * 100} />;
      })}
      {figure.points.map(([x, y], i) => (
        <circle key={i} class={`figure__star${i < props.lit ? ' figure__star--lit' : ''}${i === props.flare ? ' figure__star--flare' : ''}`} cx={x * 100} cy={y * 100} r={i < props.lit ? 3.6 : 2.2} />
      ))}
    </svg>
  );
}
