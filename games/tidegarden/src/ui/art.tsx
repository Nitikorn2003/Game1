import type { JSX } from 'preact';
import { BOMB, COL, PEARL, ROW, TURTLE, type Special } from '../sim/board.js';
import type { Buddy } from '../sim/content.js';
import type { ZoneId } from '../sim/levels.js';

/**
 * The reef's pieces, each colour with its own shape so that the board reads without colour,
 * drawn on a 100 × 100 grid: coral, a scallop shell, a starfish, a piece of sea glass, a bubble
 * and an urchin; then the pearl and the baby turtle.
 */
export const PIECE_COLOURS = ['#f2603f', '#f59bbd', '#ffc83d', '#3fc68a', '#46b4f0', '#9a72e0'] as const;

const PIECES: readonly JSX.Element[] = [
  // Coral: branches from one foot.
  <g key="coral" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M50 88V58M50 64C48 52 34 48 28 26M50 60C52 48 66 46 72 24M50 54V16M30 42C22 42 16 36 14 28M70 42C78 42 84 36 86 28" stroke="#9c2f1a" stroke-width="21" />
    <path d="M50 88V58M50 64C48 52 34 48 28 26M50 60C52 48 66 46 72 24M50 54V16M30 42C22 42 16 36 14 28M70 42C78 42 84 36 86 28" stroke="#f2603f" stroke-width="12" />
    <path d="M47 50V22M31 36c-2-3-3-6-3-9" stroke="#ffb199" stroke-width="4" />
  </g>,
  // A scallop shell: a fan of ridges.
  <g key="shell" stroke="#a64672" stroke-width="4.5" stroke-linejoin="round">
    <path d="M50 16c20 0 34 14 34 32 0 10-6 18-14 22l-7 10H37l-7-10c-8-4-14-12-14-22 0-18 14-32 34-32Z" fill="#f59bbd" />
    <path d="M50 20v58M38 22l5 56M62 22l-5 56M27 30l12 46M73 30 61 76M20 42l17 32M80 42 63 74" fill="none" stroke="#c4618c" stroke-width="3" stroke-linecap="round" />
    <path d="M37 80h26l-4 6H41Z" fill="#e07aa3" />
  </g>,
  // A starfish, its arms rounded, with dots down them.
  <g key="star" stroke="#a8670c" stroke-width="4.5" stroke-linejoin="round">
    <path
      d="M50 10c4 0 6 4 8 12l5 16 17 1c8 1 11 3 12 6 1 4-2 6-9 11l-13 10 5 16c2 8 2 11-1 13-3 3-7 1-13-4l-13-10-13 10c-6 5-10 7-13 4-3-2-3-5-1-13l5-16-13-10c-7-5-10-7-9-11 1-3 4-5 12-6l17-1 5-16c2-8 4-12 8-12Z"
      fill="#ffc83d"
    />
    <g fill="#fff1c2" stroke="none">
      <circle cx="50" cy="28" r="3.6" />
      <circle cx="50" cy="40" r="3.2" />
      <circle cx="31" cy="46" r="3.2" />
      <circle cx="69" cy="46" r="3.2" />
      <circle cx="38" cy="68" r="3.2" />
      <circle cx="62" cy="68" r="3.2" />
    </g>
  </g>,
  // Sea glass: a worn green gem.
  <g key="glass" stroke="#1f7a52" stroke-width="4.5" stroke-linejoin="round">
    <path d="M32 14h36l20 22-8 36-30 16-30-16-8-36Z" fill="#3fc68a" />
    <path d="M32 14l10 24h16l10-24M12 36h30M58 38h30M42 38l-22 34M58 38l22 34M42 38l8 50 8-50" fill="none" stroke="#2a9e6a" stroke-width="3" />
    <path d="M30 24l6 12" fill="none" stroke="#c9f5df" stroke-width="5" stroke-linecap="round" />
  </g>,
  // A bubble, with two small ones beside it.
  <g key="bubble" stroke="#1d6fa3" stroke-width="4.5">
    <circle cx="46" cy="54" r="32" fill="#46b4f0" />
    <circle cx="78" cy="22" r="10" fill="#7fcdf6" />
    <circle cx="84" cy="44" r="6" fill="#7fcdf6" stroke-width="3.5" />
    <path d="M28 44c3-9 10-15 19-16" fill="none" stroke="#e4f6ff" stroke-width="7" stroke-linecap="round" />
    <circle cx="62" cy="72" r="4" fill="#bfe6fb" stroke="none" />
  </g>,
  // A sea urchin: a round body and its spines.
  <g key="urchin" stroke="#53338f" stroke-width="4.5" stroke-linejoin="round">
    <path
      d="M50 6l7 16 14-10 1 17 17-3-7 15 16 7-15 8 10 13-17 1 3 17-15-7-6 16-8-15-8 15-6-16-15 7 3-17-17-1 10-13-15-8 16-7-7-15 17 3 1-17 14 10Z"
      fill="#7a55c7"
    />
    <circle cx="50" cy="52" r="24" fill="#9a72e0" />
    <g fill="#d8c8f7" stroke="none">
      <circle cx="42" cy="44" r="4" />
      <circle cx="56" cy="40" r="3" />
      <circle cx="58" cy="56" r="3" />
      <circle cx="44" cy="60" r="3" />
    </g>
  </g>,
];

