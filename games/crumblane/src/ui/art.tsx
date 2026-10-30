import type { JSX } from 'preact';
import { PASTRIES, type Pastry } from '../sim/counter.js';
import type { ZoneId } from '../sim/levels.js';

/**
 * The bakery's pastries, drawn once as symbols on a 100 × 100 grid and used on every tile by
 * name. The first eight each have their own colour and shape, so a counter of few kinds reads
 * at a glance; the other eight are told apart by shape. All are outlined in cocoa.
 */
const INK = '#5a3423';
const DOUGH = '#e9b36f';
const DOUGH_DARK = '#c98c5a';
const CREAM = '#fff8ec';

const stroke = { stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } as const;

const DRAWINGS: Readonly<Record<Pastry, JSX.Element>> = {
  // A pink-glazed ring donut with sprinkles; the tile shows through its hole.
  donut: (
    <g {...stroke}>
      <path d="M50 15a37 37 0 1 1-.1 0ZM50 41a11 11 0 1 0 .1 0Z" fill={DOUGH} fill-rule="evenodd" />
      <path d="M50 20c9 0 14 3 20 6s10 9 11 17-1 13-3 18-8 10-15 12-13 2-19 0-12-6-15-11-4-12-3-19 5-12 10-16 8-7 14-7ZM50 39a13 13 0 1 0 .1 0Z" fill="#ff8fb1" fill-rule="evenodd" />
      <g stroke-width="3.2">
        <path d="M33 33l5 3" stroke="#4fb5e8" />
        <path d="M63 29l-2 5" stroke="#ffe24a" />
        <path d="M70 50l5-2" stroke="#7fcf6a" />
        <path d="M62 66l3 4" stroke="#4fb5e8" />
        <path d="M37 64l-4 3" stroke="#ffe24a" />
        <path d="M28 48l-1 5" stroke="#fff" />
        <path d="M47 27h5" stroke="#fff" />
      </g>
    </g>
  ),
  // A mint macaron from the side: two shells and the cream between.
  macaron: (
    <g {...stroke}>
      <path d="M17 58h66c0 14-15 22-33 22S17 72 17 58Z" fill="#7fd49a" />
      <path d="M19 49h62v9H19Z" fill={CREAM} />
      <path d="M17 49c0-15 15-27 33-27s33 12 33 27Z" fill="#8fe0a8" />
      <path d="M20 49c3 3 5 3 8 0s5 3 8 0 5 3 8 0 5 3 8 0 5 3 8 0 5 3 8 0 4 3 7 0" fill="none" stroke-width="3" />
      <path d="M31 33c4-4 9-6 15-6" fill="none" stroke="#e3fbe9" stroke-width="4" />
    </g>
  ),
  // A golden croissant, its lobes rolled to two tips.
  croissant: (
    <g {...stroke}>
      <path d="M12 64c4-14 10-22 18-24 4-12 12-18 20-18s16 6 20 18c8 2 14 10 18 24-8-4-14-4-18-2-4 6-12 10-20 10s-16-4-20-10c-4-2-10-2-18 2Z" fill="#f2a541" />
      <path d="M30 40c3 10 3 20 0 30M70 40c-3 10-3 20 0 30M50 22c4 14 4 34 0 52" fill="none" />
      <path d="M40 30c2-2 5-3 8-3" fill="none" stroke="#ffd896" stroke-width="4" />
    </g>
  ),
  // A blueberry muffin in a blue paper cup.
  muffin: (
    <g {...stroke}>
      <path d="M27 54h46l-6 30H33Z" fill="#6fa8e8" />
      <path d="M37 56l2 26M50 56v26M63 56l-2 26" fill="none" stroke="#3d6fb0" stroke-width="3" />
      <path d="M21 57c-3-16 9-31 29-31s32 15 29 31c-6 3-12 3-18 0-6 3-16 3-22 0-6 3-12 3-18 0Z" fill={DOUGH} />
      <g fill="#3f4fae" stroke-width="2.6">
        <circle cx="38" cy="40" r="4.2" />
        <circle cx="56" cy="35" r="4.2" />
        <circle cx="65" cy="48" r="4.2" />
        <circle cx="46" cy="50" r="4.2" />
      </g>
    </g>
  ),
  // A ripe strawberry with its leaves.
  strawberry: (
    <g {...stroke}>
      <path d="M50 86C29 76 17 59 21 43c4-12 17-14 29-10 12-4 25-2 29 10 4 16-8 33-29 43Z" fill="#f0465f" />
      <g fill="#ffe9a8" stroke="none">
        <ellipse cx="36" cy="48" rx="2.2" ry="3.2" />
        <ellipse cx="50" cy="45" rx="2.2" ry="3.2" />
        <ellipse cx="64" cy="48" rx="2.2" ry="3.2" />
        <ellipse cx="42" cy="60" rx="2.2" ry="3.2" />
        <ellipse cx="58" cy="60" rx="2.2" ry="3.2" />
        <ellipse cx="50" cy="72" rx="2.2" ry="3.2" />
      </g>
      <path d="M50 34 38 24l3 10-12-1 10 7M50 34l12-10-3 10 12-1-10 7M50 34l-2-14" fill="#5fbf52" />
    </g>
  ),
  // A cupcake piled with lilac frosting and a cherry.
  cupcake: (
    <g {...stroke}>
      <path d="M29 60h42l-6 25H35Z" fill="#ffd1dc" />
      <path d="M40 61l1 23M50 61v23M60 61l-1 23" fill="none" stroke="#e58aa4" stroke-width="3" />
      <path d="M24 60c-4-8 2-14 9-15-3-9 6-16 17-16s20 7 17 16c7 1 13 7 9 15Z" fill="#b886e8" />
      <path d="M33 45c6 3 28 3 34 0" fill="none" stroke="#8b5cc6" stroke-width="3" />
      <circle cx="50" cy="22" r="7" fill="#e8475f" />
      <path d="M50 15c2-5 6-7 10-7" fill="none" stroke-width="3" />
    </g>
  ),
  // A lemon tart in its fluted crust, with a twist of lemon.
  tart: (
    <g {...stroke}>
      <path d="M12 54c0-15 17-25 38-25s38 10 38 25-17 25-38 25-38-10-38-25Z" fill="#e3a45c" />
      <path d="M21 53c0-10 13-17 29-17s29 7 29 17-13 17-29 17-29-7-29-17Z" fill="#ffe24a" />
      <path d="M41 46c0-6 18-6 18 0s-18 6-18 0Z" fill="#fff7b0" stroke-width="3" />
      <path d="M50 40v12M44 42l12 8M56 42l-12 8" fill="none" stroke="#f0c419" stroke-width="2.4" />
    </g>
  ),
  // A long chocolate eclair with a white drizzle.
  eclair: (
    <g {...stroke}>
      <rect x="11" y="39" width="78" height="28" rx="14" fill={DOUGH} />
      <path d="M13 49c0-6 5-10 12-10h50c7 0 12 4 12 10-3 4-6 4-9 1-3 4-7 4-10 0-3 5-7 5-10 0-4 5-8 5-12 0-3 5-7 5-10 0-3 4-7 4-10 0-4 3-8 3-13-1Z" fill="#6b3b22" />
      <path d="M26 46l6-4 6 4 6-4 6 4 6-4 6 4 6-4 6 4" fill="none" stroke="#fff4e0" stroke-width="2.8" />
    </g>
  ),
  // A crusty loaf with three cuts across its top.
  loaf: (
    <g {...stroke}>
      <path d="M13 68c0-22 17-37 37-37s37 15 37 37c0 5-3 8-8 8H21c-5 0-8-3-8-8Z" fill="#d9984f" />
      <path d="M31 48l9-8M45 47l9-9M59 49l9-8" fill="none" stroke="#f7d6a2" stroke-width="5" />
      <path d="M31 48l9-8M45 47l9-9M59 49l9-8" fill="none" stroke-width="2.4" />
    </g>
  ),
  // A slice of layer cake: sponge, cream and jam, and a strawberry on top.
  cake: (
    <g {...stroke}>
      <path d="M15 76V48l70-16v44Z" fill="#f7d9a0" />
      <path d="M15 58l70-12v8L15 66Z" fill="#ff8fb1" />
      <path d="M15 48l70-16v8L15 55Z" fill="#fffaf2" />
      <path d="M15 76V48l70-16v44Z" fill="none" />
      <path d="M58 30c0-6 10-8 12-2 2 4-2 8-6 10-4-2-6-4-6-8Z" fill="#f0465f" stroke-width="3" />
    </g>
  ),
  // A cherry pie under a lattice crust.
  pie: (
    <g {...stroke}>
      <path d="M10 56c0-15 18-26 40-26s40 11 40 26-18 26-40 26-40-11-40-26Z" fill={DOUGH_DARK} />
      <path d="M19 55c0-10 14-18 31-18s31 8 31 18-14 18-31 18-31-8-31-18Z" fill="#c0283f" />
      <path d="M30 41l20 30M47 37l22 31M60 39l12 18M29 69l22-31M45 72l23-33M66 69l9-12" fill="none" stroke="#f2c48d" stroke-width="6" />
      <path d="M19 55c0-10 14-18 31-18s31 8 31 18-14 18-31 18-31-8-31-18Z" fill="none" />
    </g>
  ),
  // A round cookie with chocolate chips.
  cookie: (
    <g {...stroke}>
      <path d="M50 16c8 0 12 4 18 5s13 8 14 15 4 11 2 18-5 13-11 18-12 9-21 9-14-3-20-7-12-10-14-18 0-12 3-18 5-12 11-16 10-6 18-6Z" fill="#e0a867" />
      <g fill="#5a3423" stroke="none">
        <path d="M36 34l6 1-2 5-5-1Z" />
        <path d="M58 30l6 2-3 5-4-2Z" />
        <path d="M66 52l5 3-4 4-4-3Z" />
        <path d="M44 52l6 1-1 6-6-2Z" />
        <path d="M30 58l5 2-3 5-4-3Z" />
        <path d="M54 68l6 1-2 5-5-2Z" />
      </g>
    </g>
  ),
  // A square waffle with a pat of butter melting on it.
  waffle: (
    <g {...stroke}>
      <rect x="16" y="20" width="68" height="64" rx="12" fill="#f0b85a" />
      <path d="M33 22v60M50 22v60M67 22v60M18 37h64M18 52h64M18 67h64" fill="none" stroke="#c98431" stroke-width="3.2" />
      <path d="M41 40h18v12H41Z" fill="#fff1a8" stroke-width="3" />
    </g>
  ),
  // A soft pretzel knot with flakes of salt.
  pretzel: (
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M33 74C10 63 13 30 34 28c16-1 21 17 16 32-5-15 0-33 16-32 21 2 24 35 1 46M38 58l26 18M62 58 36 76" stroke={INK} stroke-width="17" />
      <path d="M33 74C10 63 13 30 34 28c16-1 21 17 16 32-5-15 0-33 16-32 21 2 24 35 1 46M38 58l26 18M62 58 36 76" stroke="#a0612e" stroke-width="10" />
      <g stroke="#fff" stroke-width="3">
        <path d="M24 44h.1M33 34h.1M66 34h.1M77 46h.1M45 66h.1M57 69h.1" />
      </g>
    </g>
  ),
  // A cinnamon roll, iced.
  roll: (
    <g {...stroke}>
      <circle cx="50" cy="52" r="35" fill={DOUGH} />
      <path d="M50 52c0-4 6-5 8-1 3 6-3 12-10 11-9-1-13-11-9-19 5-11 21-12 28-3 9 11 3 28-11 32-16 5-31-6-31-22" fill="none" stroke="#a0612e" stroke-width="4.5" />
      <path d="M24 34c8 6 16-6 24 2s18-4 26 4" fill="none" stroke="#fffaf2" stroke-width="4" />
    </g>
  ),
  // A gingerbread friend with icing and buttons.
  gingerbread: (
    <g {...stroke}>
      <path d="M50 12a13 13 0 0 1 9 22.5h3l16 8c4 2 4 8-1 9l-14-3v11l10 16c2 4-1 8-6 7l-17-15-17 15c-5 1-8-3-6-7l10-16v-11l-14 3c-5-1-5-7-1-9l16-8h3A13 13 0 0 1 50 12Z" fill="#c47a3c" />
      <path d="M44 23h.1M56 23h.1" stroke-width="4.4" />
      <path d="M45 29c3 2 7 2 10 0" fill="none" stroke="#fff" stroke-width="2.6" />
      <path d="M24 45c2-2 4 2 6 0M70 45c2-2 4 2 6 0M33 75c2-2 4 2 6 0M61 75c2-2 4 2 6 0" fill="none" stroke="#fff" stroke-width="2.6" />
      <circle cx="50" cy="44" r="3" fill="#ff8fb1" stroke-width="2" />
      <circle cx="50" cy="55" r="3" fill="#7fcf6a" stroke-width="2" />
    </g>
  ),
};

