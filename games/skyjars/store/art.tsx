import { Rng } from '@game1/engine';
import { renderStoreArt } from '@game1/ui/store-art';
import type { JSX } from 'preact';
import '../src/fonts.css';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';
import { COLOURS, type ConstellationId } from '../src/sim/content.js';
import { figureOf } from '../src/sim/sky.js';
import { GlyphShape } from '../src/ui/Icon.js';

/** The symbols' ink, as the game draws it on a unit. */
const INK = 'rgb(46, 38, 98)';
const GLASS = '#cdd6ff';

/** The soft glow of every colour, as SVG gradients named `<prefix>-c<colour>`. */
function UnitGradients(props: { prefix: string }): JSX.Element {
  return (
    <>
      {COLOURS.map((c, i) => (
        <radialGradient key={c.id} id={`${props.prefix}-c${String(i)}`} cx="0.34" cy="0.3" r="0.85">
          <stop offset="0" stop-color={c.glow} />
          <stop offset="0.68" stop-color={c.fill} />
        </radialGradient>
      ))}
    </>
  );
}

interface JarProps {
  /** Top left of the jar's body. */
  x: number;
  y: number;
  /** Width of the body. */
  w: number;
  units: readonly number[];
  capacity: number;
  prefix: string;
  /** How strong the symbols are drawn: in the themed icon, only solid ink leaves a gap. */
  ink?: number;
}

/** A glass jar like the game's, its units of starlight from the bottom, each with its symbol. */
function Jar(props: JarProps): JSX.Element {
  const { x, y, w, capacity, prefix } = props;
  const pad = w * 0.1;
  const unit = w * 0.62;
  const h = capacity * unit + pad * 2;
  const clip = `${prefix}-clip-${String(Math.round(x))}-${String(Math.round(y))}`;
  const bottom = y + h - pad;
  const full = props.units.length === capacity && props.units.every((u) => u === props.units[0]);
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={x + pad} y={y + pad} width={w - 2 * pad} height={h - 2 * pad} rx={w * 0.26} />
        </clipPath>
      </defs>
      {full && <rect x={x - w * 0.12} y={y - w * 0.12} width={w * 1.24} height={h + w * 0.24} rx={w * 0.4} fill={COLOURS[props.units[0] ?? 0]?.glow ?? '#fff'} opacity="0.28" />}
      <rect x={x + w * 0.22} y={y - w * 0.14} width={w * 0.56} height={w * 0.2} rx={w * 0.06} fill="#1a1c4e" stroke={GLASS} stroke-width={w * 0.05} />
      <rect x={x} y={y} width={w} height={h} rx={w * 0.34} fill="#1f2257" stroke={GLASS} stroke-width={w * 0.06} />
      <g clip-path={`url(#${clip})`}>
        {props.units.map((colour, i) => {
          const top = bottom - (i + 1) * unit;
          const size = unit * 0.5;
          return (
            <g key={i}>
              <rect x={x + pad} y={top} width={w - 2 * pad} height={unit + 0.5} fill={`url(#${prefix}-c${String(colour)})`} />
              <g transform={`translate(${String(x + w / 2 - size / 2)} ${String(top + unit / 2 - size / 2)}) scale(${String(size / 24)})`} style={{ color: INK }} opacity={props.ink ?? 0.75}>
                <GlyphShape name={(COLOURS[colour] ?? COLOURS[0]).symbol} />
              </g>
            </g>
          );
        })}
      </g>
      <rect x={x + w * 0.2} y={y + w * 0.3} width={w * 0.09} height={h - w * 0.9} rx={w * 0.045} fill="#fff" opacity="0.22" />
    </g>
  );
}

/** A four-pointed sparkle of stardust. */
function Sparkle(props: { x: number; y: number; r: number; fill: string }): JSX.Element {
  const { x, y, r } = props;
  const k = r * 0.22;
  return <path d={`M${String(x)} ${String(y - r)}C${String(x + k)} ${String(y - k)} ${String(x + k)} ${String(y - k)} ${String(x + r)} ${String(y)}C${String(x + k)} ${String(y + k)} ${String(x + k)} ${String(y + k)} ${String(x)} ${String(y + r)}C${String(x - k)} ${String(y + k)} ${String(x - k)} ${String(y + k)} ${String(x - r)} ${String(y)}C${String(x - k)} ${String(y - k)} ${String(x - k)} ${String(y - k)} ${String(x)} ${String(y - r)}Z`} fill={props.fill} />;
}

