import type { JSX } from 'preact';
import type { Scene } from '../sim/content.js';

/** One terrace: where its top edge runs, and the rows of rice along it. */
interface Terrace {
  y: number;
  /** How the edge bends, up and down along the hill. */
  bend: readonly [number, number, number];
}

const TERRACES: readonly Terrace[] = [
  { y: 62, bend: [-5, 4, -2] },
  { y: 84, bend: [4, -5, 3] },
  { y: 108, bend: [-4, 3, -4] },
  { y: 134, bend: [5, -3, 2] },
  { y: 162, bend: [-3, 5, -3] },
];

/** The edge of a terrace across the screen, `dy` lower. */
function edge(t: Terrace, dy = 0): string {
  const y = t.y + dy;
  const [a, b, c] = t.bend;
  return `M-2 ${String(y)}C20 ${String(y + a)} 38 ${String(y + b)} 56 ${String(y + b / 2)}S88 ${String(y + c)} 102 ${String(y + c / 2)}`;
}

/** The hills behind everything: terraces of rice stepping down, in the scene the player chose. */
export function SceneBackdrop(props: { scene: Scene }): JSX.Element {
  const { scene } = props;
  return (
    <div class={`backdrop backdrop--${scene}`} aria-hidden="true">
      <Hills view="0 0 100 200" />
      <Weather scene={scene} />
    </div>
  );
}

/** The mist or the snow of a scene, over its hills. */
function Weather(props: { scene: Scene }): JSX.Element | null {
  if (props.scene === 'misty')
    return (
      <div class="mist">
        <span />
        <span />
        <span />
      </div>
    );
  if (props.scene === 'snowy') return <div class="snow" />;
  return null;
}

/** The hills on their own, seen through `view`, for the backdrop and for the looks. */
function Hills(props: { view: string }): JSX.Element {
  return (
    // Cropped to the space, so the hills keep their shape.
    <svg class="hills" viewBox={props.view} preserveAspectRatio="xMidYMid slice">
      <circle class="hills__sun" cx="76" cy="26" r="9" />
      <path class="hills__far" d="M-2 70C12 50 22 46 34 54S56 38 70 46 92 52 102 44V200H-2Z" />
      {TERRACES.map((t, i) => (
        <g key={i} class={`terrace terrace--${String(i)}`}>
          <path class="terrace__land" d={`${edge(t)}V200H-2Z`} />
          <path class="terrace__edge" d={edge(t)} />
          <path class="terrace__row" d={edge(t, 5)} />
          <path class="terrace__row" d={edge(t, 10)} />
          <path class="terrace__row" d={edge(t, 15)} />
        </g>
      ))}
    </svg>
  );
}

/** A small patch of a scene, for choosing one. */
export function SceneSwatch(props: { scene: Scene }): JSX.Element {
  return (
    <span class={`look__preview swatch backdrop--${props.scene}`} aria-hidden="true">
      {/* The sky, the far hills and the first terraces. */}
      <Hills view="0 14 100 100" />
      <Weather scene={props.scene} />
    </span>
  );
}
