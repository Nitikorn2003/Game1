import { renderStoreArt } from '@game1/ui/store-art';
import type { JSX } from 'preact';
import '../src/fonts.css';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';
import { PipArt, SharedDefs } from '../src/ui/art.js';

/** The game's morning sky, top to bottom, the grass of the meadow, and the brown of the branch and the title's outline. */
const SKY = ['#8fd3ff', '#cdeeff', '#fff6d8'] as const;
const GRASS = ['#8fd65e', '#5fae3f'] as const;
const BARK = '#7a4a10';

/** Sky from the top down, `width` × `height`, with the sun's glow in one corner. */
function Sky(props: { width: number; height: number; id: string; sun: readonly [number, number, number] }): JSX.Element {
  const { width, height, id, sun } = props;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={SKY[0]} />
          <stop offset="0.6" stop-color={SKY[1]} />
          <stop offset="1" stop-color={SKY[2]} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" stop-color="#fffbe6" />
          <stop offset="0.35" stop-color="#fff1a8" stop-opacity="0.9" />
          <stop offset="1" stop-color="#fff1a8" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#${id}-sky)`} />
      <circle cx={sun[0]} cy={sun[1]} r={sun[2]} fill={`url(#${id}-sun)`} />
    </g>
  );
}

function Cloud(props: { x: number; y: number; scale: number }): JSX.Element {
  return (
    <g transform={`translate(${String(props.x)} ${String(props.y)}) scale(${String(props.scale)})`} fill="#fff" opacity="0.9">
      <ellipse cx="0" cy="0" rx="34" ry="14" />
      <circle cx="-12" cy="-8" r="13" />
      <circle cx="10" cy="-12" r="16" />
    </g>
  );
}

/** A rolling hill of grass from `top` down, dotted with little flowers. */
function Hill(props: { width: number; height: number; top: number; id: string; flowers: readonly (readonly [number, number])[] }): JSX.Element {
  const { width, height, top, id } = props;
  const d = `M0 ${String(top + 8)}C${String(width * 0.3)} ${String(top - 18)} ${String(width * 0.6)} ${String(top + 14)} ${String(width)} ${String(top - 4)}V${String(height)}H0Z`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-grass`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={GRASS[0]} />
          <stop offset="1" stop-color={GRASS[1]} />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${id}-grass)`} />
      {props.flowers.map(([x, y], i) => (
        <circle key={`${String(x)}-${String(y)}`} cx={x} cy={y} r={Math.max(1.4, width / 300)} fill={i % 3 === 0 ? '#ff9ab3' : '#fff'} />
      ))}
    </g>
  );
}

/** Pip, `size` wide, with the top left of the drawing at (x, y). */
function Pip(props: { x: number; y: number; size: number }): JSX.Element {
  return (
    <g transform={`translate(${String(props.x)} ${String(props.y)})`}>
      <PipArt hat="leaf" size={props.size} />
    </g>
  );
}

function IconBackground(): JSX.Element {
  return (
    <g>
      <Sky width={108} height={108} id="icon" sun={[26, 24, 30]} />
      <Cloud x={80} y={30} scale={0.34} />
      <Hill
        width={108}
        height={108}
        top={80}
        id="icon"
        flowers={[
          [28, 90],
          [44, 96],
          [62, 92],
          [78, 98],
          [86, 88],
        ]}
      />
    </g>
  );
}

/** Pip, inside the 66 wide circle every launcher shows. */
function IconForeground(): JSX.Element {
  return (
    <g>
      <defs>
        <filter id="icon-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#3a2a10" flood-opacity="0.35" />
        </filter>
      </defs>
      <g filter="url(#icon-shadow)">
        <Pip x={24} y={25} size={60} />
      </g>
    </g>
  );
}

