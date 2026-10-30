import { Rng } from '@game1/engine';
import type { JSX } from 'preact';
import { useId, useMemo } from 'preact/hooks';
import type { Element } from '../sim/content.js';
import { ELEMENT_COLORS } from './palette.js';

export interface GuardianArtProps {
  depth: number;
  element: Element;
  rockHue: number;
  health: number;
  size?: number;
}

/** A stone Guardian with crystals and markings of its element. Its build varies with the depth. */
export function GuardianArt(props: GuardianArtProps): JSX.Element {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const look = useMemo(() => {
    const rng = new Rng(props.depth * 7919);
    return {
      shoulder: 14 + rng.int(10),
      horn: rng.int(3),
      crystals: 2 + rng.int(3),
      jaw: rng.next() > 0.5,
      tilt: (rng.next() - 0.5) * 6,
    };
  }, [props.depth]);
  const el = ELEMENT_COLORS[props.element];
  const stone = `gs-${uid}`;
  const core = `gc-${uid}`;
  const rock = (light: number) => `hsl(${props.rockHue} 18% ${light}%)`;
  const angry = props.health < 0.35;
  return (
    <svg viewBox="0 0 220 220" width={props.size ?? 220} height={props.size ?? 220} class="guardian" aria-hidden="true">
      <defs>
        <linearGradient id={stone} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color={rock(56)} />
          <stop offset="1" stop-color={rock(22)} />
        </linearGradient>
        <radialGradient id={core}>
          <stop offset="0" stop-color="#fff" />
          <stop offset="0.4" stop-color={el.glow} />
          <stop offset="1" stop-color={el.main} stop-opacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="206" rx="86" ry="11" fill="#000" opacity="0.4" />
      <g transform={`rotate(${look.tilt} 110 120)`}>
        {/* arms */}
        <path d="M30 96C14 104 10 140 22 170C30 186 50 184 54 168L60 120Z" fill={`url(#${stone})`} stroke={rock(10)} stroke-width="4" stroke-linejoin="round" />
        <path d="M190 96C206 104 210 140 198 170C190 186 170 184 166 168L160 120Z" fill={`url(#${stone})`} stroke={rock(10)} stroke-width="4" stroke-linejoin="round" />
        {/* body */}
        <path d={`M56 ${92 - look.shoulder / 2}C70 ${70 - look.shoulder} 150 ${70 - look.shoulder} 164 ${92 - look.shoulder / 2}C176 120 172 170 150 192C128 202 92 202 70 192C48 170 44 120 56 ${92 - look.shoulder / 2}Z`} fill={`url(#${stone})`} stroke={rock(10)} stroke-width="4" stroke-linejoin="round" />
        <circle cx="110" cy="140" r="26" fill={`url(#${core})`} class="lod-pulse" />
        <path d="M110 122L118 140L110 158L102 140Z" fill={el.glow} stroke={el.main} stroke-width="2" />
        {/* markings */}
        {props.element === 'ember' && <path d="M72 120L86 132L80 150M148 120L134 134L142 152M96 176L110 168L124 178" fill="none" stroke="#ffb35a" stroke-width="4" stroke-linecap="round" class="lod-flicker" />}
        {props.element === 'tide' && <path d="M70 160Q80 150 90 160T110 160T130 160T150 160" fill="none" stroke="#8fe0ff" stroke-width="4" stroke-linecap="round" />}
        {props.element === 'grove' && (
          <g fill="#7fd46b" opacity="0.9">
            <ellipse cx="74" cy="112" rx="14" ry="7" />
            <ellipse cx="150" cy="170" rx="12" ry="6" />
            <path d="M60 96C64 112 58 124 66 134" fill="none" stroke="#4f9a3f" stroke-width="3" />
          </g>
        )}
        {props.element === 'volt' && <path d="M76 110L90 126L82 132L96 150M146 108L132 126L140 132L126 152" fill="none" stroke="#fff07a" stroke-width="4" stroke-linejoin="round" class="lod-flicker" />}
        {/* crystals on the shoulders */}
        {Array.from({ length: look.crystals }, (_, i) => {
          const x = 62 + i * 14;
          return <path key={`l${i}`} d={`M${x} 88L${x + 5} ${62 - i * 6}L${x + 11} 88Z`} fill={el.main} stroke={el.glow} stroke-width="1.5" />;
        })}
        {Array.from({ length: look.crystals }, (_, i) => {
          const x = 158 - i * 14;
          return <path key={`r${i}`} d={`M${x} 88L${x - 5} ${62 - i * 6}L${x - 11} 88Z`} fill={el.main} stroke={el.glow} stroke-width="1.5" />;
        })}
        {/* head */}
        <path d="M78 70C76 44 92 30 110 30C128 30 144 44 142 70C140 86 128 94 110 94C92 94 80 86 78 70Z" fill={`url(#${stone})`} stroke={rock(10)} stroke-width="4" />
        {look.horn === 0 && <path d="M86 44L72 18L96 36M134 44L148 18L124 36" fill={el.main} stroke={rock(10)} stroke-width="3" stroke-linejoin="round" />}
        {look.horn === 1 && <path d="M100 32L110 6L120 32Z" fill={el.main} stroke={rock(10)} stroke-width="3" stroke-linejoin="round" />}
        {look.horn === 2 && <path d="M84 40C70 34 66 20 72 10C78 22 88 28 96 32M136 40C150 34 154 20 148 10C142 22 132 28 124 32" fill={el.main} stroke={rock(10)} stroke-width="3" stroke-linejoin="round" />}
        <path d={angry ? 'M88 56L104 62M132 56L116 62' : 'M88 58L104 60M132 58L116 60'} stroke={rock(8)} stroke-width="5" stroke-linecap="round" />
        <ellipse cx="97" cy="68" rx="7" ry={angry ? 4 : 6} fill={el.glow} class="lod-pulse" />
        <ellipse cx="123" cy="68" rx="7" ry={angry ? 4 : 6} fill={el.glow} class="lod-pulse" />
        {look.jaw ? <path d="M96 84H124L118 90H102Z" fill={rock(12)} /> : <path d="M100 84Q110 90 120 84" fill="none" stroke={rock(10)} stroke-width="4" stroke-linecap="round" />}
      </g>
    </svg>
  );
}
