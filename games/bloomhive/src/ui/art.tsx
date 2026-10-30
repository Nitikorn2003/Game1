import type { JSX } from 'preact';
import type { Hat, Tool } from '../sim/content.js';
import type { Bud } from '../sim/hive.js';
import type { ZoneId } from '../sim/levels.js';

/**
 * The meadow's buds, drawn once as symbols on a 100 × 100 grid and used everywhere by name.
 * Each colour has its own mark, so the board reads without colour: a heart, a star, a clover
 * leaf, a drop, a moon and a flower. Then wax, the dandelion puff, the baby bee inside a bud,
 * honey on a bud and a butterfly on one; and the balls of the tools.
 */
export const BUD_COLOURS = ['#f0567a', '#ffcc33', '#4dbb5f', '#3f9ff0', '#9466de', '#ff8a2a'] as const;
const LIGHT = ['#ffc2d2', '#fff2b0', '#c9f2b6', '#c4e5ff', '#e4d6ff', '#ffd6ad'] as const;
const DARK = ['#9c2846', '#a5700a', '#23733a', '#1d5f9c', '#4d2c8f', '#a24e0c'] as const;

const MARKS: readonly ((dark: string, base: string) => JSX.Element)[] = [
  // Rose: a heart.
  (dark) => <path d="M50 76C30 62 25 50 32 42c6-7 14-5 18 2 4-7 12-9 18-2 7 8 2 20-18 34Z" fill="#fff" stroke={dark} stroke-width="3.5" stroke-linejoin="round" />,
  // Buttercup: a star.
  (dark) => (
    <path d="M50 36l5.2 12.4 13.4 1-10.2 8.8 3.2 13.1L50 64.2l-11.6 7.1 3.2-13.1-10.2-8.8 13.4-1Z" fill="#fff" stroke={dark} stroke-width="3.5" stroke-linejoin="round" />
  ),
  // Clover: three round leaves on a stem.
  (dark) => (
    <g fill="#fff" stroke={dark} stroke-width="3.5">
      <path d="M52 62c2 6 5 10 9 13" fill="none" stroke-linecap="round" />
      <circle cx="50" cy="45" r="9.5" />
      <circle cx="40" cy="60" r="9.5" />
      <circle cx="60" cy="60" r="9.5" />
    </g>
  ),
  // Bluebell: a drop.
  (dark) => <path d="M50 35c8 11 16 19 16 27a16 16 0 0 1-32 0c0-8 8-16 16-27Z" fill="#fff" stroke={dark} stroke-width="3.5" stroke-linejoin="round" />,
  // Violet: a crescent moon.
  (dark) => <path d="M49 38A18 18 0 1 0 67 62 15 15 0 0 1 49 38Z" fill="#fff" stroke={dark} stroke-width="3.5" stroke-linejoin="round" />,
  // Marigold: a five-petalled flower.
  (dark, base) => (
    <g stroke={dark} stroke-width="3.5">
      <g fill="#fff">
        <circle cx="50" cy="45" r="8" />
        <circle cx="60.5" cy="52.6" r="8" />
        <circle cx="56.5" cy="65" r="8" />
        <circle cx="43.5" cy="65" r="8" />
        <circle cx="39.5" cy="52.6" r="8" />
      </g>
      <circle cx="50" cy="56.5" r="6" fill={base} />
    </g>
  ),
];

