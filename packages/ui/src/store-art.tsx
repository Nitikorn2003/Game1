import { render, type JSX } from 'preact';
import { useId } from 'preact/hooks';

/**
 * A game's launcher icon and Play Store graphics, drawn with the game's own SVG art.
 * `tools/store-assets.ts` opens the game's `store/art.html` once for every file it writes;
 * the games themselves never load this module.
 */
export interface StoreArt {
  /** The icon's back layer: a 108 × 108 square, filled to the edges. */
  iconBackground: () => JSX.Element;
  /**
   * The icon's front layer: 108 × 108 on a transparent background. Launchers cut icons to
   * different shapes and move the layers a little, so everything that matters stays inside
   * the circle of diameter 66 around the middle.
   */
  iconForeground: () => JSX.Element;
  /** The Play Store feature graphic, 1024 × 500, with no transparency, for one listing language. */
  featureGraphic: (locale: string) => JSX.Element;
}

const FULL = { width: '100%', height: '100%', style: { display: 'block' } } as const;

/**
 * The themed icon of Android 13 and later: one colour, which the launcher picks. Light parts
 * of the front layer stay and dark lines (outlines, pupils, mouths) become gaps, so the
 * drawing stays readable as a silhouette.
 */
function Monochrome(props: { art: StoreArt }): JSX.Element {
  const id = `mono-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg viewBox="0 0 108 108" {...FULL}>
      <defs>
        <filter id={id} x="0" y="0" width="108" height="108" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feColorMatrix type="luminanceToAlpha" in="SourceGraphic" result="light" />
          <feComponentTransfer in="light" result="mask">
            <feFuncA type="linear" slope="10" intercept="-2.5" />
          </feComponentTransfer>
          <feComposite in="mask" in2="SourceAlpha" operator="in" result="shape" />
          <feFlood flood-color="#fff" />
          <feComposite in2="shape" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${id})`}>{props.art.iconForeground()}</g>
    </svg>
  );
}

/**
 * Icons for launchers older than Android 8, which cannot combine layers: both layers, cut to a
 * rounded square or a circle 44 wide on a 48 grid, showing the part a modern launcher shows.
 */
function Legacy(props: { art: StoreArt; round: boolean }): JSX.Element {
  const id = `shape-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg viewBox="0 0 48 48" {...FULL}>
      <defs>
        <clipPath id={id}>{props.round ? <circle cx="24" cy="24" r="22" /> : <rect x="2" y="2" width="44" height="44" rx="8" />}</clipPath>
      </defs>
      <g clip-path={`url(#${id})`}>
        <g transform="translate(-9 -9) scale(0.6111)">
          {props.art.iconBackground()}
          {props.art.iconForeground()}
        </g>
      </g>
    </svg>
  );
}

function Asset(props: { art: StoreArt; name: string; locale: string; guides: boolean }): JSX.Element | null {
  const { art } = props;
  switch (props.name) {
    case 'icon-background':
      return (
        <svg viewBox="0 0 108 108" preserveAspectRatio="none" {...FULL}>
          {art.iconBackground()}
        </svg>
      );
    case 'icon-foreground':
      return (
        <svg viewBox="0 0 108 108" {...FULL}>
          {art.iconForeground()}
          {props.guides && (
            <g fill="none" stroke="#f0f" stroke-width="0.5">
              <rect x="18" y="18" width="72" height="72" />
              <circle cx="54" cy="54" r="33" />
            </g>
          )}
        </svg>
      );
    case 'icon-monochrome':
      return <Monochrome art={art} />;
    case 'icon-legacy':
      return <Legacy art={art} round={false} />;
    case 'icon-round':
      return <Legacy art={art} round />;
    case 'icon-play':
      // Google Play rounds the corners itself and wants the square filled.
      return (
        <svg viewBox="14 14 80 80" {...FULL}>
          {art.iconBackground()}
          {art.iconForeground()}
        </svg>
      );
    case 'feature-graphic':
      return (
        <svg viewBox="0 0 1024 500" preserveAspectRatio="none" {...FULL}>
          {art.featureGraphic(props.locale)}
        </svg>
      );
    default:
      return null;
  }
}

/** Every asset the board draws, with the size it is previewed at. */
const PREVIEW = [
  ['icon-background', 216, 216],
  ['icon-foreground', 216, 216],
  ['icon-monochrome', 216, 216],
  ['icon-legacy', 144, 144],
  ['icon-round', 144, 144],
  ['icon-play', 256, 256],
  ['feature-graphic', 512, 250],
] as const;

/**
 * Draws `?asset=<name>` filling the window, or every asset side by side when there is no
 * `asset` (open `store/art.html` in the game's dev server). `&lang=th` picks the listing
 * language and `&guides` marks the icon's safe circle. Sets `data-ready` on the body once
 * fonts have loaded, or `data-error` for an asset it does not know.
 */
export function renderStoreArt(root: HTMLElement, art: StoreArt): void {
  const query = new URLSearchParams(location.search);
  const name = query.get('asset');
  const locale = query.get('lang') ?? 'en';
  const guides = query.has('guides');
  if (name) {
    if (!PREVIEW.some(([asset]) => asset === name)) {
      document.body.dataset.error = `unknown asset ${name}`;
      return;
    }
    root.style.cssText = 'width:100vw;height:100vh';
    render(<Asset art={art} name={name} locale={locale} guides={guides} />, root);
  } else {
    render(
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '16px', background: '#3a3a3a', minHeight: '100vh', alignContent: 'flex-start' }}>
        {PREVIEW.map(([asset, width, height]) => (
          <figure key={asset} style={{ margin: 0, color: '#ddd', font: '13px sans-serif' }}>
            <div style={{ width, height, background: 'repeating-conic-gradient(#555 0 25%, #4a4a4a 0 50%) 0 0 / 16px 16px' }}>
              <Asset art={art} name={asset} locale={locale} guides={guides} />
            </div>
            <figcaption>{asset}</figcaption>
          </figure>
        ))}
      </div>,
      root,
    );
  }
  void document.fonts.ready.then(() => {
    document.body.dataset.ready = 'true';
  });
}