/** The pearl: no colour of its own, and the shine of all of them. */
const PEARL_ART = (
  <g key="pearl">
    <circle cx="50" cy="50" r="38" fill="url(#tg-pearl)" stroke="#8e8aa8" stroke-width="4" />
    <path d="M30 38c4-10 12-16 22-17" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" />
    <circle cx="66" cy="66" r="5" fill="#fff" opacity="0.7" />
  </g>
);

/** A baby sea turtle from above, heading down to the sea. */
const TURTLE_ART = (
  <g key="turtle" stroke="#1f5b3a" stroke-width="4" stroke-linejoin="round">
    <path d="M24 30c-8-4-14-2-16 2 4 4 10 6 18 6ZM76 30c8-4 14-2 16 2-4 4-10 6-18 6ZM28 70c-6 4-10 10-8 14 5 0 11-4 14-10ZM72 70c6 4 10 10 8 14-5 0-11-4-14-10Z" fill="#7fc97a" />
    <ellipse cx="50" cy="48" rx="27" ry="31" fill="#4f9e5c" />
    <path d="M50 24l10 8v13l-10 7-10-7V32ZM40 45l-12 6M60 45l12 6M40 32l-10-6M60 32l10-6M50 52v14" fill="none" stroke="#2c6e41" stroke-width="3" />
    <ellipse cx="50" cy="84" rx="11" ry="10" fill="#8fd18a" />
    <circle cx="45" cy="87" r="2.6" fill="#1d2a1f" stroke="none" />
    <circle cx="55" cy="87" r="2.6" fill="#1d2a1f" stroke="none" />
  </g>
);

export function pieceArt(kind: number): JSX.Element {
  if (kind === PEARL) return PEARL_ART;
  if (kind === TURTLE) return TURTLE_ART;
  return PIECES[kind] ?? PEARL_ART;
}

