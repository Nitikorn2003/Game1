import type { JSX } from 'preact';
import type { Suit } from '../sim/cards.js';
import type { CanalId } from '../sim/content.js';

export type IconName =
  | 'coin'
  | 'cloud'
  | 'gear'
  | 'shop'
  | 'play'
  | 'noads'
  | 'home'
  | 'undo'
  | 'wild'
  | 'cards'
  | 'map'
  | 'looks'
  | 'sun'
  | 'check'
  | 'lock'
  | 'boat'
  | 'basket'
  | 'postcard';

/** The game's small icons, drawn on a 24 × 24 grid. */
export function Icon(props: { name: IconName; size?: number }): JSX.Element {
  const size = props.size ?? 20;
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[props.name]}
    </svg>
  );
}

const line = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
const water = { fill: 'none', stroke: '#3fb0c9', 'stroke-width': 1.6, 'stroke-linecap': 'round' } as const;

/** Three lotus petals, for the coin and the lotus wild. */
function Lotus(props: { petal: string; side: string; edge: string }): JSX.Element {
  return (
    <g stroke={props.edge} stroke-width="1.1" stroke-linejoin="round">
      <path d="M3.5 8.5C7.7 8.8 10.5 11.2 11.6 15.1 7.4 14.9 4.5 12.5 3.5 8.5Z" fill={props.side} />
      <path d="M20.5 8.5C16.3 8.8 13.5 11.2 12.4 15.1 16.6 14.9 19.5 12.5 20.5 8.5Z" fill={props.side} />
      <path d="M12 3.5C14.6 6.8 15 10.4 12 14.5 9 10.4 9.4 6.8 12 3.5Z" fill={props.petal} />
    </g>
  );
}