/** A bud of a colour: round, a little green calyx at its top where it hangs, and its mark. */
function BudSymbol(props: { colour: number }): JSX.Element {
  const i = props.colour;
  const dark = DARK[i] ?? DARK[0];
  const base = BUD_COLOURS[i] ?? BUD_COLOURS[0];
  return (
    <symbol id={`bh-bud-${String(i)}`} viewBox="0 0 100 100">
      <circle cx="50" cy="53" r="42" fill={`url(#bh-g${String(i)})`} stroke={dark} stroke-width="4" />
      <path d="M50 15C41 5 29 7 25 15c9 4 17 4 25 0ZM50 15c9-10 21-8 25 0-9 4-17 4-25 0Z" fill="#62b84c" stroke="#2f6b2f" stroke-width="3" stroke-linejoin="round" />
      <ellipse cx="31" cy="38" rx="9" ry="5.5" transform="rotate(-38 31 38)" fill="#fff" opacity="0.6" />
      {(MARKS[i] ?? MARKS[0])?.(dark, base)}
    </symbol>
  );
}

/** Every symbol and gradient the meadow is drawn with, for the defs of any drawing of it. */
export function SharedDefs(): JSX.Element {
  return (
    <>
      {BUD_COLOURS.map((base, i) => (
        <radialGradient key={`g${String(i)}`} id={`bh-g${String(i)}`} cx="36%" cy="32%" r="72%">
          <stop offset="0" stop-color={LIGHT[i]} />
          <stop offset="0.55" stop-color={base} />
          <stop offset="1" stop-color={DARK[i]} stop-opacity="0.85" />
        </radialGradient>
      ))}
      <linearGradient id="bh-wax-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd977" />
        <stop offset="1" stop-color="#d48a1c" />
      </linearGradient>
      <radialGradient id="bh-sun-g" cx="45%" cy="40%" r="60%">
        <stop offset="0" stop-color="#fffbe0" />
        <stop offset="0.5" stop-color="#ffd84a" />
        <stop offset="1" stop-color="#ffab1f" />
      </radialGradient>
      <clipPath id="bh-ball-clip">
        <circle cx="50" cy="52" r="40" />
      </clipPath>
      {BUD_COLOURS.map((_, i) => (
        <BudSymbol key={`b${String(i)}`} colour={i} />
      ))}
      {/* Beeswax: a block of honeycomb that never pops in a match. */}
      <symbol id="bh-wax" viewBox="0 0 100 100">
        <path d="M50 7l38 22v44L50 95 12 73V29Z" fill="url(#bh-wax-g)" stroke="#7a4a10" stroke-width="4" stroke-linejoin="round" />
        <g fill="none" stroke="#a8641a" stroke-width="3" stroke-linejoin="round" opacity="0.75">
          <path d="M50 30l12 7v14l-12 7-12-7V37Z" />
          <path d="M38 51l-12 7v14M62 51l12 7v14M50 58v16" />
        </g>
        <path d="M22 34l20-12" stroke="#fff6cf" stroke-width="5" stroke-linecap="round" opacity="0.7" />
      </symbol>
      {/* A dandelion clock: a pop beside it blows it apart. */}
      <symbol id="bh-puff" viewBox="0 0 100 100">
        <circle cx="50" cy="53" r="42" fill="#fbfdf6" stroke="#8d9a78" stroke-width="3.5" />
        <g stroke="#b6c0a2" stroke-width="2.4" stroke-linecap="round">
          {Array.from({ length: 16 }, (_, k) => {
            const a = (k / 16) * Math.PI * 2;
            const x1 = 50 + Math.cos(a) * 10;
            const y1 = 53 + Math.sin(a) * 10;
            const x2 = 50 + Math.cos(a) * 32;
            const y2 = 53 + Math.sin(a) * 32;
            return <path key={k} d={`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`} />;
          })}
        </g>
        <g fill="#d9e0c8">
          {Array.from({ length: 16 }, (_, k) => {
            const a = (k / 16) * Math.PI * 2;
            return <circle key={k} cx={(50 + Math.cos(a) * 34).toFixed(1)} cy={(53 + Math.sin(a) * 34).toFixed(1)} r="4" />;
          })}
        </g>
        <circle cx="50" cy="53" r="9" fill="#c9b75a" stroke="#857424" stroke-width="3" />
      </symbol>
      {/* A baby bee peeping out of its bud. */}
      <symbol id="bh-bee" viewBox="0 0 100 100">
        <g transform="translate(55 55) scale(0.43)">
          <circle cx="50" cy="50" r="48" fill="#fff" stroke="#3a2a10" stroke-width="6" />
          <ellipse cx="32" cy="28" rx="16" ry="11" transform="rotate(-25 32 28)" fill="#dff3ff" stroke="#3a2a10" stroke-width="5" />
          <ellipse cx="68" cy="28" rx="16" ry="11" transform="rotate(25 68 28)" fill="#dff3ff" stroke="#3a2a10" stroke-width="5" />
          <ellipse cx="50" cy="58" rx="30" ry="27" fill="#ffd23f" stroke="#3a2a10" stroke-width="6" />
          <path d="M26 50c15 6 33 6 48 0M24 66c16 7 36 7 52 0" fill="none" stroke="#3a2a10" stroke-width="8" stroke-linecap="round" />
          <circle cx="40" cy="56" r="4.5" fill="#3a2a10" />
          <circle cx="60" cy="56" r="4.5" fill="#3a2a10" />
        </g>
      </symbol>
      {/* Honey poured over a bud, dripping. */}
      <symbol id="bh-honey" viewBox="0 0 100 100">
        <path
          d="M10 50C10 26 28 12 50 12s40 14 40 38c0 6-4 8-6 4-2 10-8 12-10 4-2 10-10 12-12 2-4 6-10 6-12-2-4 12-12 10-14 2-4 6-10 4-12-4-4 4-10 2-14-4Z"
          fill="#ffad1f"
          fill-opacity="0.78"
          stroke="#b86b00"
          stroke-width="3.5"
          stroke-linejoin="round"
        />
        <path d="M26 30c6-8 14-11 22-12" fill="none" stroke="#fff3c4" stroke-width="5" stroke-linecap="round" />
      </symbol>
      {/* A butterfly resting on a bud. */}
      <symbol id="bh-butterfly" viewBox="0 0 100 100">
        <g transform="translate(56 0) scale(0.42)" stroke="#5a1e48" stroke-width="5" stroke-linejoin="round">
          <path d="M48 46C30 18 6 16 6 34s18 26 40 18Z" fill="#ff7eb6" />
          <path d="M52 46C70 18 94 16 94 34s-18 26-40 18Z" fill="#ff7eb6" />
          <path d="M46 54C28 60 18 76 26 84s20-6 22-26Z" fill="#ffd24a" />
          <path d="M54 54c18 6 28 22 20 30s-20-6-22-26Z" fill="#ffd24a" />
          <path d="M50 30v52" stroke-width="8" stroke-linecap="round" />
          <path d="M48 30 40 16M52 30l8-14" fill="none" stroke-linecap="round" />
        </g>
      </symbol>
      {/* The rainbow ball: a stripe of every colour. */}
      <symbol id="bh-rainbow" viewBox="0 0 100 100">
        <g clip-path="url(#bh-ball-clip)">
          {BUD_COLOURS.map((c, i) => (
            <rect key={c} x="0" y={12 + i * 13.4} width="100" height="14" fill={c} />
          ))}
        </g>
        <circle cx="50" cy="52" r="40" fill="none" stroke="#5a3d7a" stroke-width="4" />
        <ellipse cx="33" cy="36" rx="9" ry="5.5" transform="rotate(-38 33 36)" fill="#fff" opacity="0.7" />
      </symbol>
      {/* The bomb: a seed pod with a lit fuse. */}
      <symbol id="bh-bomb" viewBox="0 0 100 100">
        <circle cx="46" cy="58" r="36" fill="#7a4fbf" stroke="#3d2470" stroke-width="4.5" />
        <path d="M27 48c4-9 11-14 20-16" fill="none" stroke="#d7c4fa" stroke-width="6" stroke-linecap="round" />
        <path d="M68 30l10-12" stroke="#6b4a1c" stroke-width="7" stroke-linecap="round" />
        <g stroke="#ff9a1f" stroke-width="5" stroke-linecap="round">
          <path d="M84 4v10M96 16H86M93 7l-6 6M86 22l5 4" />
        </g>
        <circle cx="80" cy="16" r="5" fill="#ffe27a" />
      </symbol>
      {/* The sunbeam: a little sun. */}
      <symbol id="bh-sun" viewBox="0 0 100 100">
        <g stroke="#e09a10" stroke-width="5" stroke-linecap="round">
          {Array.from({ length: 8 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2;
            return <path key={k} d={`M${(50 + Math.cos(a) * 34).toFixed(1)} ${(52 + Math.sin(a) * 34).toFixed(1)}L${(50 + Math.cos(a) * 46).toFixed(1)} ${(52 + Math.sin(a) * 46).toFixed(1)}`} />;
          })}
        </g>
        <circle cx="50" cy="52" r="28" fill="url(#bh-sun-g)" stroke="#c98a0a" stroke-width="4" />
        <path d="M38 44c3-5 7-8 12-9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" />
      </symbol>
    </>
  );
}