/** The buds on the feature graphic's branch, row by row: a colour, or a colour with a baby bee in it, or none. */
const FEATURE_BUDS: readonly (readonly (readonly [number, boolean?] | null)[])[] = [
  [[0], [0], [1], [3], [3], [4], [2]],
  [[1], [1, true], [3], [4], [4], [2]],
  [[2], [4], [0], [0], [1], [5, true], [2]],
  [[2], null, [0], [5], [1], null],
  [[3], null, null, [5], null, null, null],
];
const BUD = 56;
const ROW_H = BUD * 0.866;

function FeatureGraphic(props: { locale: Locale }): JSX.Element {
  const text = translator(props.locale);
  const width = BUD * 7;
  const left = 1024 - 44 - width;
  const top = 64;
  const at = (row: number, col: number) => ({ x: left + col * BUD + (row % 2 === 1 ? BUD / 2 : 0), y: top + row * ROW_H });
  // Pip shoots from under the branch, at the gap in the fourth row.
  const pip = { x: left + width / 2 - 70, y: 330 };
  const from = { x: left + width / 2, y: 372 };
  const gap = at(3, 1);
  const to = { x: gap.x + BUD / 2, y: gap.y + BUD / 2 };
  const ball = { x: from.x + (to.x - from.x) * 0.42 - BUD / 2, y: from.y + (to.y - from.y) * 0.42 - BUD / 2 };
  return (
    <g>
      <defs>
        <SharedDefs />
        <filter id="fg-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#3a2a10" flood-opacity="0.3" />
        </filter>
      </defs>
      <Sky width={1024} height={500} id="fg" sun={[120, 60, 260]} />
      <Cloud x={430} y={70} scale={1.4} />
      <Cloud x={120} y={360} scale={1} />
      <Hill
        width={1024}
        height={500}
        top={430}
        id="fg"
        flowers={[
          [60, 470],
          [150, 486],
          [240, 462],
          [330, 480],
          [420, 470],
          [520, 488],
          [610, 466],
          [700, 484],
          [860, 472],
          [950, 488],
        ]}
      />
      <g filter="url(#fg-shadow)">
        <rect x={left - 18} y={top - 18} width={width + 36} height="20" rx="10" fill={BARK} />
        <path d={`M${String(left + 30)} ${String(top - 14)}c10-18 30-20 40-8-12 8-26 10-40 8Z`} fill="#62b84c" stroke="#2f6b2f" stroke-width="3" />
        <path d={`M${String(left + width - 60)} ${String(top - 14)}c-10-18-30-20-40-8 12 8 26 10 40 8Z`} fill="#62b84c" stroke="#2f6b2f" stroke-width="3" />
        {FEATURE_BUDS.flatMap((row, r) =>
          row.map((bud, c) => {
            if (!bud) return null;
            const p = at(r, c);
            return (
              <g key={`${String(r)}-${String(c)}`}>
                <use href={`#bh-bud-${String(bud[0])}`} x={p.x} y={p.y} width={BUD} height={BUD} />
                {bud[1] && <use href="#bh-bee" x={p.x} y={p.y} width={BUD} height={BUD} />}
              </g>
            );
          }),
        )}
      </g>
      <path d={`M${String(from.x)} ${String(from.y)}L${String(to.x)} ${String(to.y)}`} stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="0 16" />
      <circle cx={to.x} cy={to.y} r={BUD * 0.42} fill="#fff" fill-opacity="0.35" stroke="#fff" stroke-width="3" stroke-dasharray="6 6" />
      <use href="#bh-bud-0" x={ball.x} y={ball.y} width={BUD} height={BUD} />
      <g filter="url(#fg-shadow)">
        <Pip x={pip.x} y={pip.y} size={140} />
      </g>
      <g paint-order="stroke" stroke-linejoin="round">
        <text x="50" y="214" font-family="Kodchasan, sans-serif" font-weight="700" font-size="84" fill="#fff" stroke={BARK} stroke-width="14">
          {text.t('app.title')}
        </text>
        <text x="56" y="268" font-family="KoHo, sans-serif" font-weight="600" font-size="29" fill="#fff" stroke={BARK} stroke-width="8">
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
