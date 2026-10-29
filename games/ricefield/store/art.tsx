import { renderStoreArt } from '@game1/ui/store-art';
import type { JSX } from 'preact';
import '../src/fonts.css';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';
import { pictureOf, puzzleOf, type PictureId } from '../src/sim/fields.js';
import { FIELD_GREEN, INKS, isInk } from '../src/sim/palette.js';
import { MARKERS, SPROUT } from '../src/ui/Icon.js';

/** The game's colours: open water, young rice, the mud dike around a field, and the paper of the clues. */
const WATER = '#cfe8ec';
const RICE = '#bfe39a';
const DIKE = '#8a6a44';
const PAPER = '#fffdf4';
const TERRACES = ['#8ccf6a', '#6fbf55', '#5aae49', '#4b9c3f', '#3f8a37'];

/** A drawing from the game's 24 × 24 grid, `size` wide with its top left at (x, y). */
function Drawn(props: { x: number; y: number; size: number; children: JSX.Element }): JSX.Element {
  return <g transform={`translate(${String(props.x)} ${String(props.y)}) scale(${String(props.size / 24)})`}>{props.children}</g>;
}

/** Sky over terraced hills, `width` × `height`, the terraces starting at `top`, as the game's green terraces scene. */
function Hills(props: { width: number; height: number; top: number; id: string }): JSX.Element {
  const { width, height, top } = props;
  const band = (height - top) / TERRACES.length;
  return (
    <g>
      <defs>
        <linearGradient id={`${props.id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#bfe6f5" />
          <stop offset="1" stop-color="#eaf7e4" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#${props.id}-sky)`} />
      <path
        d={`M0 ${String(top - band * 0.4)}C${String(width * 0.2)} ${String(top - band * 1.6)} ${String(width * 0.35)} ${String(top - band * 1.3)} ${String(width * 0.5)} ${String(top - band * 0.7)}S${String(width * 0.85)} ${String(top - band * 1.9)} ${String(width)} ${String(top - band * 0.9)}V${String(height)}H0Z`}
        fill="#a6d39c"
      />
      {TERRACES.map((fill, i) => {
        const y = top + i * band;
        const lift = band * 0.28 * (i % 2 === 0 ? 1 : -1);
        return (
          <g key={fill}>
            <path d={`M0 ${String(y)}C${String(width * 0.3)} ${String(y - lift)} ${String(width * 0.6)} ${String(y + lift)} ${String(width)} ${String(y - lift * 0.5)}V${String(height)}H0Z`} fill={fill} />
            <path
              d={`M0 ${String(y)}C${String(width * 0.3)} ${String(y - lift)} ${String(width * 0.6)} ${String(y + lift)} ${String(width)} ${String(y - lift * 0.5)}`}
              fill="none"
              stroke="#28501e"
              stroke-opacity="0.35"
              stroke-width={band * 0.05}
            />
          </g>
        );
      })}
    </g>
  );
}

/** A 7 × 7 heart, as rows of rice. */
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

function IconBackground(): JSX.Element {
  return <Hills width={108} height={108} top={70} id="icon" />;
}

/**
 * A small field with a heart grown in it and a seedling planted on its dike, inside the 66 wide
 * circle every launcher shows. The rice around the heart is deep green so that, in the
 * one-colour themed icon, the dike, the heart and the seedling stay and the rest falls away.
 */
function IconForeground(): JSX.Element {
  const size = 48;
  const x0 = 54 - size / 2;
  const y0 = 58 - size / 2;
  const dike = 4.5;
  const inner = size - 2 * dike;
  const cell = inner / (HEART.length + 0.8);
  const edge = cell * 0.4;
  return (
    <g>
      <defs>
        <filter id="icon-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.3" flood-color="#1d3a14" flood-opacity="0.4" />
        </filter>
      </defs>
      <g filter="url(#icon-shadow)">
        <rect x={x0} y={y0} width={size} height={size} rx="8" fill="#d8b47a" />
        <rect x={x0 + dike} y={y0 + dike} width={inner} height={inner} rx="2.5" fill="#1b4217" />
        {HEART.flatMap((row, r) =>
          row.split('').map((mark, c) =>
            mark === 'X' ? (
              <rect
                key={`${String(r)}-${String(c)}`}
                x={x0 + dike + edge + c * cell + 0.3}
                y={y0 + dike + edge + r * cell + 0.3}
                width={cell - 0.6}
                height={cell - 0.6}
                rx="0.8"
                fill="#e0533f"
              />
            ) : null,
          ),
        )}
      </g>
      {/* The seedling's root sits in the top dike; its tip stays inside the circle. */}
      <Drawn x={54 - 10} y={y0 + 2 - 17.5} size={20}>
        {SPROUT}
      </Drawn>
    </g>
  );
}

/** Where everything of a field drawn `cell` a side goes, from the top left of its paper. */
function layoutOf(id: PictureId, cell: number) {
  const picture = pictureOf(id);
  const { shape, clues } = puzzleOf(picture);
  const font = cell * 0.46;
  const step = font * 1.3;
  const pad = cell * 0.45;
  const rowBand = Math.max(...clues.rows.map((clue) => clue.length)) * step + cell * 0.3;
  const colBand = Math.max(...clues.cols.map((clue) => clue.length)) * step + cell * 0.25;
  return {
    picture,
    shape,
    clues,
    font,
    step,
    pad,
    rowBand,
    colBand,
    width: rowBand + shape.width * cell + 2 * pad,
    height: colBand + shape.height * cell + 2 * pad,
  };
}

