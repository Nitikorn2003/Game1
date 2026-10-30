import type { JSX } from 'preact';

export type IconName = 'coin' | 'cloud' | 'gear' | 'shop' | 'play' | 'noads';

/** The game's small icons, drawn on a 24 × 24 grid. */
export function Icon(props: { name: IconName; size?: number }): JSX.Element {
  const size = props.size ?? 20;
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[props.name]}
    </svg>
  );
}

const ICONS: Record<IconName, JSX.Element> = {
  coin: (
    <g>
      <circle cx="12" cy="12" r="10" fill="#f5b83d" stroke="#8a5a00" stroke-width="1.6" />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff1c2" stroke-width="1.6" opacity="0.8" />
    </g>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18Z" fill="#cfe8ff" stroke="#3b6b94" stroke-width="1.6" />,
  gear: (
    <g fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke-linecap="round" />
    </g>
  ),
  shop: <path d="M4 9h16l-1.4 10.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 9Zm4 0V7a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />,
  noads: (
    <g>
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" opacity="0.45" />
      <path d="M4.5 4.5l15 15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </g>
  ),
};