/** Small stars scattered over a width × height sky, the same every time. */
function Stars(props: { width: number; height: number; count: number; seed: number; size: number }): JSX.Element {
  const rng = new Rng(props.seed);
  return (
    <g fill="#fff">
      {Array.from({ length: props.count }, (_, i) => (
        <circle key={i} cx={rng.next() * props.width} cy={rng.next() * props.height} r={props.size * (0.3 + rng.next() * rng.next())} opacity={0.35 + rng.next() * 0.6} />
      ))}
    </g>
  );
}

/** A constellation from the atlas, every star lit, in a square `size` wide at (x, y). */
function Constellation(props: { id: ConstellationId; x: number; y: number; size: number }): JSX.Element {
  const figure = figureOf(props.id);
  const at = (i: number) => {
    const [px, py] = figure.points[i] ?? [0.5, 0.5];
    return [props.x + px * props.size, props.y + py * props.size] as const;
  };
  return (
    <g>
      {figure.lines.map(([a, b], i) => {
        const [ax, ay] = at(a);
        const [bx, by] = at(b);
        return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke="#ffe7a8" stroke-width="3" stroke-linecap="round" opacity="0.55" />;
      })}
      {figure.points.map((_, i) => {
        const [cx, cy] = at(i);
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="13" fill="#ffe7a8" opacity="0.16" />
            <circle cx={cx} cy={cy} r="6" fill="#fff6d6" />
          </g>
        );
      })}
    </g>
  );
}

function IconBackground(): JSX.Element {
  return (
    <g>
      <defs>
        <radialGradient id="icon-night" cx="0.5" cy="0.32" r="0.85">
          <stop offset="0" stop-color="#3a2f86" />
          <stop offset="0.55" stop-color="#1a1b55" />
          <stop offset="1" stop-color="#0b0f2e" />
        </radialGradient>
      </defs>
      <rect width="108" height="108" fill="url(#icon-night)" />
      <Stars width={108} height={108} count={26} seed={1029} size={0.9} />
    </g>
  );
}

/** A jar of three colours with a spark of stardust, inside the 66 wide circle every launcher shows. */
function IconForeground(): JSX.Element {
  return (
    <g>
      <defs>
        <UnitGradients prefix="icon" />
      </defs>
      <Jar x={42} y={31} w={24} units={[6, 5, 2]} capacity={3} prefix="icon" ink={1} />
      <Sparkle x={70} y={34} r={7} fill="#ffe08a" />
      <Sparkle x={35} y={34} r={3.6} fill="#e6dcff" />
    </g>
  );
}

function FeatureGraphic(props: { locale: Locale }): JSX.Element {
  const text = translator(props.locale);
  const jars: { units: number[]; lift?: boolean }[] = [{ units: [0, 0, 0, 0] }, { units: [5, 4, 5] }, { units: [2, 2, 2], lift: true }, { units: [4, 4, 1, 6] }, { units: [6, 1] }];
  return (
    <g>
      <defs>
        <linearGradient id="fg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#090c2a" />
          <stop offset="0.55" stop-color="#171852" />
          <stop offset="1" stop-color="#3b2267" />
        </linearGradient>
        <linearGradient id="fg-ledge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ffd36e" stop-opacity="0" />
          <stop offset="0.5" stop-color="#ffd36e" stop-opacity="0.7" />
          <stop offset="1" stop-color="#ffd36e" stop-opacity="0" />
        </linearGradient>
        <UnitGradients prefix="fg" />
      </defs>
      <rect width="1024" height="500" fill="url(#fg-sky)" />
      <Stars width={1024} height={500} count={140} seed={20261029} size={2.2} />
      <Constellation id="heron" x={700} y={4} size={220} />
      {jars.map((jar, i) => (
        <Jar key={i} x={612 + i * 80} y={jar.lift ? 262 : 284} w={58} units={jar.units} capacity={4} prefix="fg" />
      ))}
      <rect x="590" y="458" width="420" height="5" rx="2.5" fill="url(#fg-ledge)" />
      <Sparkle x={86} y={128} r={30} fill="#ffe08a" />
      <Sparkle x={124} y={162} r={12} fill="#d9c6ff" />
      <g paint-order="stroke" stroke-linejoin="round">
        <text x="56" y="262" font-family="Fahkwang, serif" font-size="100" font-weight="700" fill="#ffe9b0" stroke="#0b0f2e" stroke-width="10">
          {text.t('app.title')}
        </text>
        <text x="62" y="322" font-family="K2D, sans-serif" font-size="30" font-weight="500" fill="#e8e6ff" stroke="#0b0f2e" stroke-width="8">
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
