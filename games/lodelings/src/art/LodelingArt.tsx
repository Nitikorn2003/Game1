import type { JSX } from 'preact';
import { useId } from 'preact/hooks';
import { speciesOf, type BodyShape, type Eyes, type Feature, type Species } from '../sim/content.js';
import { ELEMENT_COLORS, tones, type Tones } from './palette.js';

const BODY: Record<BodyShape, { d: string; eyeY: number; footY: number }> = {
  round: { d: 'M50 28C70 28 82 42 82 60C82 77 68 86 50 86C32 86 18 77 18 60C18 42 30 28 50 28Z', eyeY: 56, footY: 86 },
  oval: { d: 'M50 22C68 22 78 40 78 58C78 77 66 88 50 88C34 88 22 77 22 58C22 40 32 22 50 22Z', eyeY: 54, footY: 88 },
  pear: { d: 'M50 24C58 24 64 34 70 46C78 58 82 66 80 74C77 84 65 88 50 88C35 88 23 84 20 74C18 66 22 58 30 46C36 34 42 24 50 24Z', eyeY: 62, footY: 88 },
  marquise: { d: 'M50 18C66 32 78 46 78 60C78 74 66 86 50 90C34 86 22 74 22 60C22 46 34 32 50 18Z', eyeY: 58, footY: 88 },
  trillion: { d: 'M50 22C54 22 57 25 60 30L82 72C86 80 81 86 73 86L27 86C19 86 14 80 18 72L40 30C43 25 46 22 50 22Z', eyeY: 64, footY: 86 },
  cushion: { d: 'M30 30H70C78 30 82 34 82 42V76C82 83 78 86 70 86H30C22 86 18 83 18 76V42C18 34 22 30 30 30Z', eyeY: 56, footY: 86 },
  hex: { d: 'M50 24L78 38Q81 40 81 44L81 72Q81 76 78 78L50 90L22 78Q19 76 19 72L19 44Q19 40 22 38Z', eyeY: 58, footY: 86 },
  heart: { d: 'M50 40C50 30 60 24 69 26C80 28 86 38 84 50C82 64 66 78 50 90C34 78 18 64 16 50C14 38 20 28 31 26C40 24 50 30 50 40Z', eyeY: 54, footY: 86 },
};

function eyes(kind: Eyes, y: number, t: Tones): JSX.Element {
  const pupil = t.ink;
  switch (kind) {
    case 'sleepy':
      return (
        <g fill="none" stroke={pupil} stroke-width="3" stroke-linecap="round">
          <path d={`M34 ${y}q6 5 12 0`} />
          <path d={`M54 ${y}q6 5 12 0`} />
        </g>
      );
    case 'fierce':
      return (
        <g>
          <path d={`M32 ${y - 9}l13 5M68 ${y - 9}l-13 5`} stroke={pupil} stroke-width="3.2" stroke-linecap="round" />
          <ellipse cx="40" cy={y} rx="6" ry="6.5" fill="#fff" />
          <ellipse cx="60" cy={y} rx="6" ry="6.5" fill="#fff" />
          <circle cx="41" cy={y + 1} r="3.6" fill={pupil} />
          <circle cx="59" cy={y + 1} r="3.6" fill={pupil} />
          <circle cx="42.2" cy={y - 0.4} r="1.2" fill="#fff" />
          <circle cx="60.2" cy={y - 0.4} r="1.2" fill="#fff" />
        </g>
      );
    case 'sparkle':
      return (
        <g>
          <ellipse cx="39" cy={y} rx="7.5" ry="8.5" fill={pupil} />
          <ellipse cx="61" cy={y} rx="7.5" ry="8.5" fill={pupil} />
          <path d={`M36 ${y - 4}l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4zM58 ${y - 4}l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4z`} fill="#fff" />
          <circle cx="42" cy={y + 4} r="1.4" fill="#fff" />
          <circle cx="64" cy={y + 4} r="1.4" fill="#fff" />
        </g>
      );
    case 'round':
      return (
        <g>
          <circle cx="40" cy={y} r="7" fill="#fff" />
          <circle cx="60" cy={y} r="7" fill="#fff" />
          <circle cx="41" cy={y + 1} r="4.4" fill={pupil} />
          <circle cx="59" cy={y + 1} r="4.4" fill={pupil} />
          <circle cx="42.6" cy={y - 1} r="1.6" fill="#fff" />
          <circle cx="60.6" cy={y - 1} r="1.6" fill="#fff" />
        </g>
      );
  }
}