/** Which pastry each shop hangs on its sign. */
export const SIGN_OF: Readonly<Record<ZoneId, Pastry>> = {
  bread: 'loaf',
  cafe: 'croissant',
  cookies: 'cookie',
  cupcakes: 'cupcake',
  pies: 'pie',
  donuts: 'donut',
  chocolate: 'eclair',
  cakes: 'cake',
};

/** The colours of each shop's awning. */
export const SHOP_COLOURS: Readonly<Record<ZoneId, string>> = {
  bread: '#e2a868',
  cafe: '#f06b7f',
  cookies: '#4fb5e8',
  cupcakes: '#ff9ec2',
  pies: '#7fcf6a',
  donuts: '#ffc83d',
  chocolate: '#9a6444',
  cakes: '#b886e8',
};

/** Every symbol the bakery is drawn with, once, for any drawing that uses them. */
export function ArtDefs(): JSX.Element {
  return (
    <svg class="artdefs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {PASTRIES.map((p) => (
          <symbol key={p} id={`cl-p-${p}`} viewBox="0 0 100 100">
            {DRAWINGS[p]}
          </symbol>
        ))}
        {/* A paper bag over a tile, folded at the top: what is inside shows once nothing covers it. */}
        <symbol id="cl-bag" viewBox="0 0 100 100">
          <path d="M8 18h84v74H8Z" fill="#d6a46e" />
          <path d="M8 18l8-12h68l8 12" fill="#e9c296" stroke="#8a5a32" stroke-width="3" stroke-linejoin="round" />
          <path d="M8 18h84" stroke="#8a5a32" stroke-width="3" />
          <path d="M20 30l6 50M78 28l-4 54" stroke="#c48e56" stroke-width="2" opacity="0.7" />
          <circle cx="50" cy="55" r="19" fill="#f3dcb8" stroke="#8a5a32" stroke-width="3" />
          <path d="M43 50a7 7 0 1 1 9.5 6.5c-2 .9-2.5 2-2.5 4M50 67h.1" fill="none" stroke="#6b4423" stroke-width="4.5" stroke-linecap="round" />
        </symbol>
        {/* A ribbon tied around a shut box, with its bow. */}
        <symbol id="cl-ribbon" viewBox="0 0 100 100">
          <path d="M42 0h16v100H42ZM0 42h100v16H0Z" fill="#f47c90" stroke="#b02a43" stroke-width="2.5" />
          <path d="M50 50c-10-16-30-16-26-2 3 9 18 6 26 2Zm0 0c10-16 30-16 26-2-3 9-18 6-26 2Z" fill="#ff9fb0" stroke="#b02a43" stroke-width="3" stroke-linejoin="round" />
          <path d="M50 50l-12 18M50 50l12 18" stroke="#b02a43" stroke-width="5" stroke-linecap="round" />
          <circle cx="50" cy="50" r="6" fill="#e8475f" stroke="#b02a43" stroke-width="3" />
        </symbol>
        {/* Sprinkles over a tile's face. */}
        <symbol id="cl-sprinkles" viewBox="0 0 100 100">
          <g stroke-linecap="round" stroke-width="4.5">
            <path d="M10 14l7-4" stroke="#f06b7f" />
            <path d="M84 10l6 5" stroke="#4fb5e8" />
            <path d="M8 84l7 3" stroke="#ffc83d" />
            <path d="M88 82l3 7" stroke="#7fcf6a" />
            <path d="M48 7l7 1" stroke="#b886e8" />
            <path d="M6 48l1 7" stroke="#4fb5e8" />
            <path d="M93 46l-2 7" stroke="#f06b7f" />
            <path d="M46 92l7-2" stroke="#ffc83d" />
          </g>
        </symbol>
        {/* A pastry box, tied: three of a kind boxed up. */}
        <symbol id="cl-box" viewBox="0 0 100 100">
          <path d="M14 38h72v50H14Z" fill="#fff4f6" stroke={INK} stroke-width="4" stroke-linejoin="round" />
          <path d="M8 24h84v16H8Z" fill="#ffe1e8" stroke={INK} stroke-width="4" stroke-linejoin="round" />
          <path d="M50 24v64" stroke="#e8475f" stroke-width="9" />
          <path d="M50 24c-12-16-28-10-22 0Zm0 0c12-16 28-10 22 0Z" fill="#f47c90" stroke="#b02a43" stroke-width="3.5" stroke-linejoin="round" />
        </symbol>
      </defs>
    </svg>
  );
}

