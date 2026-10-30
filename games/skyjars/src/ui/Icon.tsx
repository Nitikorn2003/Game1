import type { JSX } from 'preact';
import type { SymbolName } from '../sim/content.js';

export type IconName =
  | 'stardust'
  | 'star'
  | 'cloud'
  | 'gear'
  | 'shop'
  | 'play'
  | 'noads'
  | 'home'
  | 'undo'
  | 'restart'
  | 'jar'
  | 'hint'
  | 'atlas'
  | 'looks'
  | 'moon'
  | 'check'
  | 'lock'
  | 'lantern'
  | 'telescope';

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
  // A four-point sparkle with two small ones: the currency.
  stardust: (
    <g>
      <path d="M10 2.5c.7 4.6 2.4 6.4 7 7.2-4.6.8-6.3 2.6-7 7.3-.7-4.7-2.4-6.5-7-7.3 4.6-.8 6.3-2.6 7-7.2Z" fill="#ffe08a" stroke="#c98a1e" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M18.5 13.5c.3 1.9 1 2.7 2.9 3-1.9.3-2.6 1.1-2.9 3-.3-1.9-1-2.7-2.9-3 1.9-.3 2.6-1.1 2.9-3Z" fill="#d9c6ff" stroke="#8b6fd6" stroke-width="1" stroke-linejoin="round" />
      <circle cx="18.5" cy="5" r="1.3" fill="#fff4c9" />
    </g>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" fill="#fff0a8" stroke="#c9a13a" stroke-width="1.4" stroke-linejoin="round" />,
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18Z" fill="#d8e4ff" stroke="#5a6fb0" stroke-width="1.6" />,
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
  restart: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9" {...line} />,
  // A jar with a plus: one more empty jar.
  jar: (
    <g {...line}>
      <path d="M8 3.5h8M8.5 3.5v3L6 9.5V19a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V9.5l-2.5-3v-3" />
      <path d="M12 11v6M9 14h6" />
    </g>
  ),
  // A wand with a spark at its tip.
  hint: (
    <g>
      <path d="M4 20 14 10" {...line} stroke-width="2.4" />
      <path d="M16.5 2.5c.4 2.4 1.3 3.4 3.7 3.8-2.4.4-3.3 1.4-3.7 3.8-.4-2.4-1.3-3.4-3.7-3.8 2.4-.4 3.3-1.4 3.7-3.8Z" fill="#ffe08a" stroke="#c98a1e" stroke-width="1" stroke-linejoin="round" />
    </g>
  ),
  // Stars joined by lines: a constellation.
  atlas: (
    <g>
      <path d="M4 17 9 8l6 4 5-7" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.7" />
      <circle cx="4" cy="17" r="2" fill="#fff0a8" />
      <circle cx="9" cy="8" r="2.2" fill="#fff0a8" />
      <circle cx="15" cy="12" r="1.8" fill="#fff0a8" />
      <circle cx="20" cy="5" r="2" fill="#fff0a8" />
    </g>
  ),
  // A paint drop and a brush stroke: how things look.
  looks: (
    <g {...line}>
      <path d="M12 3.5c3.5 4 5.5 6.9 5.5 9.5a5.5 5.5 0 0 1-11 0c0-2.6 2-5.5 5.5-9.5Z" />
      <path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" />
    </g>
  ),
  moon: <path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.6A7 7 0 0 1 15.5 3.5Z" fill="#fff0c2" stroke="#c9a13a" stroke-width="1.4" stroke-linejoin="round" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" {...line} stroke-width="2.6" />,
  lock: (
    <g {...line}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </g>
  ),
  lantern: (
    <g stroke="#7a5418" stroke-width="1.4" stroke-linejoin="round">
      <path d="M9.5 4.5a2.5 2.5 0 0 1 5 0" fill="none" />
      <path d="M8 6.5h8l1.5 2.5v9l-1.5 2.5H8L6.5 18V9L8 6.5Z" fill="#ffd36e" />
      <path d="M9.5 10h5v7h-5z" fill="#fff6d1" />
    </g>
  ),
  telescope: (
    <g {...line}>
      <path d="m3.5 13.5 13-6.5 1.8 3.6-13 6.5-1.8-3.6ZM16.5 7l1.4-.7 1.8 3.6-1.4.7" />
      <path d="M11 14.5 8 21M12 14l3.5 7" />
    </g>
  ),
};

/** The symbol on every unit of a colour, so colours can be told apart without seeing colour. */
export function Glyph(props: { name: SymbolName }): JSX.Element {
  return (
    <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
      {GLYPHS[props.name]}
    </svg>
  );
}

/** A symbol's shapes alone, 24 wide, in `currentColor`, for drawing inside another SVG. */
export function GlyphShape(props: { name: SymbolName }): JSX.Element {
  return GLYPHS[props.name];
}

const glyph = { fill: 'currentColor' } as const;

const GLYPHS: Record<SymbolName, JSX.Element> = {
  heart: <path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.7-8 10.6-8 10.6Z" {...glyph} />,
  sun: (
    <g>
      <circle cx="12" cy="12" r="4.6" {...glyph} />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    </g>
  ),
  star: <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z" {...glyph} />,
  leaf: (
    <g>
      <path d="M5 19C4 10.5 9.5 4.5 19.5 4.5 19.5 14 13.5 20 5 19Z" {...glyph} />
      <path d="M5 19 13 11" stroke="rgba(0,0,0,0.35)" stroke-width="1.6" stroke-linecap="round" />
    </g>
  ),
  drop: <path d="M12 2.5c4.2 5 6.5 8.4 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10.9 7.8 7.5 12 2.5Z" {...glyph} />,
  moon: <path d="M15 3a9 9 0 1 0 6 14.6A7.4 7.4 0 0 1 15 3Z" {...glyph} />,
  diamond: <path d="M12 2.5 20.5 12 12 21.5 3.5 12 12 2.5Z" {...glyph} />,
  flower: (
    <g {...glyph}>
      <circle cx="12" cy="6.5" r="3.6" />
      <circle cx="17.2" cy="10.3" r="3.6" />
      <circle cx="15.2" cy="16.5" r="3.6" />
      <circle cx="8.8" cy="16.5" r="3.6" />
      <circle cx="6.8" cy="10.3" r="3.6" />
      <circle cx="12" cy="12" r="2.6" fill="rgba(0,0,0,0.3)" />
    </g>
  ),
  ring: <circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" stroke-width="3.6" />,
  wave: <path d="M2.5 9.5c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0 3.6-2 4.6-.8M2.5 16c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0 3.6-2 4.6-.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />,
};
