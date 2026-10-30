import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import type { EggKind } from '../sim/content.js';

const EGG = 'M50 8C70 8 86 40 86 62C86 82 70 94 50 94C30 94 14 82 14 62C14 40 30 8 50 8Z';

const LOOK: Record<EggKind, { from: string; to: string; ink: string }> = {
  starter: { from: '#fff6df', to: '#e8cf9c', ink: '#7a5a2a' },
  pebble: { from: '#e6ddd3', to: '#9a8b7d', ink: '#4a3e35' },
  geode: { from: '#b58a63', to: '#6b4a32', ink: '#2e1c10' },
  prism: { from: '#ffe7fb', to: '#9fd2ff', ink: '#4b3a7a' },
};

export function EggArt(props: { kind: EggKind; size?: number; wobble?: boolean }): JSX.Element {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const look = LOOK[props.kind];
  const grad = `eg-${uid}`;
  const clip = `ec-${uid}`;
  return (
    <svg viewBox="0 0 100 100" width={props.size ?? 48} height={props.size ?? 48} class={`egg ${props.wobble ? 'egg--wobble' : ''}`} aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stop-color={look.from} />
          <stop offset="1" stop-color={look.to} />
        </linearGradient>
        <clipPath id={clip}>
          <path d={EGG} />
        </clipPath>
      </defs>
      <ellipse cx="50" cy="94" rx="28" ry="4" fill="#000" opacity="0.3" />
      <path d={EGG} fill={`url(#${grad})`} stroke={look.ink} stroke-width="3" />
      <g clip-path={`url(#${clip})`}>
        {props.kind === 'starter' && (
          <g fill="#7cc36b">
            <circle cx="36" cy="40" r="7" />
            <circle cx="62" cy="58" r="9" />
            <circle cx="40" cy="74" r="5" />
          </g>
        )}
        {props.kind === 'pebble' && (
          <g fill={look.ink} opacity="0.35">
            <circle cx="38" cy="36" r="4" />
            <circle cx="60" cy="48" r="5" />
            <circle cx="44" cy="66" r="3.5" />
            <circle cx="66" cy="74" r="3" />
          </g>
        )}
        {props.kind === 'geode' && (
          <g>
            <path d="M14 56L30 48L40 58L52 46L64 58L76 50L90 58L90 70L14 70Z" fill="#7b4bb8" />
            <path d="M24 66L32 52L38 66ZM46 66L52 50L58 66ZM66 66L74 54L80 66Z" fill="#d7b6ff" />
          </g>
        )}
        {props.kind === 'prism' && (
          <g opacity="0.75">
            <path d="M0 30L100 10V24L0 44Z" fill="#ff9ad5" />
            <path d="M0 50L100 30V44L0 64Z" fill="#ffe17a" />
            <path d="M0 70L100 50V64L0 84Z" fill="#8ef0c1" />
          </g>
        )}
        <path d="M28 22C34 14 44 12 50 12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.6" />
      </g>
    </svg>
  );
}