/** A pastry drawn from its symbol. */
export function PastryArt(props: { kind: number; size: number; class?: string }): JSX.Element {
  const name = PASTRIES[props.kind] ?? PASTRIES[0];
  return (
    <svg class={props.class ?? 'pastry'} width={props.size} height={props.size} viewBox="0 0 100 100" aria-hidden="true" data-pastry={name}>
      <use href={`#cl-p-${name}`} />
    </svg>
  );
}

/** A small tile with a pastry on it, as the rules and the sheets show one. */
export function TileArt(props: { kind: number; size: number; bag?: boolean; box?: boolean; sprinkles?: boolean }): JSX.Element {
  const { size } = props;
  return (
    <span class="minitile" style={{ '--t': `${String(size)}px` }} aria-hidden="true">
      <span class="minitile__face">
        {props.sprinkles && (
          <svg class="tile__sprinkles" viewBox="0 0 100 100">
            <use href="#cl-sprinkles" />
          </svg>
        )}
        {props.bag ? (
          <svg class="tile__bag" viewBox="0 0 100 100">
            <use href="#cl-bag" />
          </svg>
        ) : (
          <PastryArt kind={props.kind} size={Math.round(size * 0.8)} class="tile__art" />
        )}
        {props.box && (
          <svg class="tile__ribbon" viewBox="0 0 100 100">
            <use href="#cl-ribbon" />
          </svg>
        )}
      </span>
    </span>
  );
}