function feature(kind: Feature, t: Tones, glow: string): JSX.Element | null {
  switch (kind) {
    case 'flame':
      return (
        <g class="lod-flicker">
          <path d="M50 4C58 14 62 20 58 30C56 34 53 35 50 35C44 35 40 30 41 24C42 18 46 16 46 10C49 14 49 18 51 19C53 15 52 9 50 4Z" fill={glow} stroke={t.dark} stroke-width="1.5" />
          <path d="M50 18C53 22 54 26 52 30C51 32 49 32 48 30C47 27 49 24 50 18Z" fill="#fff6c8" />
        </g>
      );
    case 'ears':
      return <path d="M24 36L22 14L40 30ZM76 36L78 14L60 30Z" fill={t.dark} stroke={t.ink} stroke-width="1.5" stroke-linejoin="round" />;
    case 'quills':
      return <path d="M30 34L26 12L40 28L44 6L52 26L60 8L62 28L76 14L70 36Z" fill={glow} stroke={t.dark} stroke-width="1.5" stroke-linejoin="round" />;
    case 'horns':
      return (
        <g fill={glow} stroke={t.ink} stroke-width="1.5" stroke-linejoin="round">
          <path d="M30 36C20 30 16 18 22 8C24 18 30 24 38 28Z" />
          <path d="M70 36C80 30 84 18 78 8C76 18 70 24 62 28Z" />
        </g>
      );
    case 'rays':
      return (
        <g class="lod-spin" fill={glow} opacity="0.9">
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M50 2L54 16L46 16Z" transform={`rotate(${i * 30} 50 56)`} />
          ))}
        </g>
      );
    case 'drop':
      return <path d="M50 6C56 16 60 22 60 27C60 33 55 36 50 36C45 36 40 33 40 27C40 22 44 16 50 6Z" fill={glow} stroke={t.dark} stroke-width="1.5" />;
    case 'shell':
      return (
        <g stroke={t.ink} stroke-width="1.4">
          <path d="M34 32C34 18 44 12 50 12C56 12 66 18 66 32Z" fill="#ffe4d2" />
          <path d="M50 12V32M42 15L45 32M58 15L55 32" fill="none" />
        </g>
      );
    case 'fin':
      return <path d="M36 32C40 18 52 8 66 6C60 14 60 24 64 32Z" fill={glow} stroke={t.dark} stroke-width="1.5" stroke-linejoin="round" />;
    case 'coral':
      return (
        <g fill="none" stroke="#ff8fa3" stroke-width="4" stroke-linecap="round">
          <path d="M36 32V18M36 22L28 14M36 22L42 12" />
          <path d="M64 32V18M64 22L72 14M64 22L58 12" />
        </g>
      );
    case 'crest':
      return <path d="M28 34C30 22 40 16 46 18C42 10 54 4 60 10C62 4 72 8 72 16C78 20 76 30 72 34Z" fill={glow} stroke={t.dark} stroke-width="1.5" stroke-linejoin="round" />;
    case 'leaf':
      return (
        <g stroke="#2f6b2a" stroke-width="1.5">
          <path d="M50 30V18" fill="none" />
          <path d="M50 20C46 8 56 2 66 4C66 14 58 22 50 20Z" fill="#8be07a" />
        </g>
      );
    case 'leaves':
      return (
        <g stroke="#2f6b2a" stroke-width="1.5">
          <path d="M50 30V20" fill="none" />
          <path d="M50 21C40 20 32 12 34 4C42 4 50 12 50 21Z" fill="#8be07a" />
          <path d="M50 21C60 20 68 12 66 4C58 4 50 12 50 21Z" fill="#b2ee8f" />
        </g>
      );
    case 'thorns':
      return <path d="M26 40L14 32L28 30L24 16L36 26L40 12L48 26M74 40L86 32L72 30L76 16L64 26L60 12L52 26" fill={t.dark} stroke={t.ink} stroke-width="1.5" stroke-linejoin="round" />;
    case 'fern':
      return (
        <g stroke="#2f6b2a" stroke-width="2" fill="#9be38a" stroke-linejoin="round">
          <path d="M80 74C92 66 96 52 92 40C88 50 84 56 78 60Z" />
          <path d="M90 46L96 44M88 54L95 54M84 62L90 64" fill="none" />
        </g>
      );
    case 'branches':
      return (
        <g fill="none" stroke="#7a5230" stroke-width="4" stroke-linecap="round">
          <path d="M34 32L26 16M28 20L18 18M30 24L36 12" />
          <path d="M66 32L74 16M72 20L82 18M70 24L64 12" />
          <circle cx="36" cy="12" r="3.5" fill="#8be07a" stroke="none" />
          <circle cx="64" cy="12" r="3.5" fill="#8be07a" stroke="none" />
        </g>
      );
    case 'wings':
      return (
        <g fill={glow} stroke={t.dark} stroke-width="1.5" stroke-linejoin="round" class="lod-flap">
          <path d="M22 54C8 48 2 34 6 26C14 32 20 34 26 44Z" />
          <path d="M78 54C92 48 98 34 94 26C86 32 80 34 74 44Z" />
        </g>
      );
    case 'bolt':
      return <path d="M54 2L40 22H50L44 36L62 14H52Z" fill="#fff07a" stroke="#8a6500" stroke-width="1.5" stroke-linejoin="round" class="lod-flicker" />;
    case 'sparks':
      return (
        <g fill="#fff4a3" class="lod-twinkle">
          <path d="M18 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          <path d="M82 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          <path d="M50 4l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" />
        </g>
      );
    case 'zigzag':
      return <path d="M78 76L88 70L84 64L94 58L90 52L98 46" fill="none" stroke="#fff07a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />;
    case 'catears':
      return (
        <g>
          <path d="M22 40L24 16L40 32ZM78 40L76 16L60 32Z" fill={t.dark} stroke={t.ink} stroke-width="1.5" stroke-linejoin="round" />
          <path d="M26 34L27 22L35 31ZM74 34L73 22L65 31Z" fill="#ffb6c8" />
        </g>
      );
  }
}

