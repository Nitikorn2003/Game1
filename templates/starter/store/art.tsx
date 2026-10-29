import { renderStoreArt } from '@game1/ui/store-art';
import type { JSX } from 'preact';
import '../src/fonts.css';
import { LOCALES, translator, type Locale } from '../src/i18n/index.js';

/** A gold coin of radius `r` around (x, y), the same coin the game's tap button shows. */
function Coin(props: { x: number; y: number; r: number }): JSX.Element {
  const { x, y, r } = props;
  return (
    <g>
      <circle cx={x} cy={y + r * 0.08} r={r} fill="#8a5a00" />
      <circle cx={x} cy={y} r={r} fill="#f5b83d" stroke="#8a5a00" stroke-width={r * 0.08} />
      <circle cx={x} cy={y} r={r * 0.66} fill="none" stroke="#fff1c2" stroke-width={r * 0.08} opacity="0.8" />
      <path d={`M${x - r * 0.5} ${y - r * 0.35}A${r * 0.62} ${r * 0.62} 0 0 1 ${x + r * 0.1} ${y - r * 0.6}`} fill="none" stroke="#fff" stroke-width={r * 0.1} stroke-linecap="round" opacity="0.7" />
    </g>
  );
}

function IconBackground(): JSX.Element {
  return (
    <g>
      <defs>
        <radialGradient id="icon-glow" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stop-color="#5fe3d1" />
          <stop offset="0.6" stop-color="#1f8f86" />
          <stop offset="1" stop-color="#0b3a3f" />
        </radialGradient>
      </defs>
      <rect width="108" height="108" fill="url(#icon-glow)" />
    </g>
  );
}

/** Inside the 66 wide circle every launcher shows. */
function IconForeground(): JSX.Element {
  return <Coin x={54} y={53} r={26} />;
}

function FeatureGraphic(props: { locale: Locale }): JSX.Element {
  const text = translator(props.locale);
  return (
    <g>
      <defs>
        <linearGradient id="fg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#14424a" />
          <stop offset="1" stop-color="#08121a" />
        </linearGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#fg-sky)" />
      <Coin x={780} y={250} r={150} />
      <Coin x={940} y={420} r={60} />
      <Coin x={610} y={430} r={40} />
      <g font-family="Mitr, sans-serif" paint-order="stroke" stroke-linejoin="round">
        <text x="60" y="230" font-size="104" font-weight="600" fill="#ffe08a" stroke="#3b2a00" stroke-width="12">
          {text.t('app.title')}
        </text>
        <text x="66" y="296" font-size="40" font-weight="500" fill="#eef7fb" stroke="#08121a" stroke-width="8">
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