/** Hazel, the dormouse who bakes on Crumb Lane, in her baker's hat and apron. */
export function HazelArt(props: { size: number; mood?: 'happy' | 'worried'; class?: string }): JSX.Element {
  const worried = props.mood === 'worried';
  return (
    <svg class={`hazel ${props.class ?? ''}`} width={props.size} height={props.size} viewBox="0 0 120 120" aria-hidden="true">
      <g stroke={INK} stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        {/* Her big soft tail, curled up behind her. */}
        <path d="M86 98c18 0 28-14 26-30-2-14-14-20-24-14-8 5-6 16 2 18" fill="#d9a06a" />
        <path d="M100 62c4 4 5 10 3 16" fill="none" stroke="#f3cf9f" stroke-width="3" />
        {/* Body and apron. */}
        <path d="M30 112c-6-30 8-52 30-52s36 22 30 52Z" fill="#c98c5a" />
        <path d="M40 112c-2-22 6-36 20-36s22 14 20 36Z" fill="#ffd9e2" />
        <path d="M48 92h24v10H48Z" fill="#fff" stroke-width="2.5" />
        <path d="M40 80c6 2 12-2 20-2s14 4 20 2" fill="none" stroke-width="2.5" />
        {/* Ears. */}
        <circle cx="30" cy="40" r="14" fill="#d39a64" />
        <circle cx="30" cy="40" r="8" fill="#f7b6c2" stroke-width="2" />
        <circle cx="90" cy="40" r="14" fill="#d39a64" />
        <circle cx="90" cy="40" r="8" fill="#f7b6c2" stroke-width="2" />
        {/* Head. */}
        <ellipse cx="60" cy="56" rx="28" ry="25" fill="#d9a06a" />
        <ellipse cx="60" cy="64" rx="17" ry="12" fill="#f6dcb8" stroke="none" />
        {/* Baker's hat. */}
        <path d="M40 38c-8-2-10-14-2-18 2-10 14-12 20-6 6-8 20-6 22 4 8 2 8 14-2 18Z" fill="#fffdf8" />
        <path d="M41 33h38v8H41Z" fill="#fffdf8" />
        <path d="M50 24c1 4 1 7 0 9M66 22c1 4 1 8 0 11" fill="none" stroke-width="2" opacity="0.6" />
        {/* Face. */}
        <circle cx="49" cy="56" r="4.6" fill={INK} stroke="none" />
        <circle cx="71" cy="56" r="4.6" fill={INK} stroke="none" />
        <circle cx="50.6" cy="54.4" r="1.6" fill="#fff" stroke="none" />
        <circle cx="72.6" cy="54.4" r="1.6" fill="#fff" stroke="none" />
        {worried && <path d="M43 47l9 2M77 47l-9 2" fill="none" stroke-width="2.5" />}
        <ellipse cx="60" cy="64" rx="4" ry="3" fill="#f27a93" stroke-width="2" />
        {worried ? <ellipse cx="60" cy="72" rx="3" ry="2.6" fill="#8a3b3b" stroke-width="2" /> : <path d="M54 70c3 4 9 4 12 0" fill="none" stroke-width="2.5" />}
        <circle cx="42" cy="66" r="4" fill="#f7a8b8" stroke="none" opacity="0.7" />
        <circle cx="78" cy="66" r="4" fill="#f7a8b8" stroke="none" opacity="0.7" />
        <path d="M36 62l-12-2M36 66l-11 2M84 62l12-2M84 66l11 2" fill="none" stroke-width="1.6" opacity="0.7" />
      </g>
    </svg>
  );
}

