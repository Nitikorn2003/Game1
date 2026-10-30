import { renderStoreArt } from '@game1/ui/store-art';
import type { JSX } from 'preact';
import '../src/fonts.css';
import { PASTRIES, type Pastry } from '../src/sim/counter.js';
import { ZONES } from '../src/sim/levels.js';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';
import { ArtDefs, HazelArt, ShopArt } from '../src/ui/art.js';

/** The lane's spring sky, top to bottom; the strawberry red of the awnings and the title; the wood of the counter. */
const SKY = ['#ffc9d8', '#ffe4ec', '#fdf1e6'] as const;
const AWNING = '#e8475f';
const INK = '#7a2433';
const WOOD = ['#d9a06a', '#b97c48'] as const;
const WOOD_EDGE = '#8f5a34';

/** Sky from the top down, `width` × `height`, with the sun's glow. */
function Sky(props: { width: number; height: number; id: string; sun: readonly [number, number, number] }): JSX.Element {
  const { width, height, id, sun } = props;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={SKY[0]} />
          <stop offset="0.55" stop-color={SKY[1]} />
          <stop offset="1" stop-color={SKY[2]} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" stop-color="#fffbe8" />
          <stop offset="0.35" stop-color="#fff2c4" stop-opacity="0.9" />
          <stop offset="1" stop-color="#fff2c4" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#${id}-sky)`} />
      <circle cx={sun[0]} cy={sun[1]} r={sun[2]} fill={`url(#${id}-sun)`} />
    </g>
  );
}

/** A striped shop awning across the top, `width` wide and `depth` deep, with a scalloped edge. */
function Awning(props: { width: number; depth: number; stripes: number }): JSX.Element {
  const { width, depth, stripes } = props;
  const w = width / stripes;
  const r = w / 2;
  return (
    <g>
      {Array.from({ length: stripes }, (_, i) => (
        <path
          key={i}
          d={`M${String(i * w)} 0h${String(w)}v${String(depth)}a${String(r)} ${String(r * 0.8)} 0 0 1 ${String(-w)} 0Z`}
          fill={i % 2 === 0 ? AWNING : '#fff7f2'}
          stroke="#b02a43"
          stroke-width={depth * 0.05}
        />
      ))}
    </g>
  );
}

/** Petals falling on the lane. */
function Petals(props: { at: readonly (readonly [number, number, number])[] }): JSX.Element {
  return (
    <g fill="#ffb3c6" opacity="0.85">
      {props.at.map(([x, y, r]) => (
        <ellipse key={`${String(x)}-${String(y)}`} cx={x} cy={y} rx={r} ry={r * 0.6} transform={`rotate(${String((x * 7 + y) % 90)} ${String(x)} ${String(y)})`} />
      ))}
    </g>
  );
}

/** A glazed tile with a pastry on it, `size` across, its face's top left at (x, y); `under` darkens one covered by another. */
function Tile(props: { x: number; y: number; size: number; pastry: Pastry; under?: boolean }): JSX.Element {
  const { x, y, size, pastry, under } = props;
  const edge = size * 0.12;
  const art = size * 0.78;
  return (
    <g>
      <rect x={x} y={y + edge} width={size} height={size} rx={size * 0.16} fill={under ? '#a9805c' : '#d5a274'} />
      <rect x={x} y={y} width={size} height={size} rx={size * 0.16} fill={under ? '#cdb79c' : 'url(#tile-face)'} stroke={under ? '#9c7a5a' : '#d9b48c'} stroke-width={size * 0.025} />
      <use href={`#cl-p-${pastry}`} x={x + (size - art) / 2} y={y + (size - art) / 2} width={art} height={art} opacity={under ? 0.55 : 1} />
    </g>
  );
}

/** A wooden board, with the grain running across it. */
function Board(props: { x: number; y: number; w: number; h: number; id: string }): JSX.Element {
  const { x, y, w, h, id } = props;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={WOOD[0]} />
          <stop offset="1" stop-color={WOOD[1]} />
        </linearGradient>
      </defs>
      <rect x={x} y={y + 8} width={w} height={h} rx="22" fill={WOOD_EDGE} />
      <rect x={x} y={y} width={w} height={h} rx="22" fill={`url(#${id}-wood)`} />
      {Array.from({ length: Math.floor(h / 26) }, (_, i) => (
        <path key={i} d={`M${String(x + 18)} ${String(y + 20 + i * 26)}h${String(w - 36)}`} stroke="#c58b57" stroke-width="3" stroke-linecap="round" opacity="0.55" />
      ))}
    </g>
  );
}

/** The gradient of a tile's glazed face, for the tiles drawn here. */
function TileFace(): JSX.Element {
  return (
    <linearGradient id="tile-face" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0.3" stop-color="#fffaf1" />
      <stop offset="1" stop-color="#f9ead6" />
    </linearGradient>
  );
}

function IconBackground(): JSX.Element {
  return (
    <g>
      <Sky width={108} height={108} id="icon" sun={[86, 30, 34]} />
      <Awning width={108} depth={20} stripes={6} />
      <rect x="0" y="86" width="108" height="22" fill={WOOD[1]} />
      <rect x="0" y="86" width="108" height="5" fill={WOOD[0]} />
    </g>
  );
}

/** Hazel the baker, inside the 66 wide circle every launcher shows. */
function IconForeground(): JSX.Element {
  return (
    <g>
      <defs>
        <filter id="icon-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#5a2a1a" flood-opacity="0.35" />
        </filter>
      </defs>
      <g filter="url(#icon-shadow)">
        <g transform="translate(22 21)">
          <HazelArt size={64} />
        </g>
      </g>
    </g>
  );
}

