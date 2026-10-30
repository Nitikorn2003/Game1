import { Rng } from '@game1/engine';
import { renderStoreArt } from '@game1/ui/store-art';
import type { JSX } from 'preact';
import '../src/fonts.css';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';
import { RANK_LABELS, type Suit } from '../src/sim/cards.js';
import { Icon, SuitShape } from '../src/ui/Icon.js';

/** The suits' ink and the card paper, as the game draws them. */
const SUIT_INK: Readonly<Record<Suit, string>> = { lotus: '#c2185b', mango: '#b35900', fish: '#1e5fa8', leaf: '#1f7a43' };
const PAPER = '#fbf1dc';
const BACK = '#b8295f';
const BACK_INK = '#ffd6e7';

/** A shape from the game's 24 × 24 drawings, `size` wide with its top left at (x, y). */
function Drawn(props: { x: number; y: number; size: number; colour?: string; children: JSX.Element }): JSX.Element {
  return (
    <g transform={`translate(${String(props.x)} ${String(props.y)}) scale(${String(props.size / 24)})`} style={props.colour ? { color: props.colour } : undefined}>
      {props.children}
    </g>
  );
}

/** The paper of a card face, as SVG gradients named `<prefix>-paper`. */
function Paper(props: { prefix: string }): JSX.Element {
  return (
    <linearGradient id={`${props.prefix}-paper`} x1="0.3" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#fffdf7" />
      <stop offset="1" stop-color="#f7eddb" />
    </linearGradient>
  );
}

/** A card face up, `w` wide with its top left at the origin: its rank in the corner, its suit beside it and again below. */
function CardFace(props: { rank: number; suit: Suit; w: number; prefix: string }): JSX.Element {
  const { w, suit } = props;
  const h = w * 1.4;
  const text = RANK_LABELS[props.rank] ?? '?';
  const wide = text.length > 1;
  const ink = SUIT_INK[suit];
  return (
    <g>
      <rect width={w} height={h} rx={w * 0.12} fill={`url(#${props.prefix}-paper)`} stroke="#9c8052" stroke-opacity="0.55" stroke-width={w * 0.014} />
      <text
        x={w * (wide ? 0.04 : 0.09)}
        y={w * 0.5}
        font-family="Kanit, sans-serif"
        font-weight="600"
        font-size={w * (wide ? 0.42 : 0.5)}
        letter-spacing={wide ? -0.08 * 0.42 * w : undefined}
        fill={ink}
      >
        {text}
      </text>
      <Drawn x={w * 0.62} y={w * 0.12} size={w * 0.3} colour={ink}>
        <SuitShape suit={suit} />
      </Drawn>
      <Drawn x={w * 0.19} y={h - w * 0.72} size={w * 0.62} colour={ink}>
        <SuitShape suit={suit} />
      </Drawn>
    </g>
  );
}

/**
 * A card face down in the lotus backs, `w` wide with its top left at the origin. Without the
 * dots, as on the launcher icon, it has a frame instead, in a deeper red: the themed icon then
 * keeps only the edge, the frame and the lotus.
 */
function CardBack(props: { w: number; dots?: string }): JSX.Element {
  const { w } = props;
  const h = w * 1.4;
  const edge = w * 0.05;
  return (
    <g>
      <rect width={w} height={h} rx={w * 0.12} fill={PAPER} />
      <rect x={edge} y={edge} width={w - 2 * edge} height={h - 2 * edge} rx={w * 0.08} fill={props.dots ? BACK : '#a12257'} />
      {props.dots ? (
        <rect x={edge} y={edge} width={w - 2 * edge} height={h - 2 * edge} rx={w * 0.08} fill={`url(#${props.dots})`} />
      ) : (
        <rect x={edge * 2.4} y={edge * 2.4} width={w - 4.8 * edge} height={h - 4.8 * edge} rx={w * 0.05} fill="none" stroke="#e8789f" stroke-width={w * 0.025} />
      )}
      <Drawn x={w * 0.17} y={h / 2 - w * 0.33} size={w * 0.66} colour={BACK_INK}>
        <SuitShape suit="lotus" />
      </Drawn>
    </g>
  );
}

/** The dots of the lotus backs, `step` apart, as an SVG pattern named `id`. */
function Dots(props: { id: string; step: number }): JSX.Element {
  const { step } = props;
  return (
    <pattern id={props.id} width={step} height={step} patternUnits="userSpaceOnUse">
      <circle cx={step / 4} cy={step / 4} r={step * 0.14} fill={BACK_INK} opacity="0.34" />
      <circle cx={(step * 3) / 4} cy={(step * 3) / 4} r={step * 0.14} fill={BACK_INK} opacity="0.34" />
    </pattern>
  );
}

