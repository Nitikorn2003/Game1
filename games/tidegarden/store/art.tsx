import { renderStoreArt } from '@game1/ui/store-art';
import type { JSX } from 'preact';
import '../src/fonts.css';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';
import { BOMB, COL, NONE, PEARL, ROW, TURTLE, type Special } from '../src/sim/board.js';
import { SharedDefs, pieceArt, specialArt } from '../src/ui/art.js';

/** The game's sunlit water, top to bottom, the sand of the sea floor, and the deep pool the board is. */
const WATER = ['#8fe2f7', '#2aa6d6', '#0f6aa6'] as const;
const SAND = '#ecd29b';
const POOL = '#0b4472';
const POOL_2 = '#0e5285';

/** Water from the surface down, `width` × `height`, with light coming through it from above. */
function Water(props: { width: number; height: number; id: string }): JSX.Element {
  const { width, height, id } = props;
  const ray = (x: number, spread: number) => `M${String(x)} 0h${String(spread)}L${String(x + spread * 2.6)} ${String(height)}H${String(x + spread * 1.2)}Z`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={WATER[0]} />
          <stop offset="0.5" stop-color={WATER[1]} />
          <stop offset="1" stop-color={WATER[2]} />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#${id}-water)`} />
      <g fill="#fff" opacity="0.16">
        <path d={ray(width * 0.08, width * 0.07)} />
        <path d={ray(width * 0.3, width * 0.05)} />
        <path d={ray(width * 0.55, width * 0.08)} />
      </g>
    </g>
  );
}

/** The sea floor from `top` down, a gentle rise of sand. */
function Floor(props: { width: number; height: number; top: number }): JSX.Element {
  const { width, height, top } = props;
  const d = `M0 ${String(top)}C${String(width * 0.25)} ${String(top - 14)} ${String(width * 0.5)} ${String(top + 10)} ${String(width * 0.75)} ${String(top - 6)}S${String(width)} ${String(top + 4)} ${String(width)} ${String(top)}V${String(height)}H0Z`;
  return (
    <g>
      <path d={d} fill={SAND} />
      <path d={d} fill="url(#tg-sand)" />
    </g>
  );
}

function Bubbles(props: { at: readonly (readonly [number, number, number])[] }): JSX.Element {
  return (
    <g fill="#fff" fill-opacity="0.25" stroke="#fff" stroke-opacity="0.7">
      {props.at.map(([x, y, r]) => (
        <circle key={`${String(x)}-${String(y)}`} cx={x} cy={y} r={r} stroke-width={Math.max(1, r * 0.18)} />
      ))}
    </g>
  );
}

/** A piece of the reef as the board draws it, `size` a side with its top left at (x, y). */
function Piece(props: { kind: number; special?: Special; x: number; y: number; size: number }): JSX.Element {
  const special = props.special ?? NONE;
  const inset = props.size * 0.06;
  const scale = (props.size - 2 * inset) / 100;
  return (
    <g transform={`translate(${String(props.x + inset)} ${String(props.y + inset)}) scale(${String(scale)})`}>
      {special === BOMB && specialArt(special)}
      {pieceArt(props.kind)}
      {special !== BOMB && specialArt(special)}
    </g>
  );
}

/** A baby turtle seen from above, heading up the picture, its dark lines drawn so that the themed icon keeps them as gaps. */
function Turtle(): JSX.Element {
  return (
    <g stroke="#123a24" stroke-width="4" stroke-linejoin="round">
      <path d="M30 36C18 28 8 28 4 34c6 6 16 10 28 10ZM70 36c12-8 22-8 26-2-6 6-16 10-28 10ZM32 76c-6 4-10 10-8 14 6 0 12-4 14-10ZM68 76c6 4 10 10 8 14-6 0-12-4-14-10Z" fill="#7fc97a" />
      <ellipse cx="50" cy="18" rx="11" ry="10" fill="#8fd18a" />
      <ellipse cx="50" cy="56" rx="27" ry="31" fill="#4f9e5c" />
      <path d="M50 36l10 8v13l-10 7-10-7V44ZM40 57l-12 6M60 57l12 6M40 44l-10-6M60 44l10-6M50 64v16" fill="none" stroke="#1d4a2c" stroke-width="3.4" />
      <path d="M33 44c3-7 8-11 15-12" fill="none" stroke="#b5e6ad" stroke-width="4" stroke-linecap="round" />
      <circle cx="45" cy="15" r="2.8" fill="#10261a" stroke="none" />
      <circle cx="55" cy="15" r="2.8" fill="#10261a" stroke="none" />
    </g>
  );
}