/**
 * A field as the game draws it, `cell` a side, on its paper with the top left at (x, y) and the
 * clues above and beside it: the picture's rice planted, its colour sweeping in from the top
 * left as it grows, `sweep` of the way across.
 */
function Board(props: { id: PictureId; x: number; y: number; cell: number; sweep: number }): JSX.Element {
  const { cell, sweep } = props;
  const { picture, shape, clues, font, step, pad, rowBand, colBand, width: paperWidth, height: paperHeight } = layoutOf(props.id, cell);
  const { width, height } = shape;
  const left = props.x + pad + rowBand;
  const top = props.y + pad + colBand;
  const reach = width + height - 2;
  return (
    <g>
      <defs>
        <filter id="board-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#1d3a14" flood-opacity="0.3" />
        </filter>
        <symbol id="board-sprout" viewBox="0 0 24 24">
          {SPROUT}
        </symbol>
        <symbol id="board-pebble" viewBox="0 0 24 24">
          {MARKERS.pebble}
        </symbol>
      </defs>
      <rect x={props.x} y={props.y} width={paperWidth} height={paperHeight} rx={cell * 0.5} fill={PAPER} filter="url(#board-shadow)" />
      <g font-family="Krub, sans-serif" font-weight="600" font-size={font} fill="#2c3a1f" text-anchor="middle">
        {clues.cols.map((clue, c) =>
          clue.map((n, i) => (
            <text key={`c${String(c)}-${String(i)}`} x={left + (c + 0.5) * cell} y={top - cell * 0.2 - (clue.length - 1 - i) * step}>
              {n}
            </text>
          )),
        )}
        {clues.rows.map((clue, r) =>
          clue.map((n, i) => (
            <text key={`r${String(r)}-${String(i)}`} x={left - cell * 0.15 - (clue.length - 0.5 - i) * step} y={top + (r + 0.5) * cell + font * 0.36}>
              {n}
            </text>
          )),
        )}
      </g>
      {Array.from({ length: width * height }, (_, at) => {
        const r = Math.floor(at / width);
        const c = at % width;
        const letter = picture.rows[r]?.[c] ?? '.';
        const x = left + c * cell;
        const y = top + r * cell;
        if ((r + c) / reach < sweep) {
          const ink = isInk(letter) ? INKS[letter] : picture.ground ? INKS[picture.ground] : FIELD_GREEN;
          return <rect key={at} x={x} y={y} width={cell + 0.5} height={cell + 0.5} fill={ink} />;
        }
        const rice = shape.filled[at];
        return (
          <g key={at}>
            <rect x={x} y={y} width={cell + 0.5} height={cell + 0.5} fill={rice ? RICE : WATER} />
            {rice ? (
              <use href="#board-sprout" x={x + cell * 0.1} y={y + cell * 0.1} width={cell * 0.8} height={cell * 0.8} />
            ) : (
              <use href="#board-pebble" x={x + cell * 0.2} y={y + cell * 0.2} width={cell * 0.6} height={cell * 0.6} />
            )}
          </g>
        );
      })}
      <path
        d={[
          ...Array.from({ length: width - 1 }, (_, i) => `M${String(left + (i + 1) * cell)} ${String(top)}v${String(height * cell)}`),
          ...Array.from({ length: height - 1 }, (_, i) => `M${String(left)} ${String(top + (i + 1) * cell)}h${String(width * cell)}`),
        ].join('')}
        stroke="#37646e"
        stroke-opacity="0.25"
        stroke-width="1.5"
      />
      <rect x={left} y={top} width={width * cell} height={height * cell} fill="none" stroke={DIKE} stroke-width={cell * 0.12} />
    </g>
  );
}

/** Rows of young rice across the near terraces, the way a paddy is planted. */
function Planted(props: { rows: readonly { y: number; size: number; from: number; to: number }[] }): JSX.Element {
  return (
    <g>
      {props.rows.flatMap((row) => {
        const gap = row.size * 1.5;
        return Array.from({ length: Math.floor((row.to - row.from) / gap) + 1 }, (_, i) => (
          <Drawn key={`${String(row.y)}-${String(i)}`} x={row.from + i * gap} y={row.y} size={row.size}>
            {SPROUT}
          </Drawn>
        ));
      })}
    </g>
  );
}

const FEATURE_FIELD: PictureId = 'rooster';
const FEATURE_CELL = 31;

function FeatureGraphic(props: { locale: Locale }): JSX.Element {
  const text = translator(props.locale);
  const board = layoutOf(FEATURE_FIELD, FEATURE_CELL);
  return (
    <g>
      <Hills width={1024} height={500} top={330} id="fg" />
      <circle cx="108" cy="74" r="40" fill="#fff2a8" />
      <Planted
        rows={[
          { y: 372, size: 26, from: 30, to: 540 },
          { y: 418, size: 32, from: 14, to: 560 },
          { y: 466, size: 38, from: 0, to: 580 },
        ]}
      />
      <Board id={FEATURE_FIELD} x={1024 - 44 - board.width} y={(500 - board.height) / 2} cell={FEATURE_CELL} sweep={0.62} />
      <g paint-order="stroke" stroke-linejoin="round">
        <text x="56" y="196" font-family="Itim, sans-serif" font-size="86" fill="#3a6b2a" stroke={PAPER} stroke-width="14">
          {text.t('app.title')}
        </text>
        <text x="60" y="252" font-family="Krub, sans-serif" font-weight="600" font-size="28" fill="#2c3a1f" stroke={PAPER} stroke-width="9">
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
