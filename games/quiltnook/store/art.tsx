import { renderStoreArt } from '@game1/ui/store-art';
import type { JSX } from 'preact';
import '../src/fonts.css';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';
import { FABRIC_LOOKS, tileShapes, type FabricLook } from '../src/ui/fabrics.js';

const COTTAGE = FABRIC_LOOKS.cottage;
const MEADOW = FABRIC_LOOKS.meadow;

/** A fabric as an SVG pattern, from the same tiles the game draws its patches with. */
function Fabric(props: { id: string; look: FabricLook; tile: number }): JSX.Element {
  return (
    <pattern id={props.id} width={props.tile} height={props.tile} patternUnits="userSpaceOnUse" viewBox="0 0 20 20">
      <rect width="20" height="20" fill={props.look.base} />
      <g dangerouslySetInnerHTML={{ __html: tileShapes(props.look) }} />
    </pattern>
  );
}

/** One square of fabric with its dashed stitch, `size` wide at (x, y). */
function Square(props: { x: number; y: number; size: number; fill: string }): JSX.Element {
  const { x, y, size } = props;
  const inset = size * 0.11;
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.08} fill={props.fill} />
      <rect
        x={x + inset}
        y={y + inset}
        width={size - 2 * inset}
        height={size - 2 * inset}
        rx={size * 0.05}
        fill="none"
        stroke="#fffaf0"
        stroke-width={size * 0.045}
        stroke-dasharray={`${String(size * 0.09)} ${String(size * 0.07)}`}
        opacity="0.85"
      />
    </g>
  );
}

function IconBackground(): JSX.Element {
  return (
    <g>
      <defs>
        <radialGradient id="icon-linen" cx="0.5" cy="0.42" r="0.8">
          <stop offset="0" stop-color="#fffaf0" />
          <stop offset="1" stop-color="#e6d3b5" />
        </radialGradient>
        <pattern id="icon-weave" width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 0.5h3M0.5 0v3" stroke="#b08a5c" stroke-width="0.35" opacity="0.18" />
        </pattern>
      </defs>
      <rect width="108" height="108" fill="url(#icon-linen)" />
      <rect width="108" height="108" fill="url(#icon-weave)" />
    </g>
  );
}

/** A quilt block of nine squares, inside the 66 wide circle every launcher shows. */
function IconForeground(): JSX.Element {
  const order = [0, 1, 2, 3, 0, 1, 2, 3, 0];
  const size = 14;
  const left = 54 - (3 * size) / 2;
  return (
    <g>
      <defs>
        {COTTAGE.map((look, i) => (
          <Fabric key={i} id={`icon-f${String(i)}`} look={look} tile={size / 2} />
        ))}
      </defs>
      <rect x={left - 4.5} y={left - 4.5} width={3 * size + 9} height={3 * size + 9} rx="6" fill="#fffaf0" stroke="#6b4a33" stroke-width="1.8" />
      <rect x={left - 1} y={left - 1} width={3 * size + 2} height={3 * size + 2} rx="2.5" fill="#6b4a33" />
      {order.map((fabric, i) => (
        <Square key={i} x={left + (i % 3) * size + 0.5} y={left + Math.floor(i / 3) * size + 0.5} size={size - 1} fill={`url(#icon-f${String(fabric)})`} />
      ))}
    </g>
  );
}

/** A small quilt: rows of fabric numbers, `.` for a gap. */
function Quilt(props: { x: number; y: number; size: number; rows: readonly string[]; prefix: string }): JSX.Element {
  const { x, y, size } = props;
  const width = (props.rows[0]?.length ?? 0) * size;
  const height = props.rows.length * size;
  return (
    <g>
      <rect x={x - 14} y={y - 14} width={width + 28} height={height + 28} rx="22" fill="#e9dcc8" stroke="#c9b394" stroke-width="3" />
      <rect x={x - 4} y={y - 4} width={width + 8} height={height + 8} rx="10" fill="#fdf8ef" />
      {props.rows.flatMap((row, ry) =>
        Array.from(row, (mark, rx) =>
          mark === '.' ? null : <Square key={`${String(rx)},${String(ry)}`} x={x + rx * size + 2} y={y + ry * size + 2} size={size - 4} fill={`url(#${props.prefix}${mark})`} />,
        ),
      )}
    </g>
  );
}

