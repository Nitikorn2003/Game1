import type { JSX } from 'preact';
import type { Season } from '../sim/content.js';

/** How many petals, drops, leaves or flakes drift down the lane. */
const FALLING = 14;

/**
 * The lane behind everything: the sky of the season, the roofs and awnings of the shops across
 * the way, and whatever the season lets fall. Its colours come from the look.
 */
export function Backdrop(props: { season: Season }): JSX.Element {
  return (
    <div class={`backdrop backdrop--${props.season}`} aria-hidden="true">
      <div class="backdrop__glow" />
      <div class="backdrop__fall">
        {Array.from({ length: FALLING }, (_, i) => (
          <span key={i} class="fall" style={{ '--i': String(i), '--x': String((i * 37) % 100), '--d': String(7 + ((i * 13) % 9)) }} />
        ))}
      </div>
      <div class="backdrop__roofs" />
      <div class="backdrop__awnings" />
    </div>
  );
}

/** A small view of a season, for the looks sheet. */
export function SeasonSwatch(props: { season: Season }): JSX.Element {
  return (
    <span class={`look__preview swatch backdrop--${props.season}`} aria-hidden="true">
      <span class="swatch__glow" />
      <span class="swatch__roofs" />
    </span>
  );
}