const ICONS: Record<IconName, JSX.Element> = {
  // A gold coin with a lotus pressed into it: the currency.
  coin: (
    <g>
      <circle cx="12" cy="12" r="9" fill="#ffd56b" stroke="#b07a14" stroke-width="1.5" />
      <circle cx="12" cy="12" r="6.3" fill="none" stroke="#e0a536" stroke-width="1.1" />
      <path
        d="M12 7.4C13.5 9 13.7 11 12 13.2 10.3 11 10.5 9 12 7.4ZM8.2 10.4C10.2 10.5 11.4 11.6 11.6 13.4 9.6 13.3 8.5 12.2 8.2 10.4ZM15.8 10.4C13.8 10.5 12.6 11.6 12.4 13.4 14.4 13.3 15.5 12.2 15.8 10.4Z"
        fill="#b07a14"
      />
      <path d="M8.8 15.2h6.4" stroke="#b07a14" stroke-width="1.2" stroke-linecap="round" />
    </g>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18Z" fill="#dff3f0" stroke="#3b8f88" stroke-width="1.6" />,
  gear: (
    <g {...line}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </g>
  ),
  shop: <path d="M4 9h16l-1.4 10.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 9Zm4 0V7a4 4 0 0 1 8 0v2" {...line} />,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />,
  noads: (
    <g>
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" opacity="0.45" />
      <path d="M4.5 4.5l15 15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </g>
  ),
  home: <path d="M4 11.5 12 4.5l8 7M6.5 9.5V20h11V9.5M10 20v-5.5h4V20" {...line} />,
  // An arrow turning back.
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" {...line} />,
  // A lotus on its pad: the wild card that any card goes onto.
  wild: (
    <g>
      <path d="M4.5 17C8 20 16 20 19.5 17 16 15.8 8 15.8 4.5 17Z" fill="#5cbf7a" stroke="#2b6e42" stroke-width="1.1" stroke-linejoin="round" />
      <Lotus petal="#ffc2dc" side="#ff8fc0" edge="#a51d57" />
      <circle cx="12" cy="14.6" r="1.4" fill="#ffd54f" />
    </g>
  ),
  // Two cards with a plus: more cards for the stock.
  cards: (
    <g {...line}>
      <rect x="4" y="7" width="10.5" height="14" rx="2" />
      <path d="M8.5 3.5H17a2 2 0 0 1 2 2V17M9.25 11v6M6.25 14h6" />
    </g>
  ),
  // A folded map.
  map: (
    <g {...line}>
      <path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2v-13Z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </g>
  ),
  // A painter's palette: how things look.
  looks: (
    <g>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.6-2.2-.5-1.4.4-2.6 1.9-2.6H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.3 16.7 3.5 12 3.5Z" {...line} />
      <circle cx="7.6" cy="11.5" r="1.5" fill="#ff8fc0" />
      <circle cx="9.6" cy="7.6" r="1.5" fill="#ffd56b" />
      <circle cx="14.2" cy="7.2" r="1.5" fill="#5cbf7a" />
    </g>
  ),
  // The morning sun over the water: the daily deal.
  sun: (
    <g>
      <path d="M5 15a7 7 0 0 1 14 0Z" fill="#ffc45a" stroke="#c07a12" stroke-width="1.3" stroke-linejoin="round" />
      <path d="M12 3.8V6M5.3 7.3l1.4 1.4M18.7 7.3l-1.4 1.4M2.5 13.5H4M20 13.5h1.5" stroke="#c07a12" stroke-width="1.6" stroke-linecap="round" />
      <path d="M3 18h18M6.5 21h11" {...water} />
    </g>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" {...line} stroke-width="2.6" />,
  lock: (
    <g {...line}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </g>
  ),
  // A market boat with its rower under a palm-leaf hat.
  boat: (
    <g stroke-linejoin="round">
      <path d="M15 8.5 19.5 17" stroke="#5a3215" stroke-width="1.4" stroke-linecap="round" />
      <path d="M10.4 10.8h3.2v3h-3.2Z" fill="#2f8f9f" />
      <path d="M8.2 11 12 5.8l3.8 5.2Z" fill="#ecc66e" stroke="#8a6420" stroke-width="1.1" />
      <path d="M2.5 13.5h19c-1.5 4-4.5 5.5-9.5 5.5S4 17.5 2.5 13.5Z" fill="#9a5528" stroke="#4d2610" stroke-width="1.2" />
      <path d="M3 21.5c2-1.1 4 1.1 6 0s4 1.1 6 0 4 1.1 6 0" {...water} />
    </g>
  ),
  // A woven basket of fruit: the Market Kit.
  basket: (
    <g stroke-linejoin="round">
      <path d="M7.5 11c0-5.5 9-5.5 9 0" fill="none" stroke="#6b4416" stroke-width="1.6" />
      <circle cx="10" cy="9.8" r="2.5" fill="#ffa726" stroke="#c46a0a" stroke-width="0.9" />
      <circle cx="14.3" cy="10" r="2.3" fill="#ec407a" stroke="#a51d57" stroke-width="0.9" />
      <path d="M4 11h16l-1.7 8.2a1.5 1.5 0 0 1-1.5 1.3H7.2a1.5 1.5 0 0 1-1.5-1.3Z" fill="#d39a4c" stroke="#6b4416" stroke-width="1.3" />
      <path d="M5.2 14h13.6M5.8 17h12.4" stroke="#8a5a22" stroke-width="1.1" />
    </g>
  ),
  // A postcard with a stamp: the Canal Collection.
  postcard: (
    <g>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" fill="#fbf1dc" stroke="#8a6420" stroke-width="1.3" />
      <rect x="14.5" y="8" width="4" height="4.5" fill="#ff8fc0" stroke="#a51d57" stroke-width="0.8" />
      <path d="M5.5 10H12M5.5 13H12M5.5 16h4.5" stroke="#8a6420" stroke-width="1.1" stroke-linecap="round" />
      <path d="M13.8 16c1-1 2 1 3 0s2-1 2.7 0" fill="none" stroke="#2b8fa3" stroke-width="1.1" stroke-linecap="round" />
    </g>
  ),
};

/** The suit drawn on a card, in `currentColor`. Suits are only pictures: the rules look at ranks. */
export function SuitShape(props: { suit: Suit }): JSX.Element {
  return SUITS[props.suit];
}

const ink = { fill: 'currentColor' } as const;

const SUITS: Record<Suit, JSX.Element> = {
  lotus: (
    <g {...ink}>
      <path d="M12 2.8C14.9 6.4 15.4 10.5 12 15.2 8.6 10.5 9.1 6.4 12 2.8Z" />
      <path d="M2.8 8.2C7.6 8.5 10.7 11.3 11.6 15.9 6.8 15.6 3.7 12.8 2.8 8.2ZM21.2 8.2C16.4 8.5 13.3 11.3 12.4 15.9 17.2 15.6 20.3 12.8 21.2 8.2Z" />
      <path d="M5.5 17.6h13c-1.2 2.4-3.6 3.6-6.5 3.6s-5.3-1.2-6.5-3.6Z" />
    </g>
  ),
  mango: (
    <g {...ink}>
      <path d="M14.5 6C19 7 20.6 11.5 19 15.5 17.3 19.7 12.3 21.6 8.3 20 4.9 18.6 3.6 15 5 12 6 9.8 8.6 9.6 10.1 8.3 11.4 7.2 12 5.6 14.5 6Z" />
      <path d="M14 6C14.4 3.6 16.6 2.3 19.8 2.6 19.1 5 17 6.3 14 6Z" opacity="0.7" />
    </g>
  ),
  fish: (
    <g>
      <path d="M2.5 12C5.8 6.8 13 6.3 17 12 13 17.7 5.8 17.2 2.5 12ZM16.3 12l5.2-4.8v9.6Z" {...ink} />
      <circle cx="7.2" cy="11" r="1.2" fill="#fffaf0" />
    </g>
  ),
  leaf: (
    <g>
      <path d="M12 2.5C17.6 6.6 19.2 12.3 15.8 17.2 14.5 19.1 13.2 20.1 12 21.5 10.8 20.1 9.5 19.1 8.2 17.2 4.8 12.3 6.4 6.6 12 2.5Z" {...ink} />
      <path d="M12 6.5V20M12 11l-2.6-2M12 14.5l2.6-2" fill="none" stroke="#fffaf0" stroke-width="1.1" stroke-linecap="round" opacity="0.75" />
    </g>
  ),
};

/** The picture on a canal's postcard, drawn on a 24 × 24 grid. */
export function CanalArt(props: { id: CanalId; size?: number }): JSX.Element {
  const size = props.size ?? 40;
  return (
    <svg class="canal-art" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {CANAL_ART[props.id]}
    </svg>
  );
}

const CANAL_ART: Record<CanalId, JSX.Element> = {
  // A pier with a little pavilion.
  landing: (
    <g stroke-linejoin="round">
      <path d="M7 13V9M17 13V9" stroke="#6b4416" stroke-width="1.6" />
      <path d="M5 9.2 12 3.5l7 5.7Z" fill="#e6904a" stroke="#8a4a1b" stroke-width="1.2" />
      <path d="M2.5 13.5h19" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round" />
      <path d="M5 13.5v5M10 13.5v5M14 13.5v5M19 13.5v5" stroke="#6b4416" stroke-width="1.6" />
      <path d="M3 19.5c2-1.2 4 1.2 6 0s4 1.2 6 0 4 1.2 6 0" {...water} />
    </g>
  ),
  mango: (
    <g stroke-linejoin="round">
      <path d="M14.5 6C19 7 20.6 11.5 19 15.5 17.3 19.7 12.3 21.6 8.3 20 4.9 18.6 3.6 15 5 12 6 9.8 8.6 9.6 10.1 8.3 11.4 7.2 12 5.6 14.5 6Z" fill="#ffb02e" stroke="#c46a0a" stroke-width="1.2" />
      <path d="M14 6C14.4 3.6 16.6 2.3 19.8 2.6 19.1 5 17 6.3 14 6Z" fill="#4caf50" stroke="#2e7d32" stroke-width="1" />
      <path d="M8.2 13.5c.4-1.6 1.6-2.6 3-2.9" fill="none" stroke="#ffe0a0" stroke-width="1.3" stroke-linecap="round" />
    </g>
  ),
  kingfisher: (
    <g>
      <path d="M8 20h11" stroke="#6b4416" stroke-width="1.6" stroke-linecap="round" />
      <path d="M3 17.5 7.5 14" stroke="#1f6fb2" stroke-width="2.6" stroke-linecap="round" />
      <ellipse cx="11" cy="13.5" rx="5.8" ry="4.2" fill="#1f8fd1" transform="rotate(-18 11 13.5)" />
      <path d="M7.8 16c2 2 5.8 1.8 7.7-.6" fill="none" stroke="#f08a24" stroke-width="2.4" stroke-linecap="round" />
      <circle cx="15.5" cy="8.8" r="3.6" fill="#1f8fd1" />
      <path d="M18.6 8.2 22.5 9.6l-3.9.8Z" fill="#3b2a1a" />
      <circle cx="16.2" cy="8" r="0.9" fill="#fff" />
    </g>
  ),
  coconut: (
    <g stroke-linejoin="round">
      <path d="M12.5 21c-.5-5-.3-9 .5-13" fill="none" stroke="#8a5a2b" stroke-width="2" stroke-linecap="round" />
      <path
        d="M13 8C10 5 6 5 3.5 7.5 7 7 9.5 8 13 8ZM13 8C16 5 20 5.2 21.5 8 18 7.3 15.5 8 13 8ZM13 8C11 9.5 8.5 12.5 8 15.5 10.5 13 12 10.5 13 8ZM13 8C15.5 9.5 17.5 12 18 15 15.8 12.8 14.2 10.5 13 8ZM13 8C12.5 5 13.5 3 15.5 2.5 14.6 4.4 13.8 6 13 8Z"
        fill="#43a047"
        stroke="#2e7d32"
        stroke-width="0.8"
      />
      <circle cx="12" cy="9.4" r="1.4" fill="#8a5a2b" />
      <circle cx="14.1" cy="9.6" r="1.4" fill="#8a5a2b" />
      <path d="M3 21h18" {...water} />
    </g>
  ),
  orchid: (
    <g stroke="#7b2a8f" stroke-width="0.9" stroke-linejoin="round">
      <path d="M12 11C10.5 7 11 4 12 2.8 13 4 13.5 7 12 11Z" fill="#d68be8" />
      <path d="M12 11C8 9 5 9.4 3.5 10.6 5 12.5 8.5 12.8 12 11ZM12 11C16 9 19 9.4 20.5 10.6 19 12.5 15.5 12.8 12 11Z" fill="#d68be8" />
      <path d="M12 11C9 13 7.5 16 7.8 18.5 10 17.5 11.5 14.5 12 11ZM12 11C15 13 16.5 16 16.2 18.5 14 17.5 12.5 14.5 12 11Z" fill="#c070d8" />
      <path d="M10.3 12.2C10.5 15.5 13.5 15.5 13.7 12.2 12.6 11.4 11.4 11.4 10.3 12.2Z" fill="#ffd54f" stroke="#b27a12" />
    </g>
  ),
  teahouse: (
    <g stroke-linejoin="round">
      <path d="M8.5 8.5c-1-1.5 1-2.5 0-4M12 8.5c-1-1.5 1-2.5 0-4M15.5 8.5c-1-1.5 1-2.5 0-4" fill="none" stroke="#9ad7e0" stroke-width="1.4" stroke-linecap="round" />
      <path d="M17 12.2h1.3a2.3 2.3 0 0 1 0 4.6h-1.9" fill="none" stroke="#8a5a2b" stroke-width="1.4" />
      <path d="M5 11h12v2.5a6 6 0 0 1-12 0Z" fill="#fbf1dc" stroke="#8a5a2b" stroke-width="1.4" />
      <path d="M7.5 13.5h7" stroke="#e86f8a" stroke-width="1.6" stroke-linecap="round" />
      <path d="M4 21h14" stroke="#8a5a2b" stroke-width="1.6" stroke-linecap="round" />
    </g>
  ),
  raintree: (
    <g stroke-linejoin="round">
      <path d="M12 21v-7M12 15.5 8.5 12.5M12 15l3.5-2.5" fill="none" stroke="#6b4416" stroke-width="1.8" stroke-linecap="round" />
      <path d="M2.5 12.5C3 7.5 7 4.5 12 4.5S21 7.5 21.5 12.5C18 11.3 15 13 12 12S6 11.3 2.5 12.5Z" fill="#4caf50" stroke="#2e7d32" stroke-width="1.1" />
      <path d="M5 21h14" {...water} />
    </g>
  ),
  bridges: (
    <g stroke-linecap="round">
      <path d="M5.6 10V7.6M9 8.8V6.4M12 8.5V6.1M15 8.8V6.4M18.4 10V7.6" stroke="#8a3a10" stroke-width="1.2" />
      <path d="M5.6 7.6C9 5.4 15 5.4 18.4 7.6" fill="none" stroke="#8a3a10" stroke-width="1.2" />
      <path d="M2 13C6 7 18 7 22 13" fill="none" stroke="#c0592b" stroke-width="2.6" />
      <path d="M3 17c2-1.2 4 1.2 6 0s4 1.2 6 0 4 1.2 6 0M6 20.5c2-1.2 4 1.2 6 0s4 1.2 6 0" {...water} />
    </g>
  ),
  spice: (
    <g stroke-linejoin="round">
      <path d="M7 6.5C4.5 9.5 5 15 9 18.5 12.5 21.5 18 21.5 20.5 20 15.5 18.5 11.5 15 10 9.5 9.6 8 8.5 6.4 7 6.5Z" fill="#e53935" stroke="#9a1f1b" stroke-width="1.1" />
      <path d="M7.2 6.6C7 4.6 8 3.2 10 2.8M6 6.8c1-1.2 3-1.2 4.4.2" fill="none" stroke="#2e7d32" stroke-width="1.6" stroke-linecap="round" />
      <path d="M8.2 10c.2 3 1.8 5.5 4.3 7" fill="none" stroke="#ff8a80" stroke-width="1.1" stroke-linecap="round" />
    </g>
  ),
  heron: (
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11.5 16v5M12.5 16l1.5 5" stroke="#e0a030" stroke-width="1.1" />
      <path d="M13.5 10.5c-1-2-.5-4 1-5 1.3-.9 1.6-1.9 1.2-2.6" stroke="#5b7f8f" stroke-width="1.6" />
      <path d="M16.4 3.2 20 4" stroke="#e0a030" stroke-width="1.4" />
      <circle cx="15.9" cy="3.2" r="1.2" fill="#eef4f6" stroke="#5b7f8f" stroke-width="0.9" />
      <path d="M9.5 13.5c0-3.5 3-4.5 4.5-3s1 5-2.5 5.5c-2.5.4-5-.5-6.5-2.5 2 .3 3.4.3 4.5 0Z" fill="#eef4f6" stroke="#5b7f8f" stroke-width="1.1" />
      <path d="M4 21h16" {...water} />
    </g>
  ),
  lantern: (
    <g stroke="#8a3a10" stroke-width="1.2" stroke-linejoin="round">
      <path d="M12 2v3M8 5h8" fill="none" />
      <path d="M7.5 6.5C4 9 4 15 7.5 17.5h9c3.5-2.5 3.5-8.5 0-11Z" fill="#ff7043" />
      <path d="M10 6.5c-1.4 3-1.4 8 0 11M14 6.5c1.4 3 1.4 8 0 11" fill="none" stroke="#c84a1a" stroke-width="1" />
      <path d="M8.5 17.5h7V19h-7Z" fill="#ffd54f" />
      <path d="M10 19v2.5M12 19v3M14 19v2.5" fill="none" stroke="#e0a030" stroke-width="1.1" stroke-linecap="round" />
    </g>
  ),
  // The sun coming up where the canal meets the sea.
  sunrise: (
    <g>
      <circle cx="12" cy="13" r="6" fill="#ff8a65" stroke="#d84315" stroke-width="1.1" />
      <path d="M2 13.5h20V21H2Z" fill="#3fb0c9" />
      <path d="M8 16h8M9.5 18.5h5" stroke="#ffccbc" stroke-width="1.4" stroke-linecap="round" />
      <path d="M4 6.5c.8-.8 1.6-.8 2.2 0 .6-.8 1.4-.8 2.2 0M15.5 4.5c.8-.8 1.6-.8 2.2 0 .6-.8 1.4-.8 2.2 0" fill="none" stroke="#5d4037" stroke-width="1.1" stroke-linecap="round" />
    </g>
  ),
};