/** Gradients and symbols drawn once for the whole page. */
export function ArtDefs(): JSX.Element {
  return (
    <svg class="art-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <SharedDefs />
      </defs>
    </svg>
  );
}

export type BudLook = Pick<Bud, 'kind' | 'colour' | 'bee' | 'honey' | 'butterfly'>;

function symbolOf(bud: BudLook): string {
  if (bud.kind === 'wax') return '#bh-wax';
  if (bud.kind === 'puff') return '#bh-puff';
  return `#bh-bud-${String(Math.max(0, bud.colour))}`;
}

/** One bud, with whatever is in it or on it. */
export function BudArt(props: { bud: BudLook; size?: number; class?: string }): JSX.Element {
  const { bud } = props;
  const size = props.size ?? 40;
  return (
    <svg class={`bud-art${props.class ? ` ${props.class}` : ''}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <use href={symbolOf(bud)} />
      {bud.honey && <use href="#bh-honey" />}
      {bud.bee && <use href="#bh-bee" />}
      {bud.butterfly && <use class="butterfly" href="#bh-butterfly" />}
    </svg>
  );
}

/** A plain bud of a colour, as pollen in Pip's hands or on a goal. */
export function PollenArt(props: { colour: number; size?: number; class?: string }): JSX.Element {
  return <BudArt bud={{ kind: 'bud', colour: props.colour, bee: false, honey: false, butterfly: false }} {...(props.size ? { size: props.size } : {})} {...(props.class ? { class: props.class } : {})} />;
}

const TOOL_SYMBOLS: Readonly<Record<Tool, string>> = { rainbow: '#bh-rainbow', bomb: '#bh-bomb', sunbeam: '#bh-sun' };

/** The ball of a tool, as Pip holds it. */
export function ToolBall(props: { tool: Tool; size?: number; class?: string }): JSX.Element {
  const size = props.size ?? 40;
  return (
    <svg class={`bud-art${props.class ? ` ${props.class}` : ''}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <use href={TOOL_SYMBOLS[props.tool]} />
    </svg>
  );
}

/** Pip's hats, drawn over the top of the head on Pip's 100 × 100 grid. */
const HATS: Readonly<Record<Hat, JSX.Element>> = {
  // A leaf cap with a curl of stem.
  leaf: (
    <g stroke="#2f6b2f" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <path d="M26 34C30 16 52 8 74 18 70 32 52 40 26 34Z" fill="#6cc04f" />
      <path d="M30 32c14-4 28-8 40-13" fill="none" stroke="#3f8a35" stroke-width="2.6" />
      <path d="M74 18c4-4 8-4 10 0-2 3-6 3-8 1" fill="none" />
    </g>
  ),
  // A wide straw hat with a red band.
  straw: (
    <g stroke="#8a5a1a" stroke-width="3.5" stroke-linejoin="round">
      <ellipse cx="50" cy="33" rx="40" ry="9" fill="#f5d27a" />
      <path d="M30 32c0-14 9-22 20-22s20 8 20 22Z" fill="#f7dc8c" />
      <path d="M30.6 27h38.8" fill="none" stroke="#d8393f" stroke-width="6" />
      <path d="M36 18c4-4 8-5 12-5" fill="none" stroke="#fff2c4" stroke-width="3" stroke-linecap="round" />
    </g>
  ),
  // A crown of little flowers.
  flowers: (
    <g stroke-width="2.6" stroke-linejoin="round">
      <path d="M22 36c14-8 42-8 56 0" fill="none" stroke="#3f8a35" stroke-width="4" stroke-linecap="round" />
      {[
        [26, 32, '#f0567a', '#9c2846'],
        [38, 26, '#ffcc33', '#a5700a'],
        [50, 24, '#ffffff', '#8d9a78'],
        [62, 26, '#9466de', '#4d2c8f'],
        [74, 32, '#3f9ff0', '#1d5f9c'],
      ].map(([x, y, fill, ink]) => (
        <g key={String(x)} stroke={String(ink)}>
          <circle cx={Number(x) - 4} cy={Number(y)} r="4.6" fill={String(fill)} />
          <circle cx={Number(x) + 4} cy={Number(y)} r="4.6" fill={String(fill)} />
          <circle cx={Number(x)} cy={Number(y) - 4} r="4.6" fill={String(fill)} />
          <circle cx={Number(x)} cy={Number(y) + 4} r="4.6" fill={String(fill)} />
          <circle cx={Number(x)} cy={Number(y)} r="3" fill="#ffb627" stroke="none" />
        </g>
      ))}
    </g>
  ),
  // A knitted beanie with a pompom.
  beanie: (
    <g stroke="#6b1d24" stroke-width="3.5" stroke-linejoin="round">
      <path d="M26 36c0-16 10-26 24-26s24 10 24 26Z" fill="#e2474f" />
      <path d="M24 36h52v6H24Z" fill="#fff2e6" />
      <path d="M38 14v20M50 11v23M62 14v20" fill="none" stroke="#b82f37" stroke-width="2.6" />
      <circle cx="50" cy="9" r="7" fill="#fff2e6" />
    </g>
  ),
};

/** Pip, the little bee who shoots the pollen, in a hat. */
export function PipArt(props: { hat: Hat; size?: number; class?: string; mood?: 'happy' | 'worried' }): JSX.Element {
  const size = props.size ?? 64;
  const worried = props.mood === 'worried';
  return (
    <svg class={`pip${props.class ? ` ${props.class}` : ''}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g class="pip__wings" stroke="#3a2a10" stroke-width="3.5">
        <ellipse cx="24" cy="44" rx="20" ry="13" transform="rotate(-30 24 44)" fill="#e6f6ff" />
        <ellipse cx="76" cy="44" rx="20" ry="13" transform="rotate(30 76 44)" fill="#e6f6ff" />
        <path d="M14 40c5-5 11-7 17-6M86 40c-5-5-11-7-17-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" />
      </g>
      <g stroke="#3a2a10" stroke-width="4" stroke-linejoin="round">
        <path d="M40 30C36 20 30 14 24 12M60 30c4-10 10-16 16-18" fill="none" stroke-linecap="round" />
        <circle cx="23" cy="11" r="5" fill="#3a2a10" />
        <circle cx="77" cy="11" r="5" fill="#3a2a10" />
        <ellipse cx="50" cy="62" rx="31" ry="30" fill="#ffd23f" />
        <path d="M22 70c18 8 38 8 56 0M26 84c15 6 33 6 48 0" fill="none" stroke-width="8" stroke-linecap="round" />
      </g>
      <g>
        <ellipse cx="39" cy="54" rx="6" ry="7.5" fill="#2a1d0a" />
        <ellipse cx="61" cy="54" rx="6" ry="7.5" fill="#2a1d0a" />
        <circle cx="41" cy="51" r="2.2" fill="#fff" />
        <circle cx="63" cy="51" r="2.2" fill="#fff" />
        <ellipse cx="29" cy="62" rx="5" ry="3.2" fill="#ff9aa8" opacity="0.8" />
        <ellipse cx="71" cy="62" rx="5" ry="3.2" fill="#ff9aa8" opacity="0.8" />
        <path d={worried ? 'M43 66c4-3 10-3 14 0' : 'M42 63c4 5 12 5 16 0'} fill="none" stroke="#2a1d0a" stroke-width="3.5" stroke-linecap="round" />
      </g>
      {HATS[props.hat]}
    </svg>
  );
}

/** The flower each zone makes bloom in Pip's garden once all its levels are reached, drawn on a 64 × 64 grid. */
const FLOWER_ART: Record<ZoneId, JSX.Element> = {
  // A daisy.
  clover: (
    <g>
      <path d="M32 40v20M32 54c-6-1-10-4-12-8 5 0 9 2 12 6" fill="#5fb24a" stroke="#2f6b2f" stroke-width="2" stroke-linejoin="round" />
      <g fill="#fff" stroke="#b5b5a0" stroke-width="1.4">
        {Array.from({ length: 12 }, (_, k) => (
          <ellipse key={k} cx="32" cy="14" rx="4" ry="9" transform={`rotate(${String(k * 30)} 32 26)`} />
        ))}
      </g>
      <circle cx="32" cy="26" r="6.5" fill="#ffc83d" stroke="#b5760f" stroke-width="2" />
    </g>
  ),
  // A sunflower.
  sunflower: (
    <g>
      <path d="M32 44v18M32 54c6-1 10-4 12-8-5 0-9 2-12 6" fill="#5fb24a" stroke="#2f6b2f" stroke-width="2" stroke-linejoin="round" />
      <g fill="#ffcc33" stroke="#b5760f" stroke-width="1.4">
        {Array.from({ length: 14 }, (_, k) => (
          <ellipse key={k} cx="32" cy="9" rx="4.4" ry="9" transform={`rotate(${(k * 360) / 14} 32 25)`} />
        ))}
      </g>
      <circle cx="32" cy="25" r="9" fill="#7a4a1c" stroke="#4a2a0c" stroke-width="2" />
      <g fill="#a8692c">
        <circle cx="29" cy="22" r="1.4" />
        <circle cx="35" cy="23" r="1.4" />
        <circle cx="31" cy="28" r="1.4" />
        <circle cx="36" cy="28.5" r="1.2" />
      </g>
    </g>
  ),
  // A tulip.
  hollow: (
    <g stroke-linejoin="round">
      <path d="M32 36v24" stroke="#2f6b2f" stroke-width="3" />
      <path d="M32 58C24 56 18 48 18 38c8 4 12 10 14 20ZM32 58c8-2 14-10 14-20-8 4-12 10-14 20Z" fill="#5fb24a" stroke="#2f6b2f" stroke-width="2" />
      <path d="M18 14c0 12 6 22 14 22s14-10 14-22l-7 6-7-10-7 10Z" fill="#f0567a" stroke="#9c2846" stroke-width="2" />
      <path d="M24 22c1 4 3 7 5 9" fill="none" stroke="#ffc2d2" stroke-width="2" stroke-linecap="round" />
    </g>
  ),
  // An orchid.
  orchard: (
    <g stroke="#6b2a7a" stroke-width="1.8" stroke-linejoin="round">
      <path d="M50 60c0-16-6-30-18-36" fill="none" stroke="#2f6b2f" stroke-width="2.6" />
      <path d="M32 24C22 10 10 12 8 20c4 6 14 8 24 4ZM32 24c10-14 22-12 24-4-4 6-14 8-24 4Z" fill="#e7a8f0" />
      <path d="M32 24c-8 8-14 18-12 24 6 0 10-8 12-24ZM32 24c8 8 14 18 12 24-6 0-10-8-12-24Z" fill="#d884e6" />
      <path d="M32 24c-5 4-7 10-4 16 2 2 6 2 8 0 3-6 1-12-4-16Z" fill="#a33fb8" />
      <circle cx="32" cy="26" r="2.4" fill="#ffd24a" stroke="none" />
    </g>
  ),
  // A frangipani.
  dandelion: (
    <g stroke="#c7a54a" stroke-width="1.6" stroke-linejoin="round">
      {Array.from({ length: 5 }, (_, k) => (
        <path key={k} d="M32 32C24 26 22 14 28 8c6 2 8 12 4 24Z" fill="#fffdf2" transform={`rotate(${String(k * 72)} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="6" fill="#ffcc33" stroke="#d08a1c" />
      <path d="M32 38v22" stroke="#2f6b2f" stroke-width="2.6" />
    </g>
  ),
  // A hibiscus.
  butterfly: (
    <g stroke="#8a1424" stroke-width="1.8" stroke-linejoin="round">
      {Array.from({ length: 5 }, (_, k) => (
        <path key={k} d="M32 30c-10-6-14-18-8-24 4-2 10 0 12 6 4-4 10-2 10 4 0 6-6 12-14 14Z" fill="#e8364a" transform={`rotate(${String(k * 72)} 32 30)`} />
      ))}
      <circle cx="32" cy="30" r="5" fill="#9c1428" stroke="none" />
      <path d="M32 30c4-8 8-14 14-18" fill="none" stroke="#ffd24a" stroke-width="2.4" stroke-linecap="round" />
      <circle cx="46" cy="12" r="2.6" fill="#ffd24a" stroke="none" />
    </g>
  ),
  // A moonflower, open at night.
  moonlit: (
    <g stroke="#7d8ab8" stroke-width="1.8" stroke-linejoin="round">
      <circle cx="32" cy="28" r="22" fill="#f4f7ff" />
      <path d="M32 6l5 16 17 1-14 9 6 16-14-10-14 10 6-16-14-9 17-1Z" fill="none" stroke="#c9d3f2" stroke-width="2" />
      <circle cx="32" cy="28" r="6" fill="#e9f2c8" stroke="#a9b27a" />
      <path d="M32 50v12" stroke="#2f6b2f" stroke-width="2.6" />
    </g>
  ),
  // The golden shower tree: yellow flowers hanging in long bunches.
  queen: (
    <g stroke-linejoin="round">
      <path d="M4 8c18-4 38-4 56 2" fill="none" stroke="#7a5230" stroke-width="3.4" stroke-linecap="round" />
      {[14, 32, 50].map((x) => (
        <g key={x}>
          <path d={`M${String(x)} 9v44`} stroke="#6a8a2a" stroke-width="1.6" />
          {[14, 22, 30, 38, 46].map((y, k) => (
            <g key={y} fill="#ffd21f" stroke="#b58a0a" stroke-width="1.2">
              <circle cx={x - 4 + (k % 2) * 8} cy={y} r={4.4 - k * 0.5} />
              <circle cx={x + 4 - (k % 2) * 8} cy={y + 3} r={3.8 - k * 0.45} />
            </g>
          ))}
        </g>
      ))}
    </g>
  ),
};

export function FlowerArt(props: { zone: ZoneId; size?: number; bloomed: boolean }): JSX.Element {
  const size = props.size ?? 56;
  return (
    <svg class={`flower${props.bloomed ? '' : ' flower--bud'}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {FLOWER_ART[props.zone]}
    </svg>
  );
}
