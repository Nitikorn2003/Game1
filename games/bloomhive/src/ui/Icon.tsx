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
  | 'shots'
  | 'rainbow'
  | 'bomb'
  | 'sunbeam'
  | 'sun'
  | 'bee'
  | 'top'
  | 'jar'
  | 'kit'
  | 'basket'
  | 'wild'
  | 'flag'
  | 'swap';

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

/** A baby bee, drawn on the 24 grid: for the bees to free, and for the game itself. */
const BEE = (
  <g stroke="#3a2a10" stroke-width="1.2" stroke-linejoin="round">
    <ellipse cx="8.4" cy="7.6" rx="3.6" ry="2.6" fill="#eaf7ff" transform="rotate(-25 8.4 7.6)" />
    <ellipse cx="15.6" cy="7.6" rx="3.6" ry="2.6" fill="#eaf7ff" transform="rotate(25 15.6 7.6)" />
    <ellipse cx="12" cy="14" rx="6.6" ry="6" fill="#ffd23f" />
    <path d="M7.2 11.8c3 1.2 6.6 1.2 9.6 0M6.2 15.2c3.6 1.4 8 1.4 11.6 0" fill="none" stroke="#3a2a10" stroke-width="1.9" stroke-linecap="round" />
    <circle cx="9.8" cy="13.8" r="0.9" fill="#3a2a10" stroke="none" />
    <circle cx="14.2" cy="13.8" r="0.9" fill="#3a2a10" stroke="none" />
    <path d="M10.6 4.6 9.4 2.4M13.4 4.6l1.2-2.2" fill="none" stroke-linecap="round" />
  </g>
);

