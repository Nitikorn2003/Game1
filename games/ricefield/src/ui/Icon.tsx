import type { JSX } from 'preact';
import type { Marker } from '../sim/content.js';
import type { AlbumId } from '../sim/pictures.js';

export type IconName =
  | 'seed'
  | 'cloud'
  | 'gear'
  | 'shop'
  | 'play'
  | 'noads'
  | 'home'
  | 'check'
  | 'lock'
  | 'sprout'
  | 'hint'
  | 'heart'
  | 'heartEmpty'
  | 'sun'
  | 'looks'
  | 'restart'
  | 'star'
  | 'help'
  | 'hat'
  | 'frame';

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

/** Young rice: three blades from one root. Also what a planted cell shows. */
export const SPROUT = (
  <g fill="none" stroke-linecap="round">
    <path d="M12 21V11.5" stroke="#2e7b3c" stroke-width="2.2" />
    <path d="M12 14.5C11.5 10.5 9 7.5 4.5 6.5 5 10.5 7.6 13.4 12 14.5Z" fill="#7cc35b" stroke="#2e7b3c" stroke-width="1.3" stroke-linejoin="round" />
    <path d="M12 12.5C12.6 8.3 15.2 5.2 19.8 4.2 19.3 8.4 16.6 11.4 12 12.5Z" fill="#9bd66a" stroke="#2e7b3c" stroke-width="1.3" stroke-linejoin="round" />
    <path d="M12 11.5C11.4 8.6 11.6 5.6 12.6 2.8" stroke="#2e7b3c" stroke-width="1.6" />
  </g>
);