/**
 * A shop of the lane: its awning in the shop's colours and its sign. Dark until every level of
 * the shop is cleared, then open, its window lit.
 */
export function ShopArt(props: { zone: ZoneId; open: boolean; size: number }): JSX.Element {
  const { zone, open, size } = props;
  const colour = SHOP_COLOURS[zone];
  return (
    <svg class={`shopfront${open ? ' shopfront--open' : ''}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g stroke={INK} stroke-width="3" stroke-linejoin="round">
        <path d="M12 40h76v52H12Z" fill={open ? '#fff4e0' : '#e8ddd0'} />
        <path d="M8 26h84l-4 16H12Z" fill={open ? colour : '#bfb2a6'} />
        <path d="M22 26l-2 16M36 26l-1 16M50 26v16M64 26l1 16M78 26l2 16" stroke="#fff" stroke-width="4" opacity={open ? 0.9 : 0.5} />
        <path d="M8 26h84l-4 16H12Z" fill="none" />
        <path d="M20 92V62h20v30" fill={open ? '#c98c5a' : '#a8998c'} />
        <circle cx="35" cy="78" r="2" fill={INK} stroke="none" />
        <path d="M50 54h32v26H50Z" fill={open ? '#ffe7a3' : '#8c8c96'} />
        <path d="M66 54v26M50 67h32" stroke-width="2.5" />
        <circle cx="50" cy="13" r="12" fill="#fffaf2" />
      </g>
      <use href={`#cl-p-${SIGN_OF[zone]}`} x="40" y="3" width="20" height="20" opacity={open ? 1 : 0.45} />
    </svg>
  );
}