const ICONS: Record<IconName, JSX.Element> = {
  // A drop of honey: the meadow's currency.
  coin: (
    <g>
      <path d="M12 2.5c3.2 4.4 6.8 8.4 6.8 12a6.8 6.8 0 0 1-13.6 0c0-3.6 3.6-7.6 6.8-12Z" fill="#ffb627" stroke="#a5600a" stroke-width="1.4" stroke-linejoin="round" />
      <path d="M8.6 14.6c0-1.6.8-3.2 2-4.6" fill="none" stroke="#fff1c4" stroke-width="1.6" stroke-linecap="round" />
      <circle cx="9.4" cy="17.4" r="0.9" fill="#fff1c4" />
    </g>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18Z" fill="#f4fbff" stroke="#4b8fd0" stroke-width="1.6" />,
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
  starEmpty: <path d={STAR} fill="rgba(255, 255, 255, 0.35)" stroke="rgba(90, 70, 20, 0.45)" stroke-width="1.3" stroke-dasharray="2.2 1.6" stroke-linejoin="round" />,
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
      <circle cx="7.6" cy="11.5" r="1.5" fill="#f0567a" />
      <circle cx="9.6" cy="7.6" r="1.5" fill="#ffcc33" />
      <circle cx="14.2" cy="7.2" r="1.5" fill="#3f9ff0" />
    </g>
  ),
  restart: <path d="M5.5 12a6.5 6.5 0 1 0 2-4.7M5 3.8v4h4" {...line} />,
  // A ball of pollen: the shots a round has.
  shots: (
    <g>
      <circle cx="12" cy="12" r="8" fill="#ffd23f" stroke="#a5700a" stroke-width="1.4" />
      <g fill="#e09a10">
        <circle cx="9" cy="10" r="1.2" />
        <circle cx="14.5" cy="8.6" r="1.1" />
        <circle cx="15" cy="14" r="1.2" />
        <circle cx="10" cy="15.4" r="1" />
        <circle cx="12.2" cy="12" r="0.9" />
      </g>
      <path d="M7.4 9.4c.6-1.4 1.8-2.4 3.2-2.8" fill="none" stroke="#fff6cf" stroke-width="1.4" stroke-linecap="round" />
    </g>
  ),
  // The rainbow: a ball in every colour.
  rainbow: (
    <g fill="none" stroke-linecap="round">
      <path d="M3 18a9 9 0 0 1 18 0" stroke="#f0567a" stroke-width="2.6" />
      <path d="M5.8 18a6.2 6.2 0 0 1 12.4 0" stroke="#ffcc33" stroke-width="2.6" />
      <path d="M8.6 18a3.4 3.4 0 0 1 6.8 0" stroke="#3f9ff0" stroke-width="2.6" />
      <path d="M2 19.5h20" stroke="#7a9a4a" stroke-width="1.6" />
    </g>
  ),
  // The bomb: a seed pod with a lit fuse.
  bomb: (
    <g stroke-linejoin="round" stroke-linecap="round">
      <circle cx="11" cy="14" r="7" fill="#7a4fbf" stroke="#3d2470" stroke-width="1.4" />
      <path d="M7.6 11.6c.8-1.5 2.2-2.4 3.8-2.6" fill="none" stroke="#d7c4fa" stroke-width="1.6" />
      <path d="M15.4 8.8 17.6 6.4" stroke="#6b4a1c" stroke-width="1.8" />
      <path d="M18.4 2.6v2.2M21.4 5.6h-2.2M20.6 3.4l-1.4 1.4" stroke="#ff9a1f" stroke-width="1.5" />
    </g>
  ),
  // The sunbeam: a ray of light straight up.
  sunbeam: (
    <g stroke-linecap="round">
      <path d="M9 21 12 3l3 18Z" fill="#ffe27a" stroke="#c98a0a" stroke-width="1.2" stroke-linejoin="round" />
      <circle cx="12" cy="18" r="3.4" fill="#ffc83d" stroke="#c98a0a" stroke-width="1.3" />
      <path d="M5 16.5H3M21 16.5h-2M6 11.8 4.6 10.6M18 11.8l1.4-1.2" stroke="#e0a21a" stroke-width="1.6" />
    </g>
  ),
  // The sun over the meadow: the daily meadow.
  sun: (
    <g>
      <circle cx="12" cy="10" r="4.6" fill="#ffc83d" stroke="#b5760f" stroke-width="1.3" />
      <path d="M12 2.2v1.6M5.2 4.8l1.2 1.2M18.8 4.8l-1.2 1.2M3 10h1.6M19.4 10H21" stroke="#b5760f" stroke-width="1.5" stroke-linecap="round" />
      <path d="M2.5 20.5c2.4-3 5.6-4.4 9.5-4.4s7.1 1.4 9.5 4.4Z" fill="#7cc35a" stroke="#3f7a2c" stroke-width="1.3" stroke-linejoin="round" />
      <circle cx="7.6" cy="18.6" r="0.9" fill="#f0567a" />
      <circle cx="15.4" cy="18" r="0.9" fill="#fff" />
    </g>
  ),
  bee: BEE,
  // The branch the buds hang from: the top row to clear.
  top: (
    <g stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 6.5c6-1.6 13-1.6 19 0" fill="none" stroke="#7a5230" stroke-width="2.6" />
      <path d="M17 5.6c1.4-2 3.4-2.6 5-2-1 1.6-2.8 2.4-5 2Z" fill="#6cbf4f" stroke="#3f7a2c" stroke-width="1" />
      <circle cx="7" cy="11" r="3.4" fill="#f0567a" stroke="#9c2846" stroke-width="1.2" />
      <circle cx="14" cy="11" r="3.4" fill="#ffcc33" stroke="#a5700a" stroke-width="1.2" />
      <path d="M10.5 17.5v4M8.6 19.6l1.9 1.9 1.9-1.9" fill="none" stroke="currentColor" stroke-width="1.8" />
    </g>
  ),
  // The nectar jar, which fills as buds pop and fall.
  jar: (
    <g stroke="#7a4a10" stroke-width="1.3" stroke-linejoin="round">
      <path d="M7 6.5h10v2c2 1.4 3 3.4 3 6v3.5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-3.5c0-2.6 1-4.6 3-6Z" fill="#fff6dc" />
      <path d="M4.2 13.5h15.6v4.5a3 3 0 0 1-3 3H7.2a3 3 0 0 1-3-3Z" fill="#ffb627" />
      <rect x="6" y="3" width="12" height="3.6" rx="1.2" fill="#c98a3a" />
    </g>
  ),
  // A beekeeper's hat and veil: the Keeper's Kit.
  kit: (
    <g stroke="#5a4320" stroke-width="1.3" stroke-linejoin="round">
      <path d="M5 21c0-4 .6-7 1.8-9h10.4c1.2 2 1.8 5 1.8 9Z" fill="rgba(255, 255, 255, 0.85)" stroke-dasharray="1.6 1.2" />
      <ellipse cx="12" cy="12" rx="10" ry="2.6" fill="#f2dca2" />
      <path d="M7.4 11.6C7.4 7.4 9.4 5 12 5s4.6 2.4 4.6 6.6Z" fill="#f7e7b8" />
      <path d="M7.6 10.4h8.8" fill="none" stroke="#c98a3a" stroke-width="1.6" />
    </g>
  ),
  // A basket of flowers: the Meadow Collection.
  basket: (
    <g stroke-linejoin="round">
      <path d="M6 10.5a6 6 0 0 1 12 0" fill="none" stroke="#8a5a2a" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="8" cy="10.5" r="2.4" fill="#f0567a" stroke="#9c2846" stroke-width="1" />
      <circle cx="12" cy="9.4" r="2.4" fill="#ffcc33" stroke="#a5700a" stroke-width="1" />
      <circle cx="16" cy="10.5" r="2.4" fill="#9466de" stroke="#4d2c8f" stroke-width="1" />
      <path d="M3.5 12h17l-2 8a1.6 1.6 0 0 1-1.6 1.2H7.1A1.6 1.6 0 0 1 5.5 20Z" fill="#d79a52" stroke="#7a4a1c" stroke-width="1.3" />
      <path d="M6 15.5h12M7 18.5h10" fill="none" stroke="#a8692c" stroke-width="1.1" />
    </g>
  ),
  // Wild flowers in long grass: the wild meadow past the eight zones.
  wild: (
    <g stroke-linecap="round">
      <path d="M4 21c1-4 1-8 0-11M9 21c0-5 1.4-9 4-12M15 21c0-3-1-6-3-8M20 21c-.4-4 .4-7 2-9" fill="none" stroke="#4f9a3a" stroke-width="1.6" />
      <circle cx="13" cy="8" r="2.6" fill="#ffcc33" stroke="#a5700a" stroke-width="1" />
      <circle cx="4" cy="9" r="2.2" fill="#f0567a" stroke="#9c2846" stroke-width="1" />
      <circle cx="21.4" cy="11" r="2" fill="#3f9ff0" stroke="#1d5f9c" stroke-width="1" />
    </g>
  ),
  // A round's end, given up: a little flag in the grass.
  flag: (
    <g stroke-linejoin="round">
      <path d="M7 21V3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M7 4h11l-3 4 3 4H7Z" fill="#f0567a" stroke="#9c2846" stroke-width="1.3" />
    </g>
  ),
  // Two balls trading places.
  swap: (
    <g {...line}>
      <path d="M5 9.5a7 7 0 0 1 12.2-3M19 14.5a7 7 0 0 1-12.2 3M17.6 3.4l-.2 3.4-3.4-.2M6.4 20.6l.2-3.4 3.4.2" />
    </g>
  ),
};