/** A lily pad: a circle with a notch cut to its middle, the notch pointing at `turn` radians. */
function Pad(props: { x: number; y: number; r: number; turn: number; fill: string; opacity?: number }): JSX.Element {
  const { x, y, r } = props;
  const at = (angle: number) => `${String(x + r * Math.cos(angle))} ${String(y + r * Math.sin(angle))}`;
  return <path d={`M${String(x)} ${String(y)}L${at(props.turn + 0.32)}A${String(r)} ${String(r)} 0 1 1 ${at(props.turn - 0.32)}Z`} fill={props.fill} opacity={props.opacity ?? 1} />;
}

/** A lotus in flower, `size` wide with its top left at (x, y). */
function Bloom(props: { x: number; y: number; size: number }): JSX.Element {
  return (
    <Drawn x={props.x} y={props.y} size={props.size}>
      <g>
        <path d="M2.8 8.2C7.6 8.5 10.7 11.3 11.6 15.9 6.8 15.6 3.7 12.8 2.8 8.2ZM21.2 8.2C16.4 8.5 13.3 11.3 12.4 15.9 17.2 15.6 20.3 12.8 21.2 8.2Z" fill="#ff8fc0" stroke="#a51d57" stroke-width="0.6" />
        <path d="M12 2.8C14.9 6.4 15.4 10.5 12 15.2 8.6 10.5 9.1 6.4 12 2.8Z" fill="#ffc2dc" stroke="#a51d57" stroke-width="0.6" />
        <circle cx="12" cy="14.4" r="1.3" fill="#ffd54f" />
      </g>
    </Drawn>
  );
}

/** Ripples scattered over a width × height stretch of water, the same every time. */
function Ripples(props: { width: number; height: number; count: number; seed: number; size: number }): JSX.Element {
  const rng = new Rng(props.seed);
  return (
    <g fill="none" stroke="#e6fffa" stroke-linecap="round" stroke-width={props.size * 0.09}>
      {Array.from({ length: props.count }, (_, i) => {
        const x = rng.next() * props.width;
        const y = rng.next() * props.height;
        const w = props.size * (0.6 + rng.next() * 0.9);
        return <path key={i} d={`M${String(x)} ${String(y)}q${String(w / 4)} ${String(-w / 9)} ${String(w / 2)} 0t${String(w / 2)} 0`} opacity={0.16 + rng.next() * 0.2} />;
      })}
    </g>
  );
}

/** A canal on a little map: ten stops along a gentle bend, the first ones passed and the boat at the next. */
function Canal(props: { x: number; y: number; width: number; passed: number }): JSX.Element {
  const stops = Array.from({ length: 10 }, (_, i) => [props.x + (i * props.width) / 9, props.y + 12 * Math.sin(i * 0.95)] as const);
  const [first = [0, 0]] = stops;
  let d = `M${String(first[0] - 22)} ${String(first[1])}L${String(first[0])} ${String(first[1])}`;
  for (let i = 1; i < stops.length; i++) {
    const [x0, y0] = stops[i - 1] ?? first;
    const [x1, y1] = stops[i] ?? first;
    d += `Q${String(x0)} ${String(y0)} ${String((x0 + x1) / 2)} ${String((y0 + y1) / 2)}`;
  }
  const [lx, ly] = stops[stops.length - 1] ?? first;
  d += `T${String(lx)} ${String(ly)}L${String(lx + 22)} ${String(ly)}`;
  const [bx, by] = stops[props.passed] ?? first;
  return (
    <g>
      <path d={d} fill="none" stroke="#0a3436" stroke-width="22" stroke-linecap="round" opacity="0.75" />
      <path d={d} fill="none" stroke="#3fb0c9" stroke-width="13" stroke-linecap="round" />
      {stops.map(([x, y], i) => {
        const end = i === stops.length - 1;
        return <circle key={i} cx={x} cy={y} r={end ? 9 : 6} fill={end ? '#ff8fc0' : i < props.passed ? '#f7ac3c' : '#fffaf0'} stroke={end ? '#c2185b' : '#0a3436'} stroke-width="2.5" />;
      })}
      <g transform={`translate(${String(bx - 25)} ${String(by - 47)})`}>
        <Icon name="boat" size={50} />
      </g>
    </g>
  );
}

