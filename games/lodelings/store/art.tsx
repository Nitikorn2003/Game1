import { Rng } from '@game1/engine';
import { renderStoreArt } from '@game1/ui/store-art';
import type { JSX } from 'preact';
import { LodelingArt } from '../src/art/LodelingArt.js';
import { RockArt } from '../src/art/RockArt.js';
import '../src/fonts.css';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';

/** A pick drawn handle-down around (0, 0), about 72 tall before scaling. */
function Pickaxe(props: { x: number; y: number; scale: number; turn: number }): JSX.Element {
  return (
    <g transform={`translate(${props.x} ${props.y}) rotate(${props.turn}) scale(${props.scale})`} stroke-linejoin="round" stroke-linecap="round">
      <path d="M0 -26V48" stroke="#3a2412" stroke-width="11" />
      <path d="M0 -26V48" stroke="#a8703a" stroke-width="7" />
      <path d="M-2 -20V40" stroke="#d39a5c" stroke-width="2" />
      <path d="M-36 -14Q0 -52 36 -14Q0 -30 -36 -14Z" fill="#d7e0ea" stroke="#2f3a46" stroke-width="3" />
      <path d="M-24 -24Q0 -40 24 -24" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.8" />
      <rect x="-7" y="-36" width="14" height="16" rx="3" fill="#7d8894" stroke="#2f3a46" stroke-width="3" />
    </g>
  );
}

/** A six-sided crystal standing on (0, 0)'s middle, 40 tall before scaling. */
function Crystal(props: { x: number; y: number; scale: number; turn: number; hue: number }): JSX.Element {
  return (
    <g transform={`translate(${props.x} ${props.y}) rotate(${props.turn}) scale(${props.scale})`}>
      <path d="M0 -20L7 -13V13L0 20L-7 13V-13Z" fill={`hsl(${props.hue} 85% 62%)`} stroke={`hsl(${props.hue} 70% 38%)`} stroke-width="1.4" stroke-linejoin="round" />
      <path d="M0 -20L7 -13V13L0 20Z" fill={`hsl(${props.hue} 70% 38%)`} opacity="0.35" />
      <path d="M-4 -12L-1 -15V10L-4 12Z" fill={`hsl(${props.hue} 100% 86%)`} opacity="0.8" />
    </g>
  );
}

/** The mascot: a Mossling with its pick, in the icon's 108 × 108 square. */
function Mascot(): JSX.Element {
  return (
    <g>
      <Pickaxe x={58} y={50} scale={0.62} turn={38} />
      <svg x="22" y="23" width="62" height="62" viewBox="0 0 100 100">
        <LodelingArt species="mossling" size={100} />
      </svg>
    </g>
  );
}

function IconBackground(): JSX.Element {
  return (
    <g>
      <defs>
        <radialGradient id="icon-glow" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stop-color="#ffd36e" />
          <stop offset="0.55" stop-color="#ff9440" />
          <stop offset="1" stop-color="#8a2f1c" />
        </radialGradient>
      </defs>
      <rect width="108" height="108" fill="url(#icon-glow)" />
      <Crystal x={22} y={86} scale={0.9} turn={-18} hue={195} />
      <Crystal x={32} y={92} scale={0.6} turn={12} hue={195} />
      <Crystal x={88} y={24} scale={0.7} turn={24} hue={195} />
      <Crystal x={82} y={88} scale={0.55} turn={-30} hue={195} />
      <circle cx="24" cy="26" r="1.6" fill="#fff" opacity="0.7" />
      <circle cx="90" cy="60" r="1.2" fill="#fff" opacity="0.6" />
      <circle cx="16" cy="58" r="1" fill="#fff" opacity="0.6" />
    </g>
  );
}

function Sparkles(props: { count: number; seed: number }): JSX.Element {
  const rng = new Rng(props.seed);
  return (
    <g fill="#fff6d8">
      {Array.from({ length: props.count }, (_, i) => (
        <circle key={i} cx={rng.next() * 1024} cy={rng.next() * 420} r={0.8 + rng.next() * 2.2} opacity={0.25 + rng.next() * 0.55} />
      ))}
    </g>
  );
}

function FeatureGraphic(props: { locale: Locale }): JSX.Element {
  const text = translator(props.locale);
  return (
    <g>
      <defs>
        <linearGradient id="fg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2e1b12" />
          <stop offset="1" stop-color="#0f0907" />
        </linearGradient>
        <radialGradient id="fg-glow" cx="0.7" cy="0.52" r="0.45">
          <stop offset="0" stop-color="#ffb347" stop-opacity="0.55" />
          <stop offset="1" stop-color="#ffb347" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="fg-title" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff3c4" />
          <stop offset="0.5" stop-color="#ffc35c" />
          <stop offset="1" stop-color="#f08a2a" />
        </linearGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#fg-sky)" />
      <rect width="1024" height="500" fill="url(#fg-glow)" />
      <path d="M0 0H1024V30L990 44L962 26L930 70L900 30L860 52L820 24L780 40L744 22L700 58L660 26L610 44L560 20L520 48L470 24L420 40L380 18L330 54L290 26L240 42L200 20L150 50L110 28L60 46L0 30Z" fill="#140c08" />
      <Sparkles count={70} seed={5} />
      <path d="M0 430Q256 400 512 418T1024 410V500H0Z" fill="#1c120d" />
      <Crystal x={70} y={440} scale={2.4} turn={-16} hue={195} />
      <Crystal x={112} y={456} scale={1.6} turn={14} hue={195} />
      <Crystal x={980} y={430} scale={2} turn={18} hue={280} />
      <Crystal x={944} y={458} scale={1.3} turn={-10} hue={280} />
      <svg x="590" y="84" width="380" height="380" viewBox="0 0 200 200">
        <RockArt seed={11} rockHue={28} veinHue={45} health={1} />
      </svg>
      <svg x="728" y="50" width="124" height="124" viewBox="0 0 100 100">
        <LodelingArt species="fizzbit" size={100} />
      </svg>
      <svg x="864" y="292" width="150" height="150" viewBox="0 0 100 100">
        <LodelingArt species="drizzlet" size={100} />
      </svg>
      <svg x="300" y="336" width="120" height="120" viewBox="0 0 100 100">
        <LodelingArt species="emberkit" size={100} />
      </svg>
      <svg x="186" y="350" width="104" height="104" viewBox="0 0 100 100">
        <LodelingArt species="coralynx" size={100} />
      </svg>
      <svg x="440" y="150" width="320" height="320" viewBox="0 0 108 108">
        <Mascot />
      </svg>
      <g font-family="Mitr, sans-serif" paint-order="stroke" stroke-linejoin="round">
        <text x="60" y="196" font-size="112" font-weight="600" fill="url(#fg-title)" stroke="#3b2200" stroke-width="12">
          {text.t('app.title')}
        </text>
        <text x="66" y="262" font-size="42" font-weight="500" fill="#fff4e6" stroke="#1a0f0a" stroke-width="8">
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
    iconForeground: () => <Mascot />,
    featureGraphic: (locale) => <FeatureGraphic locale={LOCALES.find((l) => l === locale) ?? 'en'} />,
  });
}
