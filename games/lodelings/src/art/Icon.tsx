import type { JSX } from 'preact';

export type IconName =
  | 'ore'
  | 'gem'
  | 'dust'
  | 'pick'
  | 'lamp'
  | 'cart'
  | 'echo'
  | 'dynamite'
  | 'frenzy'
  | 'goldrush'
  | 'rally'
  | 'creatures'
  | 'egg'
  | 'relic'
  | 'shop'
  | 'gear'
  | 'scroll'
  | 'play'
  | 'lock'
  | 'clock'
  | 'star'
  | 'sound'
  | 'mute'
  | 'up'
  | 'sword'
  | 'gift'
  | 'trophy';

const PATHS: Record<IconName, JSX.Element> = {
  ore: (
    <g>
      <path d="M4 15L8 7L15 5L21 10L19 18L10 20Z" fill="#f6b93b" stroke="#7a4b00" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M8 7L12 12L15 5M12 12L19 18M12 12L10 20" fill="none" stroke="#b8860b" stroke-width="1" />
      <path d="M9 9L11 8" stroke="#fff6c8" stroke-width="1.6" stroke-linecap="round" />
    </g>
  ),
  gem: (
    <g>
      <path d="M6 4H18L22 9L12 21L2 9Z" fill="#63d3ff" stroke="#0b5470" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M2 9H22M8 4L12 9L16 4M12 9V21M7 9L12 21L17 9" fill="none" stroke="#0b5470" stroke-width="0.9" opacity="0.7" />
      <path d="M7 6L9 6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />
    </g>
  ),
  dust: (
    <g fill="#c99bff" stroke="#4b1f80" stroke-width="1.2" stroke-linejoin="round">
      <path d="M12 2L14 9L21 12L14 15L12 22L10 15L3 12L10 9Z" />
      <circle cx="19" cy="4" r="1.6" stroke="none" fill="#efe0ff" />
      <circle cx="5" cy="20" r="1.3" stroke="none" fill="#efe0ff" />
    </g>
  ),
  pick: (
    <g stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 20L15 10" stroke="#8a5a2b" stroke-width="3" />
      <path d="M8 4C13 3 19 6 21 12C18 9 14 7 10 7Z" fill="#cfd8e3" stroke="#3b4652" stroke-width="1.5" />
    </g>
  ),
  lamp: (
    <g stroke="#5a3d00" stroke-width="1.4" stroke-linejoin="round">
      <path d="M8 6H16L18 18H6Z" fill="#ffd166" />
      <path d="M9 3H15V6H9Z" fill="#8a6b3a" />
      <circle cx="12" cy="12" r="3" fill="#fff6c8" stroke="none" />
      <path d="M5 21H19" />
    </g>
  ),
  cart: (
    <g stroke="#3b2a1a" stroke-width="1.5" stroke-linejoin="round">
      <path d="M3 8H21L19 16H5Z" fill="#a0663a" />
      <path d="M6 8L8 5L11 7L14 4L17 6L19 8Z" fill="#f6b93b" />
      <circle cx="8" cy="19" r="2" fill="#555" />
      <circle cx="16" cy="19" r="2" fill="#555" />
    </g>
  ),
  echo: (
    <g fill="none" stroke="#63d3ff" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="3" fill="#63d3ff" />
      <path d="M6 6A8.5 8.5 0 0 0 6 18M18 6A8.5 8.5 0 0 1 18 18" />
      <path d="M3 3A13 13 0 0 0 3 21M21 3A13 13 0 0 1 21 21" opacity="0.5" />
    </g>
  ),
  dynamite: (
    <g stroke-linejoin="round">
      <path d="M7 9H17V21H7Z" fill="#e2483d" stroke="#5a0f0a" stroke-width="1.5" />
      <path d="M7 13H17M7 17H17" stroke="#ffb3a8" stroke-width="1.2" />
      <path d="M12 9C12 6 14 4 17 4" fill="none" stroke="#3b2a1a" stroke-width="1.5" />
      <path d="M17 1L18 3L20 3.6L18 4.4L17 7L16 4.4L14 3.6L16 3Z" fill="#ffd166" />
    </g>
  ),
  frenzy: (
    <g stroke="#5a3d00" stroke-width="1.4" stroke-linejoin="round">
      <path d="M9 21V12L6 9V5H9V9M9 5V3H12V9M12 3H15V9M15 4H18V13L15 21Z" fill="#ffd8b0" />
      <path d="M2 8H5M1 12H5M2 16H5" stroke="#ff7a45" stroke-width="2" stroke-linecap="round" />
    </g>
  ),
  goldrush: (
    <g stroke="#7a4b00" stroke-width="1.4">
      <ellipse cx="9" cy="16" rx="6" ry="3" fill="#f6b93b" />
      <ellipse cx="9" cy="13" rx="6" ry="3" fill="#ffd166" />
      <ellipse cx="15" cy="9" rx="6" ry="3" fill="#ffd166" />
      <path d="M19 2L20 4L22 5L20 6L19 8L18 6L16 5L18 4Z" fill="#fff6c8" stroke="none" />
    </g>
  ),
  rally: (
    <g stroke="#3b1d5a" stroke-width="1.4" stroke-linejoin="round">
      <path d="M5 3V21" stroke-width="2" stroke-linecap="round" />
      <path d="M5 4H19L16 8.5L19 13H5Z" fill="#c07bff" />
      <path d="M9 7L10 9L12 9.5L10 10L9 12L8 10L6 9.5L8 9Z" fill="#fff" stroke="none" />
    </g>
  ),
  creatures: (
    <g stroke="#1f4d1d" stroke-width="1.4" stroke-linejoin="round">
      <path d="M12 4C17 4 20 8 20 13C20 18 16 21 12 21C8 21 4 18 4 13C4 8 7 4 12 4Z" fill="#62cf63" />
      <circle cx="9.5" cy="12" r="1.6" fill="#1f4d1d" stroke="none" />
      <circle cx="14.5" cy="12" r="1.6" fill="#1f4d1d" stroke="none" />
      <path d="M10 16Q12 18 14 16" fill="none" />
      <path d="M12 4V1.5M12 2C10 0.5 8.5 1.5 8.5 3" fill="none" />
    </g>
  ),
  egg: <path d="M12 2C16.5 2 20 9 20 14C20 18.5 16.5 22 12 22C7.5 22 4 18.5 4 14C4 9 7.5 2 12 2Z" fill="#e6ddd3" stroke="#4a3e35" stroke-width="1.5" />,
  relic: (
    <g stroke="#4b1f80" stroke-width="1.4" stroke-linejoin="round">
      <path d="M8 3H16L12 8Z" fill="#8a6b3a" />
      <path d="M12 8L19 13L12 22L5 13Z" fill="#c99bff" />
      <path d="M5 13H19M12 8V22" stroke-width="0.8" />
    </g>
  ),
  shop: (
    <g stroke="#5a2400" stroke-width="1.5" stroke-linejoin="round">
      <path d="M4 8H20L19 21H5Z" fill="#ff9f5a" />
      <path d="M8 10V6A4 4 0 0 1 16 6V10" fill="none" />
    </g>
  ),
  gear: (
    <g>
      <path
        d="M10 2H14L14.6 4.6L17 5.6L19.3 4.2L21.8 6.7L20.4 9L21.4 11.4L24 12V12L21.4 12.6L20.4 15L21.8 17.3L19.3 19.8L17 18.4L14.6 19.4L14 22H10L9.4 19.4L7 18.4L4.7 19.8L2.2 17.3L3.6 15L2.6 12.6L0 12L2.6 11.4L3.6 9L2.2 6.7L4.7 4.2L7 5.6L9.4 4.6Z"
        fill="#c9b8a6"
        transform="scale(0.92) translate(1 1)"
      />
      <circle cx="12" cy="12" r="3.5" fill="#241d19" />
    </g>
  ),
  scroll: (
    <g stroke="#5a3d00" stroke-width="1.4" stroke-linejoin="round">
      <path d="M6 3H18V19A2 2 0 0 1 16 21H4A2 2 0 0 0 6 19Z" fill="#ffe7b8" />
      <path d="M9 8H15M9 12H15M9 16H13" stroke-linecap="round" />
    </g>
  ),
  play: (
    <g>
      <circle cx="12" cy="12" r="10" fill="#c89bff" />
      <path d="M10 8L16 12L10 16Z" fill="#26084a" />
    </g>
  ),
  lock: (
    <g stroke="#c9b8a6" stroke-width="1.8" fill="none">
      <rect x="5" y="10" width="14" height="11" rx="2" fill="#3a2f29" />
      <path d="M8 10V7A4 4 0 0 1 16 7V10" />
    </g>
  ),
  clock: (
    <g fill="none" stroke="#c9b8a6" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7V12L15 14" />
    </g>
  ),
  star: <path d="M12 2L15 9L22 9.5L16.5 14L18.5 21L12 17L5.5 21L7.5 14L2 9.5L9 9Z" fill="#ffc23d" stroke="#7a4b00" stroke-width="1.2" stroke-linejoin="round" />,
  sound: (
    <g fill="#c9b8a6" stroke="#c9b8a6" stroke-width="1.6" stroke-linecap="round">
      <path d="M3 9H7L12 5V19L7 15H3Z" />
      <path d="M16 8A5 5 0 0 1 16 16M19 5A9 9 0 0 1 19 19" fill="none" />
    </g>
  ),
  mute: (
    <g fill="#c9b8a6" stroke="#c9b8a6" stroke-width="1.6" stroke-linecap="round">
      <path d="M3 9H7L12 5V19L7 15H3Z" />
      <path d="M16 9L22 15M22 9L16 15" />
    </g>
  ),
  up: <path d="M12 4L20 13H15V20H9V13H4Z" fill="#7bd88f" stroke="#0b3d18" stroke-width="1.4" stroke-linejoin="round" />,
  sword: (
    <g stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 3H21V10L10 21L3 14Z" fill="#cfd8e3" stroke="#3b4652" stroke-width="1.5" />
      <path d="M6 16L8 18" stroke="#3b4652" stroke-width="2" />
    </g>
  ),
  gift: (
    <g stroke="#5a1f2e" stroke-width="1.4" stroke-linejoin="round">
      <rect x="3" y="9" width="18" height="12" rx="1.5" fill="#ff7a8a" />
      <rect x="2" y="6" width="20" height="4" rx="1" fill="#ff9aa6" />
      <path d="M12 6V21" stroke="#ffd35c" stroke-width="2.6" />
      <path d="M12 6C10 2 6 2.5 7 5C7.6 6.2 10 6 12 6C14 6 16.4 6.2 17 5C18 2.5 14 2 12 6Z" fill="#ffd35c" />
    </g>
  ),
  trophy: (
    <g stroke="#7a4b00" stroke-width="1.4" stroke-linejoin="round">
      <path d="M7 3H17V9A5 5 0 0 1 7 9Z" fill="#ffc23d" />
      <path d="M7 5H4V7A3 3 0 0 0 7.5 10M17 5H20V7A3 3 0 0 1 16.5 10" fill="none" />
      <path d="M10.5 14H13.5V17H10.5Z" fill="#e0a12a" />
      <path d="M7.5 21V19A2 2 0 0 1 9.5 17H14.5A2 2 0 0 1 16.5 19V21Z" fill="#c98a1e" />
    </g>
  ),
};

export function Icon(props: { name: IconName; size?: number; class?: string }): JSX.Element {
  const size = props.size ?? 20;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} class={`icon ${props.class ?? ''}`} aria-hidden="true">
      {PATHS[props.name]}
    </svg>
  );
}