const ICONS: Record<IconName, JSX.Element> = {
  // Two golden grains of rice: the seeds everything is paid in.
  seed: (
    <g stroke="#8a5a0c" stroke-width="1.2" stroke-linejoin="round">
      <path d="M8.6 3.6C12.4 5.8 13.2 13.4 9.6 20.4 5.4 17.6 4.4 9.6 8.6 3.6Z" fill="#f4cf4d" />
      <path d="M8.9 6.5C9.8 10 9.7 14.4 9 17.6" fill="none" stroke="#c99118" stroke-width="1" stroke-linecap="round" />
      <path d="M16.2 5.2C19.6 8 19.8 15 16 20.6 12.6 17.6 12.4 10.4 16.2 5.2Z" fill="#ffe28a" />
      <path d="M16.3 8.2C17 11.2 16.9 14.6 16.2 17.4" fill="none" stroke="#c99118" stroke-width="1" stroke-linecap="round" />
    </g>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18Z" fill="#eef7ff" stroke="#4c8ed4" stroke-width="1.6" />,
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
  sprout: SPROUT,
  // A lantern lit: a hint.
  hint: (
    <g stroke-linejoin="round">
      <path d="M12 2.8a6.2 6.2 0 0 0-3.6 11.3c.7.5 1.1 1.3 1.1 2.1v.6h5v-.6c0-.8.4-1.6 1.1-2.1A6.2 6.2 0 0 0 12 2.8Z" fill="#ffe28a" stroke="#a86e0c" stroke-width="1.4" />
      <path d="M9.6 19h4.8M10.4 21.3h3.2" stroke="#7a5a2a" stroke-width="1.6" stroke-linecap="round" />
      <path d="M10.2 9.2c.3-1.3 1.1-2.1 2.3-2.4" fill="none" stroke="#fff6d6" stroke-width="1.4" stroke-linecap="round" />
    </g>
  ),
  heart: <path d="M12 20.3S3.5 15 3.5 9.2A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8.5 2.2C20.5 15 12 20.3 12 20.3Z" fill="#e5533f" stroke="#9a2a1e" stroke-width="1.3" stroke-linejoin="round" />,
  heartEmpty: (
    <path
      d="M12 20.3S3.5 15 3.5 9.2A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8.5 2.2C20.5 15 12 20.3 12 20.3Z"
      fill="rgba(60, 50, 40, 0.12)"
      stroke="rgba(60, 50, 40, 0.45)"
      stroke-width="1.3"
      stroke-dasharray="2.2 1.6"
      stroke-linejoin="round"
    />
  ),
  // The sun coming up over the paddies: the daily field.
  sun: (
    <g>
      <path d="M5 15a7 7 0 0 1 14 0Z" fill="#ffc45a" stroke="#c07a12" stroke-width="1.3" stroke-linejoin="round" />
      <path d="M12 3.8V6M5.3 7.3l1.4 1.4M18.7 7.3l-1.4 1.4M2.5 13.5H4M20 13.5h1.5" stroke="#c07a12" stroke-width="1.6" stroke-linecap="round" />
      <path d="M2.5 18h19M5 21h14" stroke="#4f9a45" stroke-width="1.8" stroke-linecap="round" />
    </g>
  ),
  // A painter's palette: how things look.
  looks: (
    <g>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.6-2.2-.5-1.4.4-2.6 1.9-2.6H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.3 16.7 3.5 12 3.5Z" {...line} />
      <circle cx="7.6" cy="11.5" r="1.5" fill="#d24c3f" />
      <circle cx="9.6" cy="7.6" r="1.5" fill="#f4cf4d" />
      <circle cx="14.2" cy="7.2" r="1.5" fill="#4f9a45" />
    </g>
  ),
  restart: <path d="M5.5 12a6.5 6.5 0 1 0 2-4.7M5 3.8v4h4" {...line} />,
  star: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z" fill="#f4cf4d" stroke="#a86e0c" stroke-width="1.3" stroke-linejoin="round" />,
  help: (
    <g {...line}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.4a2.7 2.7 0 1 1 3.7 2.5c-.7.3-1.1.9-1.1 1.6v.5M12 17.2v.1" />
    </g>
  ),
  // A farmer's hat woven from palm leaf: the Farmer's Kit.
  hat: (
    <g stroke-linejoin="round">
      <path d="M2.5 16.5 12 5l9.5 11.5c-2.6 1.6-6 2.4-9.5 2.4s-6.9-.8-9.5-2.4Z" fill="#e2bd78" stroke="#7a5326" stroke-width="1.3" />
      <path d="M7.4 11 12 5l4.6 6M5.5 14c4.2 1.6 8.8 1.6 13 0" fill="none" stroke="#a87a3c" stroke-width="1" />
      <path d="M8 18.8c1 1.9 2.4 2.7 4 2.7s3-.8 4-2.7" fill="none" stroke="#d24c3f" stroke-width="1.3" stroke-linecap="round" />
    </g>
  ),
  // A framed field: the Field Collection.
  frame: (
    <g stroke-linejoin="round">
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" fill="#fff7e0" stroke="#8c5a33" stroke-width="1.6" />
      <path d="M5 17.5c2.5-3.5 4.8-5.3 7-5.3s4.5 1.8 7 5.3Z" fill="#79b85a" />
      <path d="M5 17.5c3-2 5.5-2.8 8-2.8s4 .5 6 1.6v1.2Z" fill="#4f9a45" />
      <circle cx="15.5" cy="8.6" r="1.8" fill="#f4cf4d" />
    </g>
  ),
};

/** What marks a cell left without rice: a pebble, or a look bought for it. Drawn on a 24 × 24 grid. */
export const MARKERS: Record<Marker, JSX.Element> = {
  pebble: (
    <g>
      <path d="M5.5 14.2c0-3.4 3-5.7 6.8-5.7s6.2 2.3 6.2 5.2c0 3-2.9 4.8-6.6 4.8s-6.4-1.4-6.4-4.3Z" fill="#a8aeb2" stroke="#6c7377" stroke-width="1.2" />
      <path d="M9 11.6c1-.9 2.3-1.3 3.6-1.2" fill="none" stroke="#e1e5e7" stroke-width="1.3" stroke-linecap="round" />
    </g>
  ),
  frog: (
    <g stroke="#245c2c" stroke-width="1.1" stroke-linejoin="round">
      <path d="M4.5 16.5c0-4 3.3-6.8 7.5-6.8s7.5 2.8 7.5 6.8c0 1.6-1.7 2.6-7.5 2.6s-7.5-1-7.5-2.6Z" fill="#6cbf4e" />
      <circle cx="8.6" cy="9.4" r="2.4" fill="#8fd36a" />
      <circle cx="15.4" cy="9.4" r="2.4" fill="#8fd36a" />
      <circle cx="8.6" cy="9.2" r="0.9" fill="#1d2a1f" stroke="none" />
      <circle cx="15.4" cy="9.2" r="0.9" fill="#1d2a1f" stroke="none" />
      <path d="M9.5 15c1.6.9 3.4.9 5 0" fill="none" stroke-linecap="round" />
    </g>
  ),
  blossom: (
    <g stroke="#a3335f" stroke-width="1" stroke-linejoin="round">
      <path d="M12 4.5c2.4 2.8 2.8 6 0 9.4-2.8-3.4-2.4-6.6 0-9.4Z" fill="#ffc1d8" />
      <path d="M4.2 9.4c3.7.2 6 2.3 6.8 5.8-3.7-.2-6-2.3-6.8-5.8ZM19.8 9.4c-3.7.2-6 2.3-6.8 5.8 3.7-.2 6-2.3 6.8-5.8Z" fill="#f28ab3" />
      <path d="M6 16.2c3.6 2.2 8.4 2.2 12 0" fill="none" stroke="#3f8f3a" stroke-width="1.6" stroke-linecap="round" />
      <circle cx="12" cy="14.8" r="1.2" fill="#f4cf4d" stroke="none" />
    </g>
  ),
  snail: (
    <g stroke-linejoin="round" stroke-linecap="round">
      <path d="M3.8 18.2h13.6c1.4 0 2.6-.9 2.9-2.3L21 12.6" fill="none" stroke="#7d6a3a" stroke-width="2" />
      <path d="M19.8 12.4 21.4 9M21 12.6l2-2.2" fill="none" stroke="#7d6a3a" stroke-width="1" />
      <circle cx="10.8" cy="12.6" r="5.2" fill="#d99a52" stroke="#7a4a1c" stroke-width="1.2" />
      <path d="M10.8 12.6c.4-1.1 1.9-1 2.1.2.3 1.6-1.3 2.8-2.8 2.5-2-.4-2.8-2.6-2-4.4 1-2.1 3.8-2.7 5.6-1.3" fill="none" stroke="#7a4a1c" stroke-width="1.1" />
    </g>
  ),
};

/** A marker on its own, as the board and the looks draw it. */
export function MarkerArt(props: { marker: Marker; size?: number }): JSX.Element {
  const size = props.size ?? 24;
  return (
    <svg class="marker-art" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {MARKERS[props.marker]}
    </svg>
  );
}

/** Each album's emblem, drawn on a 48 × 48 grid. */
export function AlbumArt(props: { id: AlbumId; size?: number }): JSX.Element {
  const size = props.size ?? 44;
  return (
    <svg class="album-art" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="11" fill={ALBUM_GROUND[props.id]} />
      {ALBUM_ART[props.id]}
    </svg>
  );
}

const ALBUM_GROUND: Record<AlbumId, string> = {
  first: '#d9efc4',
  water: '#cfe9f5',
  farm: '#f3e3c3',
  village: '#f6dccf',
  harvest: '#fbe7a9',
  sky: '#dbe8fb',
};

const ALBUM_ART: Record<AlbumId, JSX.Element> = {
  // A seedling in its first paddy.
  first: (
    <g>
      <path d="M8 38h32" stroke="#6aa9c9" stroke-width="3" stroke-linecap="round" />
      <g transform="translate(9 8) scale(1.25)">{SPROUT}</g>
    </g>
  ),
  // A fish jumping over the ripples.
  water: (
    <g stroke-linejoin="round">
      <path d="M9 36c3-2 6 2 9 0s6 2 9 0 6 2 9 0" fill="none" stroke="#4c8ed4" stroke-width="2.4" stroke-linecap="round" />
      <path d="M12 24c4-7 13-9 20-4l5-4v12l-5-4c-7 5-16 3-20-4Z" transform="rotate(-14 24 24)" fill="#ef8f35" stroke="#a5531a" stroke-width="1.6" />
      <circle cx="17.5" cy="23.5" r="1.4" fill="#2f2631" />
    </g>
  ),
  // A water buffalo, horns and all.
  farm: (
    <g stroke-linejoin="round" stroke-linecap="round">
      <path d="M8 14c2 6 7 7 11 6M40 14c-2 6-7 7-11 6" fill="none" stroke="#c9a46a" stroke-width="3.2" />
      <path d="M16 19h16c1.5 4 1.5 9-1 13-1.8 3-4.4 4.5-7 4.5s-5.2-1.5-7-4.5c-2.5-4-2.5-9-1-13Z" fill="#5d5960" stroke="#2f2631" stroke-width="1.6" />
      <path d="M19.5 31.5c2.8 1.6 6.2 1.6 9 0" fill="none" stroke="#9ba3a8" stroke-width="4.5" />
      <circle cx="20" cy="25" r="1.5" fill="#f7f2e6" />
      <circle cx="28" cy="25" r="1.5" fill="#f7f2e6" />
    </g>
  ),
  // A house up on its stilts.
  village: (
    <g stroke-linejoin="round" stroke-linecap="round">
      <path d="M8 22 24 9l16 13Z" fill="#d24c3f" stroke="#8a2a20" stroke-width="1.6" />
      <path d="M12 21h24v10H12Z" fill="#c98b52" stroke="#6b4416" stroke-width="1.6" />
      <path d="M21 24h6v7h-6Z" fill="#6b4416" />
      <path d="M14 31v8M22 31v8M30 31v8M36 31v8M9 39h30" stroke="#6b4416" stroke-width="2" />
    </g>
  ),
  // A sheaf of ripe rice.
  harvest: (
    <g stroke-linecap="round" stroke-linejoin="round">
      <path d="M24 40V24M24 24c-3-6-8-9-13-9M24 24c3-6 8-9 13-9M24 24c-1-7 0-12 0-16" fill="none" stroke="#a87a1c" stroke-width="2" />
      <path d="M16 31h16" stroke="#8c5a33" stroke-width="4" />
      <g fill="#f4cf4d" stroke="#a86e0c" stroke-width="1">
        <ellipse cx="11" cy="15" rx="2" ry="3.4" transform="rotate(-60 11 15)" />
        <ellipse cx="15" cy="17" rx="2" ry="3.4" transform="rotate(-45 15 17)" />
        <ellipse cx="37" cy="15" rx="2" ry="3.4" transform="rotate(60 37 15)" />
        <ellipse cx="33" cy="17" rx="2" ry="3.4" transform="rotate(45 33 17)" />
        <ellipse cx="24" cy="9" rx="2" ry="3.4" />
        <ellipse cx="24" cy="15" rx="2" ry="3.4" />
      </g>
    </g>
  ),
  // A kite under a cloud.
  sky: (
    <g stroke-linejoin="round" stroke-linecap="round">
      <path d="M11 20h17a5 5 0 0 0 .8-9.9A7 7 0 0 0 15.5 9a5.5 5.5 0 0 0-4.5 11Z" fill="#ffffff" stroke="#8fb3d9" stroke-width="1.6" />
      <path d="M33 19l7 8-7 8-7-8Z" fill="#f4cf4d" stroke="#a86e0c" stroke-width="1.4" />
      <path d="M33 19v16M26 27h14" stroke="#d24c3f" stroke-width="1.2" />
      <path d="M33 35c-2 3-6 2-8 5" fill="none" stroke="#7d6a3a" stroke-width="1.3" />
    </g>
  ),
};