/** What a special piece wears over its shape: waves across or down it, or a bubble around it. */
export function specialArt(special: Special): JSX.Element | null {
  switch (special) {
    case ROW:
      return (
        <g class="wave-mark" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 40c7-7 13-7 18 0s11 7 18 0 11-7 18 0 11 7 18 0M14 60c7-7 13-7 18 0s11 7 18 0 11-7 18 0 11 7 18 0M12 42 3 50l9 8M88 42l9 8-9 8" stroke="#0b3550" stroke-width="10" opacity="0.55" />
          <path d="M14 40c7-7 13-7 18 0s11 7 18 0 11-7 18 0 11 7 18 0M14 60c7-7 13-7 18 0s11 7 18 0 11-7 18 0 11 7 18 0M12 42 3 50l9 8M88 42l9 8-9 8" stroke="#fff" stroke-width="5" />
        </g>
      );
    case COL:
      return (
        <g class="wave-mark" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M40 14c-7 7-7 13 0 18s7 11 0 18-7 11 0 18 7 11 0 18M60 14c-7 7-7 13 0 18s7 11 0 18-7 11 0 18 7 11 0 18M42 12 50 3l8 9M42 88l8 9 8-9" stroke="#0b3550" stroke-width="10" opacity="0.55" />
          <path d="M40 14c-7 7-7 13 0 18s7 11 0 18-7 11 0 18 7 11 0 18M60 14c-7 7-7 13 0 18s7 11 0 18-7 11 0 18 7 11 0 18M42 12 50 3l8 9M42 88l8 9 8-9" stroke="#fff" stroke-width="5" />
        </g>
      );
    case BOMB:
      return (
        <g class="bomb-mark">
          <circle cx="50" cy="50" r="45" fill="url(#tg-bubble)" stroke="#fff" stroke-width="4" />
          <path d="M22 34c5-9 13-15 23-17" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" />
        </g>
      );
    default:
      return null;
  }
}

