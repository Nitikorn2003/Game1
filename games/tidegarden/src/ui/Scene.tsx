import type { JSX } from 'preact';
import type { Water } from '../sim/content.js';

/** The water behind everything: light from above, drifting bubbles, and a sandy floor. Its colours come from the look. */
export function Backdrop(props: { water: Water }): JSX.Element {
  return (
    <div class={`backdrop backdrop--${props.water}`} aria-hidden="true">
      <div class="backdrop__rays" />
      <div class="backdrop__bubbles">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} class="bubble" style={{ '--i': String(i) }} />
        ))}
      </div>
      <div class="backdrop__floor" />
    </div>
  );
}

/** A small view of a water look, for the looks sheet. */
export function WaterSwatch(props: { water: Water }): JSX.Element {
  return (
    <span class={`look__preview swatch backdrop--${props.water}`} aria-hidden="true">
      <span class="swatch__ray" />
      <span class="swatch__floor" />
    </span>
  );
}
