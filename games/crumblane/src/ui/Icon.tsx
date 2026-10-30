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
  | 'flag'
  | 'daily'
  | 'lane'
  | 'late'
  | 'kit'
  | 'basket'
  | 'tray'
  | 'rack'
  | 'room'
  | 'spatula'
  | 'rollingpin'
  | 'whisk'
  | 'bag'
  | 'box'
  | 'sprinkles';

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
const ink = '#5a3423';

const STAR = 'm12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z';

const ICONS: Record<IconName, JSX.Element> = {
  // A sugar cube: the bakery's currency.
  coin: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <path d="M12 3.5 20 7.6 12 11.7 4 7.6Z" fill="#ffffff" />
      <path d="M4 7.6v8.6l8 4.3v-8.8Z" fill="#f6dfe6" />
      <path d="M20 7.6v8.6l-8 4.3v-8.8Z" fill="#e6c3cf" />
      <path d="M8.6 7.4h.01M12.4 6h.01M14.6 8.4h.01M7.4 13.2h.01M16.4 13.8h.01M9.4 16h.01" stroke="#c49aa9" stroke-width="1.6" stroke-linecap="round" />
      <path d="M19.4 2.6v2.6M18.1 3.9h2.6" stroke="#f0a43a" stroke-width="1.3" stroke-linecap="round" />
    </g>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18Z" fill="#fffaf0" stroke="#8a5a3c" stroke-width="1.6" />,
  gear: (
    <g {...line}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </g>
  ),
  // A shopping bag with a little bow.
  shop: (
    <g {...line}>
      <path d="M5 8.5h14l-1.2 11a1.6 1.6 0 0 1-1.6 1.5H7.8a1.6 1.6 0 0 1-1.6-1.5Z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </g>
  ),
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />,
  noads: (
    <g>
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" opacity="0.45" />
      <path d="M4.5 4.5l15 15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </g>
  ),
  home: <path d="M4 11.2 12 4.5l8 6.7V20h-5.5v-5.5h-5V20H4Z" {...line} />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" {...line} stroke-width={2.6} />,
  lock: (
    <g {...line}>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </g>
  ),
  star: <path d={STAR} fill="#ffc83d" stroke="#a5600a" stroke-width="1.4" stroke-linejoin="round" />,
  starEmpty: <path d={STAR} fill="#f3e4d2" stroke="#c7a78a" stroke-width="1.4" stroke-linejoin="round" />,
  help: (
    <g {...line}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 3.8" />
      <path d="M12 17.4h.01" stroke-width={2.6} />
    </g>
  ),
  // A piping bag: the looks of the bakery.
  looks: (
    <g {...line}>
      <path d="M5 5.5 16.5 9 9 16.5Z" />
      <path d="m16.5 9 3 3-1.5 1.5M9 16.5l3 3 1.5-1.5" />
      <path d="M4.5 19.5h.01M7 20.5h.01" stroke-width={2.6} />
    </g>
  ),
  restart: (
    <g {...line}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v4h4" />
    </g>
  ),
  flag: (
    <g {...line}>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2.5 4 2.5 4H6" />
    </g>
  ),
  // A cake stand with its glass dome: the daily special.
  daily: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <path d="M5.5 15.5a6.5 6.5 0 0 1 13 0Z" fill="#e8f6fb" opacity="0.95" />
      <path d="M8.5 15.5v-3h7v3" fill="#ffb3c7" />
      <path d="M8.5 12.5h7" stroke="#fff" stroke-width="1.2" />
      <circle cx="12" cy="11" r="1.2" fill="#e8475f" />
      <path d="M4 15.5h16M12 15.5v4M8.5 20h7" fill="none" stroke-linecap="round" stroke-width="1.6" />
      <path d="M12 9v-1.2" fill="none" stroke-linecap="round" />
    </g>
  ),
  // A shopfront under a striped awning: the lane.
  lane: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <path d="M4.5 10.5h15V20h-15Z" fill="#fff4e0" />
      <path d="M3.5 6.5h17l-1 4h-15Z" fill="#f06b7f" />
      <path d="M7.7 6.5 7.3 10.5M12 6.5v4M16.3 6.5l.4 4" stroke="#fff" stroke-width="1.6" />
      <path d="M7 20v-6h4v6" fill="#c98c5a" />
      <path d="M13.5 13.5h4v3h-4Z" fill="#bfe4f2" />
    </g>
  ),
  // The moon over the bakery: the late shift.
  late: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <path d="M14.5 3.5a8.5 8.5 0 1 0 6 13.5 7 7 0 0 1-6-13.5Z" fill="#ffe08a" />
      <path d="M18.5 4.5v2M17.5 5.5h2" stroke="#f0a43a" stroke-linecap="round" />
    </g>
  ),
  // An apron with a pocket: the Baker's Kit.
  kit: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <path d="M8 3.5h8v4l3 2.5-1.2 10.5H6.2L5 10l3-2.5Z" fill="#ffd9e2" />
      <path d="M8.6 13h6.8v4.5H8.6Z" fill="#fff" />
      <path d="M8 7.5h8" fill="none" />
      <path d="M12 13v4.5" fill="none" />
    </g>
  ),
  // A wicker basket of every look: the Lane Collection.
  basket: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <path d="M6.5 10.5a5.5 5.5 0 0 1 11 0" fill="none" stroke-width="1.6" />
      <path d="M3.5 10.5h17l-2 9.5h-13Z" fill="#e2a868" />
      <path d="M6 13.5h12M6.6 16.5h10.8M9 10.5l.8 9.5M15 10.5l-.8 9.5" fill="none" stroke="#a5683a" />
      <circle cx="9" cy="8.6" r="1.6" fill="#f06b7f" />
      <circle cx="14.6" cy="8.2" r="1.6" fill="#ffc83d" />
    </g>
  ),
  tray: (
    <g {...line}>
      <path d="M3 13.5h18l-2 5H5Z" />
      <path d="M7 13.5v-3h4v3M13 13.5v-4.5h4v4.5" />
    </g>
  ),
  // A wire cooling rack.
  rack: (
    <g {...line}>
      <rect x="3.5" y="8" width="17" height="9" rx="1.5" />
      <path d="M7.5 8v9M12 8v9M16.5 8v9M3.5 12.5h17M5 17l-1 3M19 17l1 3" />
    </g>
  ),
  // Up to the rack: making room on the tray.
  room: (
    <g {...line}>
      <path d="M12 19V7" />
      <path d="m7.5 11 4.5-4.5 4.5 4.5" />
      <path d="M4.5 4h15" />
    </g>
  ),
  spatula: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <path d="M13.2 3.6h6.2v7.2l-2.1 1.6h-2l-2.1-1.6Z" fill="#cfe9f0" />
      <path d="M15.3 5.6v4.2M17.3 5.6v4.2" stroke="#7aaab8" stroke-linecap="round" />
      <path d="M15.4 12.4 8.2 19.6a1.6 1.6 0 0 1-2.3-2.3l7.6-6.6" fill="#c98c5a" />
    </g>
  ),
  rollingpin: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <rect x="6.2" y="8.2" width="11.6" height="7.6" rx="3.2" transform="rotate(-35 12 12)" fill="#f2c48d" />
      <path d="m4.6 18.8-2 1.4M19.4 5.2l2-1.4" stroke="#c98c5a" stroke-width="2.6" stroke-linecap="round" />
      <path d="m9 13.4 4.6-3.2" stroke="#fff3df" stroke-width="1.4" stroke-linecap="round" />
    </g>
  ),
  whisk: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M10.3 13.7 4.6 19.4" stroke="#c98c5a" stroke-width="2.8" />
      <path d="M10.8 13.2c-1.5-4.6.4-9 4.9-9.8 2.2 2 3.2 4.6 2 7.2-1.7 2.2-4.2 3-6.9 2.6Z" fill="#eaf4f7" />
      <path d="M10.8 13.2c1.4-3.8 3.4-6.9 4.9-9.8M10.8 13.2c3-1.2 5.6-3.4 6.9-2.6" fill="none" stroke="#7aaab8" />
    </g>
  ),
  // A paper bag, folded over.
  bag: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <path d="M5.5 7.5h13l-1 13h-11Z" fill="#d8a874" />
      <path d="M5.5 7.5 7 4h10l1.5 3.5" fill="#e9c296" />
      <path d="M10.4 12.6a1.8 1.8 0 1 1 2.4 1.7c-.6.3-.8.6-.8 1.2M12 17.6h.01" fill="none" stroke="#6b4423" stroke-linecap="round" stroke-width="1.5" />
    </g>
  ),
  // A pastry box tied with a ribbon.
  box: (
    <g stroke={ink} stroke-width="1.3" stroke-linejoin="round">
      <path d="M4.5 9.5h15v10h-15Z" fill="#fff4f6" />
      <path d="M3.5 6.5h17v3h-17Z" fill="#ffe1e8" />
      <path d="M12 6.5v13" stroke="#e8475f" stroke-width="2.2" />
      <path d="M12 6.5c-2.4-3-5.4-2-4.4 0Zm0 0c2.4-3 5.4-2 4.4 0Z" fill="#f47c90" stroke="#b02a43" />
    </g>
  ),
  sprinkles: (
    <g stroke-linecap="round" stroke-width="2.2">
      <path d="M5 7l2.4-1.4" stroke="#f06b7f" />
      <path d="M11 5.5l1 2.4" stroke="#4fb5e8" />
      <path d="M17 7.4l2.4.6" stroke="#ffc83d" />
      <path d="M6.6 13.4l2.6.4" stroke="#7fcf6a" />
      <path d="M13.4 12.2l-1.4 2.2" stroke="#b886e8" />
      <path d="M18.4 13.6l-1 2.4" stroke="#f06b7f" />
      <path d="M8.6 19l2.4-1" stroke="#ffc83d" />
      <path d="M15 18.4l2 1.4" stroke="#4fb5e8" />
    </g>
  ),
};
