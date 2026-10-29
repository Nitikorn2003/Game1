import type { JSX } from 'preact';

export type IconName =
  | 'coin'
  | 'cloud'
  | 'gear'
  | 'shop'
  | 'play'
  | 'noads'
  | 'home'
  | 'check'
  | 'lock'
  | 'star'
  | 'starEmpty'
  | 'help'
  | 'looks'
  | 'restart'
  | 'moves'
  | 'claw'
  | 'tide'
  | 'crab'
  | 'sun'
  | 'turtle'
  | 'sand'
  | 'rock'
  | 'kelp'
  | 'mask'
  | 'chest'
  | 'sea'
  | 'flag';

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

const STAR = 'm12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z';

const ICONS: Record<IconName, JSX.Element> = {
  // A sand dollar: the reef's currency, a flat round shell with a five-petal flower on it.
  coin: (
    <g>
      <circle cx="12" cy="12" r="9.5" fill="#f3e2bd" stroke="#9a7a45" stroke-width="1.4" />
      <g fill="#c9a668">
        <ellipse cx="12" cy="7.6" rx="1.2" ry="2.6" />
        <ellipse cx="12" cy="7.6" rx="1.2" ry="2.6" transform="rotate(72 12 12)" />
        <ellipse cx="12" cy="7.6" rx="1.2" ry="2.6" transform="rotate(144 12 12)" />
        <ellipse cx="12" cy="7.6" rx="1.2" ry="2.6" transform="rotate(216 12 12)" />
        <ellipse cx="12" cy="7.6" rx="1.2" ry="2.6" transform="rotate(288 12 12)" />
      </g>
      <circle cx="12" cy="12" r="1.1" fill="#9a7a45" />
    </g>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18Z" fill="#eef7ff" stroke="#3f88c5" stroke-width="1.6" />,
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
  check: <path d="m5 12.5 4.5 4.5L19 7.5" {...line} stroke-width="2.6" />,
  lock: (
    <g {...line}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </g>
  ),
  star: <path d={STAR} fill="#ffc83d" stroke="#a8670c" stroke-width="1.3" stroke-linejoin="round" />,
  starEmpty: <path d={STAR} fill="rgba(255, 255, 255, 0.18)" stroke="rgba(255, 255, 255, 0.55)" stroke-width="1.3" stroke-dasharray="2.2 1.6" stroke-linejoin="round" />,
  help: (
    <g {...line}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.4a2.7 2.7 0 1 1 3.7 2.5c-.7.3-1.1.9-1.1 1.6v.5M12 17.2v.1" />
    </g>
  ),
  // A painter's palette: how things look.
  looks: (
    <g>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.6-2.2-.5-1.4.4-2.6 1.9-2.6H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.3 16.7 3.5 12 3.5Z" {...line} />
      <circle cx="7.6" cy="11.5" r="1.5" fill="#f2603f" />
      <circle cx="9.6" cy="7.6" r="1.5" fill="#ffc83d" />
      <circle cx="14.2" cy="7.2" r="1.5" fill="#3fc68a" />
    </g>
  ),
  restart: <path d="M5.5 12a6.5 6.5 0 1 0 2-4.7M5 3.8v4h4" {...line} />,
  // Two pieces trading places: the moves a dive has.
  moves: (
    <g {...line}>
      <path d="M4 9h13l-3-3M20 15H7l3 3" />
    </g>
  ),
  // A crab's claw, open to pick one piece.
  claw: (
    <g stroke="#8a2a12" stroke-width="1.3" stroke-linejoin="round">
      <path d="M9 21c-2-3-2-6 0-8l2-2c-3-1-5-3-5-6 3 0 5 1 7 3 0-3 2-5 5-5-1 4-1 7-3 9-1 2-3 3-5 4-1 1-1 3 0 5Z" fill="#f2603f" />
      <path d="M13 8c1 1 1.5 2 1.4 3.4" fill="none" stroke="#ffb199" stroke-width="1.2" stroke-linecap="round" />
    </g>
  ),
  // A wave rolling over a row.
  tide: (
    <g stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 16c2.5-6.5 7-10 12-10 3 0 5.5 1.5 6.5 4-2-.8-4-.4-5 1 2 .2 3.4 1.4 3.6 3-2.8-1-5-.4-6.6 2H2.5Z" fill="#46b4f0" stroke="#1d6fa3" stroke-width="1.3" />
      <path d="M2.5 19.5h19" stroke="#1d6fa3" stroke-width="1.6" />
      <path d="M8 11c1.4-1.8 3.2-2.8 5.4-3" fill="none" stroke="#e4f6ff" stroke-width="1.4" />
    </g>
  ),
  // The hermit crab, who swaps any two neighbours.
  crab: (
    <g stroke="#7a2e12" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">
      <path d="M13 6c4.5 0 7.5 3 7.5 6.8s-2.6 6-6.4 6c-3.4 0-5.3-2.3-5.3-4.5s1.5-3.8 3.8-3.8c1.9 0 3 1.1 3 2.6s-1.1 2.3-2.3 2.3" fill="#f3c27a" />
      <path d="M5 17.3c0-2.3 1.5-3.8 3.8-3.8h3v5.3H6.5c-.8 0-1.5-.8-1.5-1.5Z" fill="#ef6a4a" />
      <path d="M5.8 15c-2.3-.8-3.8-2.3-3.8-4.1 1.5 0 3 .8 3.8 2.3M8 13.5c-1.5-1.5-1.9-3.4-1.1-4.9 1.1.8 1.9 2.3 1.9 3.8" fill="#ef6a4a" />
      <path d="M6.8 18.8l-1.5 2.2M9 18.8l-.4 2.6M11.3 18.8l.8 2.2" fill="none" />
    </g>
  ),
  // The sun on the water: the daily dive.
  sun: (
    <g>
      <circle cx="12" cy="10" r="4.6" fill="#ffc83d" stroke="#b5760f" stroke-width="1.3" />
      <path d="M12 2.2v1.6M5.2 4.8l1.2 1.2M18.8 4.8l-1.2 1.2M3 10h1.6M19.4 10H21" stroke="#b5760f" stroke-width="1.5" stroke-linecap="round" />
      <path d="M2.5 17c2-1.4 3.6-1.4 5.5 0s3.5 1.4 5.5 0 3.5-1.4 5.5 0 2 1 3 .4M2.5 21c2-1.4 3.6-1.4 5.5 0s3.5 1.4 5.5 0 3.5-1.4 5.5 0" fill="none" stroke="#1d6fa3" stroke-width="1.6" stroke-linecap="round" />
    </g>
  ),
  turtle: (
    <g stroke="#1f5b3a" stroke-width="1.1" stroke-linejoin="round">
      <path d="M6 8C4 7 2.5 7.4 2 8.4c1 1 2.4 1.4 4.4 1.4ZM18 8c2-1 3.5-.6 4 .4-1 1-2.4 1.4-4.4 1.4ZM7 17c-1.5 1-2.4 2.4-2 3.4 1.2 0 2.6-1 3.4-2.4ZM17 17c1.5 1 2.4 2.4 2 3.4-1.2 0-2.6-1-3.4-2.4Z" fill="#7fc97a" />
      <ellipse cx="12" cy="12" rx="6.4" ry="7.4" fill="#4f9e5c" />
      <path d="M12 6.4l2.4 1.9V11L12 12.6 9.6 11V8.3Z" fill="none" stroke="#2c6e41" stroke-width="0.9" />
      <ellipse cx="12" cy="20.6" rx="2.6" ry="2.3" fill="#8fd18a" />
    </g>
  ),
  sand: (
    <g>
      <rect x="2.5" y="5" width="19" height="14" rx="3.5" fill="#ecd29b" stroke="#a8823f" stroke-width="1.3" />
      <path d="M5 13c2-1.4 3.6-1.4 5.4 0s3.6 1.4 5.4 0 2.4-1.2 3.4-.4" fill="none" stroke="#c9a668" stroke-width="1.3" stroke-linecap="round" />
      <circle cx="7" cy="9" r="0.9" fill="#a8823f" />
      <circle cx="15.5" cy="8.5" r="0.8" fill="#a8823f" />
      <circle cx="11" cy="16.4" r="0.8" fill="#a8823f" />
    </g>
  ),
  rock: (
    <g stroke="#4e463e" stroke-width="1.3" stroke-linejoin="round">
      <path d="M4 9.5 8 5h8.5l4.5 4.2.8 7.4-4 4.4H8.2L3.4 16.5Z" fill="#8d8175" />
      <circle cx="9.4" cy="10.4" r="1.4" fill="#5e554c" stroke="none" />
      <circle cx="15.4" cy="15" r="1.6" fill="#5e554c" stroke="none" />
      <circle cx="15" cy="8.8" r="1" fill="#5e554c" stroke="none" />
    </g>
  ),
  kelp: (
    <g fill="none" stroke-linecap="round">
      <path d="M7 22c3.6-5-1.6-9 2-13.4S10.4 3 9.6 2M15.4 22c-3-4.6 2.4-8.4-.8-12.6" stroke="#1f6b33" stroke-width="3.4" />
      <path d="M7 22c3.6-5-1.6-9 2-13.4S10.4 3 9.6 2M15.4 22c-3-4.6 2.4-8.4-.8-12.6" stroke="#4caf50" stroke-width="1.8" />
    </g>
  ),
  // A diving mask: the Diver's Kit.
  mask: (
    <g stroke="#1d3e5a" stroke-width="1.4" stroke-linejoin="round">
      <path d="M2.5 10.5h19" stroke-width="2" stroke-linecap="round" />
      <path d="M4.5 8h15a1.6 1.6 0 0 1 1.6 1.8l-.7 5.4a2.2 2.2 0 0 1-2.2 1.9h-3.1c-.8 0-1.4-.5-1.7-1.2l-.5-1.2c-.3-.7-1.5-.7-1.8 0l-.5 1.2c-.3.7-.9 1.2-1.7 1.2H5.8a2.2 2.2 0 0 1-2.2-1.9l-.7-5.4A1.6 1.6 0 0 1 4.5 8Z" fill="#9ad9f5" />
      <path d="M6.5 10.6c.4-.8 1-1.2 1.8-1.4M14.6 10.6c.4-.8 1-1.2 1.8-1.4" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" />
      <path d="M20 9V4.5c0-1-.8-1.8-1.8-1.8h-1.4" fill="none" stroke="#f2603f" stroke-width="1.8" stroke-linecap="round" />
    </g>
  ),
  // A treasure chest from the wreck: the Reef Collection.
  chest: (
    <g stroke="#6b3e12" stroke-width="1.3" stroke-linejoin="round">
      <path d="M3.5 11h17v8.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z" fill="#b8742f" />
      <path d="M3.5 11V9.5C3.5 6.5 6 4.5 9 4.5h6c3 0 5.5 2 5.5 5V11Z" fill="#d08a3c" />
      <path d="M3.5 11h17M9 4.5v6.5M15 4.5v6.5" fill="none" />
      <rect x="10.5" y="10" width="3" height="4" rx="0.8" fill="#ffc83d" />
      <circle cx="7" cy="16" r="1.3" fill="#f59bbd" stroke="none" />
      <circle cx="17" cy="16.4" r="1.1" fill="#46b4f0" stroke="none" />
    </g>
  ),
  // The open sea past the reef.
  sea: (
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M2.5 9c2-1.6 3.6-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0 2 1.2 3 .5M2.5 14c2-1.6 3.6-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0 2 1.2 3 .5M2.5 19c2-1.6 3.6-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0 2 1.2 3 .5" />
    </g>
  ),
  // A dive's end, given up: a flag on a buoy.
  flag: (
    <g stroke-linejoin="round">
      <path d="M7 21V3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M7 4h11l-3 4 3 4H7Z" fill="#f2603f" stroke="#9c2f1a" stroke-width="1.3" />
    </g>
  ),
};
