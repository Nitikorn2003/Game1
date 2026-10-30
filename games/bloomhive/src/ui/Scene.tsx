import type { JSX } from 'preact';
import type { Sky } from '../sim/content.js';

/** The sky over the meadow behind everything: a sun or a moon, drifting clouds and rolling hills of flowers. Its colours come from the look. */
export function Backdrop(props: { sky: Sky }): JSX.Element {
  return (
    <div class={`backdrop backdrop--${props.sky}`} aria-hidden="true">
      <div class="backdrop__glow" />
      <div class="backdrop__clouds">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} class="cloud" style={{ '--i': String(i) }} />
        ))}
      </div>
      {props.sky === 'rain' && <div class="backdrop__rain" />}
      {props.sky === 'starry' && <div class="backdrop__stars" />}
      <div class="backdrop__hill backdrop__hill--far" />
      <div class="backdrop__hill backdrop__hill--near" />
    </div>
  );
}

/** A small view of a sky, for the looks sheet. */
export function SkySwatch(props: { sky: Sky }): JSX.Element {
  return (
    <span class={`look__preview swatch backdrop--${props.sky}`} aria-hidden="true">
      <span class="swatch__glow" />
      <span class="swatch__hill" />
    </span>
  );
}