function Spool(props: { x: number; y: number; scale: number }): JSX.Element {
  return (
    <g transform={`translate(${String(props.x)} ${String(props.y)}) scale(${String(props.scale)})`}>
      <rect x="-30" y="-48" width="60" height="14" rx="6" fill="#c99a62" stroke="#7a5230" stroke-width="3" />
      <rect x="-30" y="34" width="60" height="14" rx="6" fill="#c99a62" stroke="#7a5230" stroke-width="3" />
      <rect x="-22" y="-34" width="44" height="68" fill="#d65a4a" stroke="#9b3a30" stroke-width="3" />
      <path d="M-20 -22h40M-20 -10h40M-20 2h40M-20 14h40M-20 26h40" stroke="#f6a89c" stroke-width="2.5" />
    </g>
  );
}

function FeatureGraphic(props: { locale: Locale }): JSX.Element {
  const text = translator(props.locale);
  const quilt = ['01230123', '12.01230', '230.2301', '30122012', '0123.123', '1230.230', '23012301'];
  return (
    <g>
      <defs>
        <linearGradient id="fg-linen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fbf4e8" />
          <stop offset="1" stop-color="#ecdcc3" />
        </linearGradient>
        <pattern id="fg-weave" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 1h6M1 0v6" stroke="#b08a5c" stroke-width="0.8" opacity="0.12" />
        </pattern>
        {COTTAGE.map((look, i) => (
          <Fabric key={`c${String(i)}`} id={`fg-c${String(i)}`} look={look} tile={22} />
        ))}
        {MEADOW.map((look, i) => (
          <Fabric key={`m${String(i)}`} id={`fg-m${String(i)}`} look={look} tile={22} />
        ))}
      </defs>
      <rect width="1024" height="500" fill="url(#fg-linen)" />
      <rect width="1024" height="500" fill="url(#fg-weave)" />
      <g transform="rotate(-6 824 240)">
        <Quilt x={664} y={100} size={40} rows={quilt} prefix="fg-c" />
      </g>
      {/* Loose patches, the way the tray deals them. */}
      <g transform="rotate(12 580 90)">
        <Square x={550} y={44} size={36} fill="url(#fg-m1)" />
        <Square x={586} y={44} size={36} fill="url(#fg-m1)" />
        <Square x={586} y={80} size={36} fill="url(#fg-m1)" />
      </g>
      <g transform="rotate(-14 985 70)">
        <Square x={962} y={28} size={36} fill="url(#fg-m3)" />
        <Square x={962} y={64} size={36} fill="url(#fg-m3)" />
      </g>
      <path d="M598 448C500 492 330 486 236 428S84 368 30 404" fill="none" stroke="#d65a4a" stroke-width="3" stroke-dasharray="10 7" stroke-linecap="round" />
      <Spool x={622} y={410} scale={0.9} />
      <g font-family="Mali, sans-serif" paint-order="stroke" stroke-linejoin="round">
        <text x="56" y="224" font-size="104" font-weight="700" fill="#4a3426" stroke="#fffaf0" stroke-width="14">
          {text.t('app.title')}
        </text>
        <text x="60" y="292" font-size="34" font-weight="500" fill="#7a3a22" stroke="#fffaf0" stroke-width="10">
          {text.t('app.tagline')}
        </text>
      </g>
    </g>
  );
}

const root = document.getElementById('art');
if (root) {
  renderStoreArt(root, {
    iconBackground: () => <IconBackground />,
    iconForeground: () => <IconForeground />,
    featureGraphic: (locale) => <FeatureGraphic locale={LOCALES.find((l) => l === locale) ?? 'en'} />,
  });
}
