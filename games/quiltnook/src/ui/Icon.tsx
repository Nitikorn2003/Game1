import type { JSX } from 'preact';

export type IconName =
  | 'spool'
  | 'cloud'
  | 'gear'
  | 'shop'
  | 'play'
  | 'noads'
  | 'home'
  | 'unpick'
  | 'shuffle'
  | 'scissors'
  | 'star'
  | 'calendar'
  | 'book'
  | 'swatch'
  | 'check'
  | 'chest';

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

const ICONS: Record<IconName, JSX.Element> = {
  // A wooden spool wound with red thread.
  spool: (
    <g>
      <rect x="5" y="2.5" width="14" height="3.5" rx="1.5" fill="#c99a62" stroke="#7a5230" stroke-width="1.3" />
      <rect x="5" y="18" width="14" height="3.5" rx="1.5" fill="#c99a62" stroke="#7a5230" stroke-width="1.3" />
      <rect x="7" y="6" width="10" height="12" fill="#e0675a" stroke="#9b3a30" stroke-width="1.3" />
      <path d="M7.5 9h9M7.5 12h9M7.5 15h9" stroke="#f6a89c" stroke-width="1.1" />
    </g>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18Z" fill="#dcecff" stroke="#4f7fb0" stroke-width="1.6" />,
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
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" opacity="0.4" />
      <path d="M4.5 4.5l15 15" {...line} stroke-width="2.4" />
    </g>
  ),
  home: <path d="M4 11.5 12 4.5l8 7M6.5 9.5V20h11V9.5M10 20v-5.5h4V20" {...line} />,
  // An arrow curling back: take the last patch back.
  unpick: <path d="M9 7H5V3M5.4 7A8 8 0 1 1 4 12" {...line} />,
  shuffle: <path d="M3 7h3.5c4.5 0 6.5 10 11 10H21M3 17h3.5c1.8 0 3.2-1.6 4.3-3.6M13.2 9.6C14.3 8.3 15.6 7 17.5 7H21M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5" {...line} />,
  scissors: (
    <g {...line}>
      <circle cx="6.5" cy="6.5" r="2.8" />
      <circle cx="6.5" cy="17.5" r="2.8" />
      <path d="M8.6 8.4 20 18M8.6 15.6 20 6" />
    </g>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" fill="#f2c14e" stroke="#9a6b12" stroke-width="1.4" stroke-linejoin="round" />,
  calendar: (
    <g {...line}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9 15 2 2 4-4" />
    </g>
  ),
  book: <path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5V5.5ZM12 6v13.5" {...line} />,
  // Four squares of fabric sewn together.
  swatch: (
    <g stroke="#6b4a33" stroke-width="1.2">
      <rect x="3" y="3" width="9" height="9" fill="#d65a4a" />
      <rect x="12" y="3" width="9" height="9" fill="#e8b547" />
      <rect x="3" y="12" width="9" height="9" fill="#8fb48b" />
      <rect x="12" y="12" width="9" height="9" fill="#6f95d6" />
    </g>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" {...line} stroke-width="2.6" />,
  chest: (
    <g stroke="#6b4a33" stroke-width="1.4" stroke-linejoin="round">
      <path d="M3.5 10a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v1h-17v-1Z" fill="#b9814f" />
      <rect x="3.5" y="11" width="17" height="8.5" rx="1" fill="#d39a62" />
      <rect x="10" y="9.5" width="4" height="4.5" rx="1" fill="#f2c14e" />
    </g>
  ),
};