export interface LodelingArtProps {
  species: Species | string;
  size?: number;
  /** Draw as an undiscovered silhouette. */
  hidden?: boolean;
  class?: string;
}

/** A Lodeling drawn from its species data: gem-cut body, face, element feature and rarity glow. */
export function LodelingArt(props: LodelingArtProps): JSX.Element | null {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const species = typeof props.species === 'string' ? speciesOf(props.species) : props.species;
  if (!species) return null;
  const body = BODY[species.shape];
  const t = tones(species.hue, species.rarity === 'common' ? 62 : 74);
  const glow = ELEMENT_COLORS[species.element].glow;
  const size = props.size ?? 64;
  const clip = `lc-${uid}`;
  const grad = `lg-${uid}`;
  const aura = `la-${uid}`;
  const hidden = props.hidden === true;
  const behind = species.feature === 'rays' || species.feature === 'wings' || species.feature === 'fern' || species.feature === 'zigzag';
  const art = feature(species.feature, t, glow);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} class={`lodeling ${props.class ?? ''}`} role="img" aria-label={hidden ? '?' : species.name}>
      <defs>
        <clipPath id={clip}>
          <path d={body.d} />
        </clipPath>
        <linearGradient id={grad} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stop-color={t.light} />
          <stop offset="0.55" stop-color={t.base} />
          <stop offset="1" stop-color={t.dark} />
        </linearGradient>
        <radialGradient id={aura}>
          <stop offset="0.35" stop-color={glow} stop-opacity="0.7" />
          <stop offset="1" stop-color={glow} stop-opacity="0" />
        </radialGradient>
      </defs>
      <g filter={hidden ? undefined : undefined} opacity={hidden ? 1 : undefined}>
        {!hidden && (species.rarity === 'epic' || species.rarity === 'legendary') && <circle cx="50" cy="58" r="48" fill={`url(#${aura})`} class="lod-pulse" />}
        {!hidden && behind && art}
        <ellipse cx="50" cy={body.footY + 4} rx="26" ry="5" fill="#000" opacity="0.25" />
        <ellipse cx="37" cy={body.footY} rx="8" ry="4.5" fill={hidden ? '#1b1512' : t.dark} />
        <ellipse cx="63" cy={body.footY} rx="8" ry="4.5" fill={hidden ? '#1b1512' : t.dark} />
        <path d={body.d} fill={hidden ? '#1b1512' : `url(#${grad})`} stroke={hidden ? '#3a2f29' : t.ink} stroke-width="2.4" stroke-linejoin="round" />
        {!hidden && (
          <g clip-path={`url(#${clip})`}>
            <path d="M14 18L60 18L44 48L14 58Z" fill={t.light} opacity="0.5" />
            <path d="M38 38L62 38L70 54L50 64L30 54Z" fill="#fff" opacity="0.16" />
            <path d="M60 62L98 50L98 100L38 100Z" fill={t.ink} opacity="0.3" />
            <path d="M14 58L44 48L50 64L30 100L10 100Z" fill={t.dark} opacity="0.18" />
          </g>
        )}
        {!hidden && !behind && art}
        {!hidden && (
          <g>
            <ellipse cx="31" cy={body.eyeY + 8} rx="5" ry="3" fill="#ff8fab" opacity="0.4" />
            <ellipse cx="69" cy={body.eyeY + 8} rx="5" ry="3" fill="#ff8fab" opacity="0.4" />
            {eyes(species.eyes, body.eyeY, t)}
            <path
              d={species.eyes === 'fierce' ? `M44 ${body.eyeY + 11}q6 4 12 0M47 ${body.eyeY + 12}l1.5 3 1.5-3` : `M45 ${body.eyeY + 10}q5 5 10 0`}
              fill="none"
              stroke={t.ink}
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
        )}
        {hidden && <text x="50" y="66" text-anchor="middle" font-size="26" font-weight="700" fill="#5d4c42">?</text>}
        {!hidden && species.rarity === 'legendary' && (
          <path d="M36 22L40 10L46 18L50 6L54 18L60 10L64 22Z" fill="#ffd35c" stroke="#8a5a00" stroke-width="1.5" stroke-linejoin="round" transform="translate(0 -4)" />
        )}
        {!hidden && species.rarity !== 'common' && (
          <path d="M84 30l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="#fff" class="lod-twinkle" />
        )}
      </g>
    </svg>
  );
}