function IconBackground(): JSX.Element {
  return (
    <g>
      <defs>
        <SharedDefs />
      </defs>
      <Water width={108} height={108} id="icon" />
      <Floor width={108} height={108} top={88} />
      <Bubbles
        at={[
          [86, 24, 4],
          [93, 36, 2.6],
          [20, 30, 2.4],
        ]}
      />
    </g>
  );
}

/** The baby turtle, tilted as it swims, inside the 66 wide circle every launcher shows. */
function IconForeground(): JSX.Element {
  return (
    <g transform="rotate(-12 54 55) translate(23 25) scale(0.62)">
      <defs>
        <filter id="icon-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.4" flood-color="#06304f" flood-opacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#icon-shadow)">
        <Turtle />
      </g>
    </g>
  );
}

/** The pieces on the feature graphic's board, row by row: a kind, and the special it is when it is one. */
const FEATURE_BOARD: readonly (readonly [number, Special?])[][] = [
  [[1], [4], [TURTLE], [2], [0]],
  [[3], [1, ROW], [0], [0], [4]],
  [[2], [3], [PEARL], [5], [2, BOMB]],
  [[4], [2], [1], [3, COL], [1]],
  [[0], [5], [2], [4], [3]],
];
const FEATURE_CELL = 66;

function FeatureGraphic(props: { locale: Locale }): JSX.Element {
  const text = translator(props.locale);
  const size = FEATURE_CELL * 5;
  const left = 1024 - 48 - size;
  const top = (500 - size) / 2 - 4;
  return (
    <g>
      <defs>
        <SharedDefs />
        <filter id="fg-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#06304f" flood-opacity="0.4" />
        </filter>
      </defs>
      <Water width={1024} height={500} id="fg" />
      <Floor width={1024} height={500} top={420} />
      <Bubbles
        at={[
          [540, 120, 14],
          [566, 76, 8],
          [520, 40, 5],
          [470, 360, 10],
          [60, 70, 7],
        ]}
      />
      <g filter="url(#fg-shadow)">
        <rect x={left - 10} y={top - 10} width={size + 20} height={size + 20} rx="26" fill="#f7fdff" fill-opacity="0.85" />
        <rect x={left} y={top} width={size} height={size} rx="18" fill={POOL} />
      </g>
      {FEATURE_BOARD.flatMap((row, y) =>
        row.map(([kind, special], x) => (
          <g key={`${String(x)}-${String(y)}`}>
            {(x + y) % 2 === 1 && <rect x={left + x * FEATURE_CELL} y={top + y * FEATURE_CELL} width={FEATURE_CELL} height={FEATURE_CELL} fill={POOL_2} />}
            <Piece kind={kind} special={special ?? NONE} x={left + x * FEATURE_CELL} y={top + y * FEATURE_CELL} size={FEATURE_CELL} />
          </g>
        )),
      )}
      <g transform="translate(170 452) rotate(80) scale(0.75) translate(-50 -50)">
        <Turtle />
      </g>
      <g paint-order="stroke" stroke-linejoin="round">
        <text x="52" y="210" font-family="Sriracha, sans-serif" font-size="96" fill="#fff" stroke={POOL} stroke-width="14">
          {text.t('app.title')}
        </text>
        <text x="58" y="268" font-family="Prompt, sans-serif" font-weight="600" font-size="28" fill="#fff" stroke={POOL} stroke-width="8">
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