function IconBackground(): JSX.Element {
  return (
    <g>
      <defs>
        <radialGradient id="icon-water" cx="0.42" cy="0.32" r="0.8">
          <stop offset="0" stop-color="#1f8f88" />
          <stop offset="0.55" stop-color="#127070" />
          <stop offset="1" stop-color="#0a3d3f" />
        </radialGradient>
      </defs>
      <rect width="108" height="108" fill="url(#icon-water)" />
      <Ripples width={108} height={108} count={14} seed={1029} size={9} />
      <Pad x={10} y={96} r={16} turn={-0.9} fill="#2f8a55" opacity={0.7} />
      <Pad x={100} y={14} r={12} turn={2.4} fill="#2f8a55" opacity={0.6} />
    </g>
  );
}

/** Two cards fanned, a lotus back behind the ace of lotuses, inside the 66 wide circle every launcher shows. */
function IconForeground(): JSX.Element {
  const w = 33;
  const at = (turn: number) => `rotate(${String(turn)} 54 78) translate(${String(54 - w / 2)} ${String(78 - w * 1.4)})`;
  return (
    <g>
      <defs>
        <Paper prefix="icon" />
        <filter id="icon-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" flood-color="#00201e" flood-opacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#icon-shadow)">
        <g transform={at(-14)}>
          <CardBack w={w} />
        </g>
        <g transform={at(11)}>
          <CardFace rank={0} suit="lotus" w={w} prefix="icon" />
        </g>
      </g>
    </g>
  );
}

/** A run of cards, each one rank higher than the last, fanned like a hand. */
const RUN: readonly (readonly [number, Suit])[] = [
  [4, 'fish'],
  [5, 'mango'],
  [6, 'lotus'],
  [7, 'leaf'],
  [8, 'fish'],
];

function FeatureGraphic(props: { locale: Locale }): JSX.Element {
  const text = translator(props.locale);
  const w = 108;
  // The fan turns around a point below the cards, as a hand of cards does.
  const pivot = [830, 610] as const;
  return (
    <g>
      <defs>
        <linearGradient id="fg-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0f5d60" />
          <stop offset="0.5" stop-color="#137270" />
          <stop offset="1" stop-color="#0d5557" />
        </linearGradient>
        <radialGradient id="fg-sun" cx="0.82" cy="0" r="0.75">
          <stop offset="0" stop-color="#ffd58a" stop-opacity="0.42" />
          <stop offset="1" stop-color="#ffd58a" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="fg-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#062628" stop-opacity="0.5" />
          <stop offset="0.6" stop-color="#062628" stop-opacity="0" />
        </linearGradient>
        <Paper prefix="fg" />
        <Dots id="fg-dots" step={14} />
        <filter id="fg-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#00201e" flood-opacity="0.5" />
        </filter>
      </defs>
      <rect width="1024" height="500" fill="url(#fg-water)" />
      <rect width="1024" height="500" fill="url(#fg-sun)" />
      <Ripples width={1024} height={500} count={70} seed={20261029} size={34} />
      <Pad x={36} y={470} r={96} turn={-0.8} fill="#2f8a55" opacity={0.62} />
      <Pad x={1004} y={36} r={74} turn={2.5} fill="#2f8a55" opacity={0.55} />
      <Pad x={560} y={492} r={46} turn={-2} fill="#2f8a55" opacity={0.5} />
      <Bloom x={62} y={352} size={92} />
      <rect width="1024" height="500" fill="url(#fg-shade)" />
      <g filter="url(#fg-shadow)">
        <g transform={`rotate(-26 ${String(pivot[0])} ${String(pivot[1])}) translate(${String(pivot[0] - w / 2)} 140)`}>
          <CardBack w={w} dots="fg-dots" />
        </g>
        {RUN.map(([rank, suit], i) => {
          const turn = (i - (RUN.length - 1) / 2) * 7;
          return (
            <g key={i} transform={`rotate(${String(turn)} ${String(pivot[0])} ${String(pivot[1])}) translate(${String(pivot[0] - w / 2)} 130)`}>
              <CardFace rank={rank} suit={suit} w={w} prefix="fg" />
            </g>
          );
        })}
      </g>
      <g paint-order="stroke" stroke-linejoin="round">
        <text x="56" y="190" font-family="Pattaya, sans-serif" font-size="104" fill="#ffe3b0" stroke="#3a1d0a" stroke-width="12">
          {text.t('app.title')}
        </text>
        <text x="62" y="244" font-family="Kanit, sans-serif" font-size="26" font-weight="500" fill="#f3fffb" stroke="#062628" stroke-width="8">
          {text.t('app.tagline')}
        </text>
      </g>
      <Canal x={92} y={346} width={420} passed={3} />
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