/** One piece on its own, at any size. */
export function PieceArt(props: { kind: number; special?: Special; size?: number; class?: string }): JSX.Element {
  const size = props.size ?? 40;
  const special = props.special ?? 0;
  return (
    <svg class={`piece-art${props.class ? ` ${props.class}` : ''}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {special === BOMB && specialArt(special)}
      {pieceArt(props.kind)}
      {special !== BOMB && specialArt(special)}
    </svg>
  );
}

/** Gradients the pieces share, drawn once for the whole page. */
export function ArtDefs(): JSX.Element {
  return (
    <svg class="art-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <SharedDefs />
      </defs>
    </svg>
  );
}

/** The gradients and the sand the pieces use, for the defs of any drawing of them. */
export function SharedDefs(): JSX.Element {
  return (
    <>
      <radialGradient id="tg-pearl" cx="38%" cy="34%" r="70%">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.45" stop-color="#f3eefc" />
        <stop offset="0.75" stop-color="#d9e9f7" />
        <stop offset="1" stop-color="#f6d5e8" />
      </radialGradient>
      <radialGradient id="tg-bubble" cx="40%" cy="35%" r="70%">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.15" />
        <stop offset="0.8" stop-color="#bfeaff" stop-opacity="0.35" />
        <stop offset="1" stop-color="#ffffff" stop-opacity="0.75" />
      </radialGradient>
      <pattern id="tg-sand" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="4" r="1.2" fill="#c9a668" />
        <circle cx="10" cy="10" r="1" fill="#c9a668" />
        <circle cx="11" cy="3" r="0.8" fill="#fff3d6" />
      </pattern>
    </>
  );
}

/** A rock of coral stone; a cracked one has one hit left. */
export function RockArt(props: { hits: number }): JSX.Element {
  return (
    <svg class="rock-art" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M14 34 30 14h38l20 18 4 32-18 22H32L10 66Z" fill={props.hits > 1 ? '#7f7468' : '#9b8f82'} stroke="#4e463e" stroke-width="5" stroke-linejoin="round" />
      <g fill="#5e554c">
        <circle cx="36" cy="38" r="6" />
        <circle cx="64" cy="34" r="4.5" />
        <circle cx="58" cy="62" r="6" />
        <circle cx="32" cy="64" r="3.5" />
      </g>
      {props.hits > 1 ? (
        <path d="M24 28c8-6 16-8 24-8" fill="none" stroke="#b3a79a" stroke-width="5" stroke-linecap="round" />
      ) : (
        <path d="M50 14 44 34l12 10-8 18 6 24" fill="none" stroke="#3a332d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      )}
    </svg>
  );
}

/** Kelp wound around a piece, holding it in place. */
export function KelpArt(): JSX.Element {
  return (
    <svg class="kelp-art" viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke-linecap="round">
        <path d="M12 96C30 70 4 50 22 30S30 6 26 2" stroke="#1f6b33" stroke-width="13" />
        <path d="M88 98C70 74 96 56 80 34S70 8 76 2" stroke="#1f6b33" stroke-width="13" />
        <path d="M12 96C30 70 4 50 22 30S30 6 26 2" stroke="#4caf50" stroke-width="7" />
        <path d="M88 98C70 74 96 56 80 34S70 8 76 2" stroke="#4caf50" stroke-width="7" />
        <path d="M4 60c30 10 62 10 92 0" stroke="#1f6b33" stroke-width="11" />
        <path d="M4 60c30 10 62 10 92 0" stroke="#66c26a" stroke-width="5" />
      </g>
    </svg>
  );
}

/** The creature each zone brings home once all its levels are reached, drawn on a 64 × 64 grid. */
const CREATURE_ART: Record<ZoneId, JSX.Element> = {
  // A hermit crab in a spiral shell.
  shallows: (
    <g stroke="#7a2e12" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
      <path d="M34 18c12 0 20 8 20 18s-7 16-17 16c-9 0-14-6-14-12s4-10 10-10c5 0 8 3 8 7s-3 6-6 6" fill="#f3c27a" />
      <path d="M14 46c0-6 4-10 10-10h8v14H18c-2 0-4-2-4-4Z" fill="#ef6a4a" />
      <path d="M16 40c-6-2-10-6-10-11 4 0 8 2 10 6M22 36c-4-4-5-9-3-13 3 2 5 6 5 10" fill="#ef6a4a" />
      <path d="M18 50l-4 6M24 50l-1 7M30 50l2 6" fill="none" />
      <circle cx="12" cy="24" r="2.4" fill="#1d1d1d" stroke="none" />
      <circle cx="19" cy="19" r="2.4" fill="#1d1d1d" stroke="none" />
    </g>
  ),
  // A dugong grazing.
  meadow: (
    <g stroke="#4a5866" stroke-width="2" stroke-linejoin="round">
      <path d="M8 34c0-8 8-12 18-12h14c10 0 16 6 18 12l4-6c2 4 2 10-2 14l2 6c-4 0-8-2-10-6-4 4-10 6-16 6H22C14 48 8 42 8 34Z" fill="#9fb3c4" />
      <path d="M20 44l-4 8 8-4M36 46l2 8 4-8" fill="#8aa0b3" />
      <circle cx="16" cy="31" r="2" fill="#1d1d1d" stroke="none" />
      <path d="M8 36c2 2 5 3 8 2" fill="none" />
      <path d="M6 52c4-6 6-12 4-18M58 54c-2-6-2-12 0-16" fill="none" stroke="#3f9a4a" stroke-width="3" stroke-linecap="round" />
    </g>
  ),
  // A seahorse.
  kelp: (
    <g stroke="#8a4a10" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
      <path d="M38 8c-8 0-14 6-14 12l-10 2c2 4 6 5 10 4 0 6 4 10 8 14-4 4-6 8-4 14 2 4 8 6 12 2 2-2 2-6-1-7-3 0-4 3-2 4" fill="none" stroke-width="7" stroke="#f3a63a" />
      <path d="M38 8c-8 0-14 6-14 12l-10 2c2 4 6 5 10 4 0 6 4 10 8 14-4 4-6 8-4 14 2 4 8 6 12 2 2-2 2-6-1-7-3 0-4 3-2 4" fill="none" />
      <path d="M40 14l6-4M42 22l6-2M42 30l6 0" fill="none" />
      <circle cx="31" cy="17" r="2" fill="#1d1d1d" stroke="none" />
    </g>
  ),
  // A parrotfish.
  garden: (
    <g stroke="#1e5f73" stroke-width="2" stroke-linejoin="round">
      <path d="M8 32c6-10 16-16 28-16 10 0 16 6 20 12l6-8c2 6 2 18 0 24l-6-8c-4 6-10 12-20 12-12 0-22-6-28-16Z" fill="#3fc0c9" />
      <path d="M30 18c4 6 4 22 0 28M40 18c3 6 3 22 0 28" fill="none" stroke="#f59bbd" stroke-width="3" />
      <path d="M8 32c3 2 6 3 9 2" fill="none" />
      <circle cx="18" cy="28" r="2.4" fill="#1d1d1d" stroke="none" />
    </g>
  ),
  // A grown sea turtle.
  beach: (
    <g stroke="#1f5b3a" stroke-width="2" stroke-linejoin="round">
      <path d="M14 22c-6-6-12-6-12-2 2 4 6 6 12 6ZM50 22c6-6 12-6 12-2-2 4-6 6-12 6ZM16 44c-4 4-6 10-4 12 4 0 8-4 10-8ZM48 44c4 4 6 10 4 12-4 0-8-4-10-8Z" fill="#7fc97a" />
      <ellipse cx="32" cy="34" rx="20" ry="18" fill="#4f9e5c" />
      <path d="M32 18l8 6v10l-8 6-8-6V24ZM24 34l-10 4M40 34l10 4" fill="none" stroke="#2c6e41" />
      <ellipse cx="32" cy="12" rx="7" ry="6" fill="#8fd18a" />
      <circle cx="29" cy="11" r="1.6" fill="#1d1d1d" stroke="none" />
      <circle cx="35" cy="11" r="1.6" fill="#1d1d1d" stroke="none" />
    </g>
  ),
  // An octopus.
  wreck: (
    <g stroke="#7a2950" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
      <path d="M32 6c11 0 18 8 18 18 0 6-2 10-6 13l4 12c1 4 6 5 8 2M44 37l-2 14c0 4 5 6 7 3M38 39l-4 14c-1 3 2 5 4 4M26 39l4 14c1 3-2 5-4 4M20 37l2 14c0 4-5 6-7 3M20 37l-4 12c-1 4-6 5-8 2M20 37c-4-3-6-7-6-13C14 14 21 6 32 6Z" fill="#e46a9a" />
      <circle cx="25" cy="24" r="2.6" fill="#1d1d1d" stroke="none" />
      <circle cx="39" cy="24" r="2.6" fill="#1d1d1d" stroke="none" />
      <path d="M28 31c2 2 6 2 8 0" fill="none" />
    </g>
  ),
  // A jellyfish, glowing.
  caves: (
    <g stroke="#5a3d9a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
      <path d="M10 30C10 16 20 8 32 8s22 8 22 22c-3 2-6 2-8 0-3 2-6 2-8 0-3 2-6 2-8 0-3 2-6 2-8 0-3 2-6 2-8 0-2 2-3 2-4 0Z" fill="#c7b2f5" />
      <path d="M18 32c-2 8 2 14 0 24M28 32c2 8-2 14 2 24M36 32c-2 8 2 14 0 24M46 32c2 8-2 14 2 22" fill="none" stroke="#9a72e0" stroke-width="2.6" />
      <path d="M18 20c2-5 7-8 12-8" fill="none" stroke="#fff" stroke-width="3" />
    </g>
  ),
  // A whale shark, spotted.
  lagoon: (
    <g stroke="#23405e" stroke-width="2" stroke-linejoin="round">
      <path d="M4 34c4-10 16-16 30-16 12 0 20 4 26 10l2-10c2 8 2 24 0 32l-2-10c-6 6-14 10-26 10C20 50 8 44 4 34Z" fill="#4e78a8" />
      <path d="M4 34c8 4 18 6 30 4 10-1 18-4 26-6" fill="none" stroke="#c8dcf0" stroke-width="2.6" />
      <path d="M30 18l6-8 4 10" fill="#4e78a8" />
      <g fill="#dce9f7" stroke="none">
        <circle cx="22" cy="28" r="1.6" />
        <circle cx="30" cy="26" r="1.6" />
        <circle cx="38" cy="28" r="1.6" />
        <circle cx="46" cy="30" r="1.6" />
        <circle cx="26" cy="33" r="1.4" />
        <circle cx="34" cy="32" r="1.4" />
        <circle cx="42" cy="34" r="1.4" />
      </g>
      <circle cx="12" cy="32" r="1.8" fill="#1d1d1d" stroke="none" />
    </g>
  ),
};

export function CreatureArt(props: { zone: ZoneId; size?: number; home: boolean }): JSX.Element {
  const size = props.size ?? 56;
  return (
    <svg class={`creature${props.home ? '' : ' creature--away'}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {CREATURE_ART[props.zone]}
    </svg>
  );
}

/** The buddies who swim beside the board, drawn on a 64 × 64 grid. */
const BUDDY_ART: Record<Buddy, JSX.Element> = {
  // A clownfish.
  clownfish: (
    <g stroke="#7a2a0c" stroke-width="2" stroke-linejoin="round">
      <path d="M6 32c6-10 14-14 24-14 8 0 14 4 18 10l8-8c2 8 2 16 0 24l-8-8c-4 6-10 10-18 10C20 46 12 42 6 32Z" fill="#ff7d2e" />
      <path d="M20 20c4 6 4 18 0 24M34 18c3 7 3 21 0 28" fill="none" stroke="#fff" stroke-width="5" />
      <circle cx="14" cy="29" r="2.4" fill="#1d1d1d" stroke="none" />
    </g>
  ),
  // A seal pup.
  seal: (
    <g stroke="#4d5560" stroke-width="2" stroke-linejoin="round">
      <path d="M8 36c0-10 8-16 18-16 6 0 10 2 14 6 6 4 12 6 18 6l-4 6 4 6c-8 0-14-2-18-4-4 6-10 8-16 8-10 0-16-4-16-12Z" fill="#c3cad3" />
      <path d="M22 44l-6 8 10-2M34 44l4 8 2-8" fill="#aab3be" />
      <circle cx="16" cy="32" r="2.4" fill="#1d1d1d" stroke="none" />
      <circle cx="9" cy="37" r="1.6" fill="#1d1d1d" stroke="none" />
    </g>
  ),
  // A manta ray.
  manta: (
    <g stroke="#1f3550" stroke-width="2" stroke-linejoin="round">
      <path d="M32 16c6 0 10 4 12 8 6 2 14 4 18 10-8 0-14 2-18 6-2 6-6 10-12 10s-10-4-12-10c-4-4-10-6-18-6 4-6 12-8 18-10 2-4 6-8 12-8Z" fill="#3d5f86" />
      <path d="M32 50v10" stroke-width="2.4" stroke-linecap="round" />
      <path d="M26 30c4 3 8 3 12 0" fill="none" stroke="#c8dcf0" stroke-width="2.4" />
      <circle cx="27" cy="22" r="1.8" fill="#fff" stroke="none" />
      <circle cx="37" cy="22" r="1.8" fill="#fff" stroke="none" />
    </g>
  ),
  // A leafy sea dragon.
  seadragon: (
    <g stroke="#7a5212" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
      <path d="M8 22c6 0 10 2 14 6 6-2 12 0 16 6 4 6 10 8 16 6 2 4 0 8-6 10-6 2-12 0-16-6-4-4-8-6-14-4-2 0-4-2-4-4-4 0-6-2-6-6Z" fill="#f0b64a" />
      <path d="M26 26l-4-8 8 4M36 34l2-10 4 8M46 44l6-6 0 8M30 40l-4 8 8-2" fill="#7fc97a" stroke="#3f8a4a" />
      <circle cx="13" cy="24" r="1.8" fill="#1d1d1d" stroke="none" />
    </g>
  ),
};

export function BuddyArt(props: { buddy: Buddy; size?: number; class?: string }): JSX.Element {
  const size = props.size ?? 48;
  return (
    <svg class={`buddy${props.class ? ` ${props.class}` : ''}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {BUDDY_ART[props.buddy]}
    </svg>
  );
}