/** The counter on the feature graphic: its bottom layer row by row, all of it covered, then the top layer over it, half a tile in. */
const BOTTOM: readonly (readonly Pastry[])[] = [
  ['donut', 'macaron', 'cupcake', 'muffin', 'eclair'],
  ['strawberry', 'tart', 'donut', 'cookie', 'macaron'],
  ['cupcake', 'eclair', 'muffin', 'strawberry', 'tart'],
];
const TOP: readonly (readonly Pastry[])[] = [
  ['croissant', 'cupcake', 'donut', 'macaron'],
  ['tart', 'croissant', 'strawberry', 'cupcake'],
];
const T = 60;

function FeatureGraphic(props: { locale: Locale }): JSX.Element {
  const text = translator(props.locale);
  const board = { x: 646, y: 44, w: 5 * T + 52, h: 3 * T + 70 };
  const left = board.x + 26;
  const top = board.y + 30;
  const lift = 7;
  const tray = { x: 548, y: 336, w: 7 * 54 + 6 * 6 + 28, h: 54 + 34 };
  const place = (i: number) => ({ x: tray.x + 14 + i * 60, y: tray.y + 12 });
  // The croissant taken last flies from the counter to the third place, beside the other two.
  const from = { x: left + T * 1.5 + T / 2, y: top + T + T / 2 - lift };
  const to = place(2);
  const flying = { x: from.x + (to.x + 27 - from.x) * 0.55 - 30, y: from.y + (to.y + 27 - from.y) * 0.55 - 30 };
  return (
    <g>
      <ArtDefs />
      <defs>
        <TileFace />
        <filter id="fg-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#5a2a1a" flood-opacity="0.28" />
        </filter>
      </defs>
      <Sky width={1024} height={500} id="fg" sun={[470, 40, 230]} />
      <Awning width={1024} depth={40} stripes={16} />
      {/* The lane behind: every shop open. */}
      <g opacity="0.95">
        {ZONES.map((zone, i) => (
          <g key={zone} transform={`translate(${String(i * 128 + 4)} 352)`}>
            <ShopArt zone={zone} open={true} size={120} />
          </g>
        ))}
      </g>
      <rect x="0" y="456" width="1024" height="44" fill="#d9c2ad" />
      <path d="M0 462h1024" stroke="#bfa48b" stroke-width="5" />
      <Petals
        at={[
          [80, 70, 7],
          [330, 120, 6],
          [440, 300, 7],
          [520, 90, 5],
          [990, 250, 6],
          [30, 300, 5],
          [400, 40, 5],
        ]}
      />
      <g filter="url(#fg-shadow)">
        <Board x={board.x} y={board.y} w={board.w} h={board.h} id="fg" />
        {BOTTOM.flatMap((row, r) => row.map((p, c) => <Tile key={`b${String(r)}-${String(c)}`} x={left + c * T} y={top + r * T} size={T - 4} pastry={p} under />))}
        {TOP.flatMap((row, r) =>
          row.map((p, c) => (r === 1 && c === 1 ? null : <Tile key={`t${String(r)}-${String(c)}`} x={left + T / 2 + c * T} y={top + T / 2 + r * T - lift} size={T - 4} pastry={p} />)),
        )}
        <Board x={tray.x} y={tray.y} w={tray.w} h={tray.h} id="tray" />
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} {...place(i)} width="54" height="56" rx="10" fill={i >= 5 ? '#f7d4da' : '#f6e3c8'} opacity="0.9" />
        ))}
        <Tile {...place(0)} size={54} pastry="croissant" />
        <Tile {...place(1)} size={54} pastry="croissant" />
        <Tile {...place(3)} size={54} pastry="donut" />
      </g>
      <path
        d={`M${String(from.x)} ${String(from.y)}Q${String(from.x - 40)} ${String((from.y + to.y) / 2)} ${String(to.x + 27)} ${String(to.y + 20)}`}
        fill="none"
        stroke="#fff"
        stroke-width="6"
        stroke-linecap="round"
        stroke-dasharray="0 14"
      />
      <g filter="url(#fg-shadow)">
        <Tile x={flying.x} y={flying.y} size={60} pastry="croissant" />
      </g>
      <g filter="url(#fg-shadow)">
        <g transform="translate(330 196)">
          <HazelArt size={230} />
        </g>
      </g>
      <g paint-order="stroke" stroke-linejoin="round">
        <text x="44" y="164" font-family="Chonburi, serif" font-size="80" fill="#fff" stroke={INK} stroke-width="13">
          {text.t('app.title')}
        </text>
        <text x="50" y="220" font-family="Niramit, sans-serif" font-weight="600" font-size="29" fill="#fff" stroke={INK} stroke-width="8">
          {text.t('app.tagline')}
        </text>
      </g>
    </g>
  );
}

// Every pastry the counter above uses is one the game draws.
for (const p of [...BOTTOM.flat(), ...TOP.flat()]) if (!PASTRIES.includes(p)) throw new Error(`No drawing of ${p}`);

const root = document.getElementById('art');
if (root) {
  renderStoreArt(root, {
    iconBackground: () => <IconBackground />,
    iconForeground: () => <IconForeground />,
    featureGraphic: (locale) => <FeatureGraphic locale={LOCALES.find((l) => l === locale) ?? 'en'} />,
  });
}
