import type { JSX } from 'preact';
import { label, suitOf, WILD, type Card } from '../sim/cards.js';
import type { CardBack } from '../sim/content.js';
import { Icon, SuitShape } from './Icon.js';

/**
 * A card face up: its rank large in the corner, its suit beside it and again below. Sizes come
 * from `--cw`, the card's width, set by whatever lays the cards out.
 */
export function Face(props: { card: Card }): JSX.Element {
  if (props.card === WILD)
    return (
      <span class="face face--wild" aria-hidden="true">
        <Icon name="wild" size={24} />
      </span>
    );
  const suit = suitOf(props.card);
  const text = label(props.card);
  return (
    <span class={`face face--${suit}`} aria-hidden="true">
      <span class={`face__rank${text.length > 1 ? ' face__rank--wide' : ''}`}>{text}</span>
      <svg class="face__pip" viewBox="0 0 24 24">
        <SuitShape suit={suit} />
      </svg>
      <svg class="face__big" viewBox="0 0 24 24">
        <SuitShape suit={suit} />
      </svg>
    </span>
  );
}

/** A card face down, in the card backs the player chose. */
export function Back(props: { look: CardBack }): JSX.Element {
  return (
    <span class={`back back--${props.look}`} aria-hidden="true">
      <svg class="back__motif" viewBox="0 0 24 24">
        {MOTIFS[props.look]}
      </svg>
    </span>
  );
}

const MOTIFS: Record<CardBack, JSX.Element> = {
  lotus: <SuitShape suit="lotus" />,
  // A round medallion with waves in it.
  waves: (
    <g fill="none" stroke="currentColor" stroke-linecap="round">
      <circle cx="12" cy="12" r="8.5" stroke-width="1.4" />
      <path d="M5.5 10.5C7 9 8.5 9 10 10.5S13 12 14.5 10.5 17 9 18.5 10.5M5.5 14.5C7 13 8.5 13 10 14.5S13 16 14.5 14.5 17 13 18.5 14.5" stroke-width="1.5" />
    </g>
  ),
  // A festival elephant in its saddle cloth.
  elephant: (
    <g>
      <path
        d="M20.5 11C20.5 8.5 18.8 7 16.5 7H10C8.8 6.2 7.5 6 6.3 6.3 4.2 6.8 3.4 8.8 3.6 11L3.8 15.5C3.8 16.8 3.4 17.6 2.6 18.2 4 18.6 5.2 17.6 5.4 16L5.6 13.4C6.4 14.4 7.4 15 8.5 15.3V19.5H11V16H17V19.5H19.5V15.6C20.2 14.6 20.5 13 20.5 11Z"
        fill="currentColor"
      />
      <path d="M11.5 7h6.2v4.6c-1.8.9-4.4.9-6.2 0Z" fill="#c62828" />
      <path d="M8.4 8c2.2-.4 3.8 1.2 3.5 3.6-.3 1.8-2.1 2.3-3.4 1.5.4-1.7.4-3.5-.1-5.1Z" class="back__cut" fill="none" stroke-width="0.9" />
      <circle class="back__hole" cx="6.3" cy="9.6" r="0.6" />
    </g>
  ),
  // A kanok flame, the curling flame of old Thai patterns.
  kanok: (
    <g>
      <path d="M12 2.5c2.8 3 4.8 6.3 4.3 10.1-.4 3.2-2.5 5-4.3 8.9-1.8-3.9-3.9-5.7-4.3-8.9C7.2 8.8 9.2 5.5 12 2.5Z" fill="currentColor" />
      <path d="M12 7c1.4 1.8 2.1 3.8 1.8 5.8-.3 1.8-1.1 2.8-1.8 4.4-.7-1.6-1.5-2.6-1.8-4.4-.3-2 .4-4 1.8-5.8Z" class="back__hole" />
      <path d="M7.8 12.4C5.5 12 4.1 10.4 4.5 8.4c1.2 1.3 2.2 1.8 3.6 1.8M16.2 12.4c2.3-.4 3.7-2 3.3-4-1.2 1.3-2.2 1.8-3.6 1.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    </g>
  ),
};
