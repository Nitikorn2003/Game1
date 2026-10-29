import { Rng } from '@game1/engine';
import type { JSX } from 'preact';
import { useId, useMemo } from 'preact/hooks';

interface RockShape {
  outline: string;
  veins: { d: string; r: number; x: number; y: number }[];
  cracks: string[];
}

function smoothClosed(points: [number, number][]): string {
  const n = points.length;
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const first = mid(points[n - 1] as [number, number], points[0] as [number, number]);
  let d = `M${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p = points[i] as [number, number];
    const m = mid(p, points[(i + 1) % n] as [number, number]);
    d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

/** A rock outline, ore veins and crack lines, always the same for the same seed. */
export function rockShape(seed: number): RockShape {
  const rng = new Rng(seed);
  const count = 9 + rng.int(4);
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng.next() * 0.3;
    const radius = 70 + rng.next() * 16;
    points.push([100 + Math.cos(angle) * radius, 104 + Math.sin(angle) * radius * 0.88]);
  }
  const veins = Array.from({ length: 5 + rng.int(4) }, () => {
    const a = rng.next() * Math.PI * 2;
    const dist = rng.next() * 48;
    const x = 100 + Math.cos(a) * dist;
    const y = 104 + Math.sin(a) * dist * 0.85;
    const r = 6 + rng.next() * 8;
    const sides = 5 + rng.int(2);
    const vein: [number, number][] = [];
    for (let i = 0; i < sides; i++) {
      const va = (i / sides) * Math.PI * 2 + rng.next() * 0.5;
      const vr = r * (0.7 + rng.next() * 0.5);
      vein.push([x + Math.cos(va) * vr, y + Math.sin(va) * vr]);
    }
    return { d: `M${vein.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join('L')}Z`, r, x, y };
  });
  const cracks = Array.from({ length: 5 }, (_, i) => {
    let x = 100 + (rng.next() - 0.5) * 30;
    let y = 100 + (rng.next() - 0.5) * 30;
    const a = (i / 5) * Math.PI * 2 + rng.next();
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    for (let s = 0; s < 4; s++) {
      x += Math.cos(a + (rng.next() - 0.5) * 1.2) * 16;
      y += Math.sin(a + (rng.next() - 0.5) * 1.2) * 16;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  });
  return { outline: smoothClosed(points), veins, cracks };
}

export interface RockArtProps {
  seed: number;
  rockHue: number;
  veinHue: number;
  /** Share of HP left, 0..1; cracks appear as it drops. */
  health: number;
  size?: number;
}

export function RockArt(props: RockArtProps): JSX.Element {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const shape = useMemo(() => rockShape(props.seed), [props.seed]);
  const crackCount = props.health > 0.8 ? 0 : props.health > 0.6 ? 1 : props.health > 0.4 ? 2 : props.health > 0.2 ? 4 : 5;
  const fill = `rf-${uid}`;
  const vein = `rv-${uid}`;
  const clip = `rc-${uid}`;
  return (
    <svg viewBox="0 0 200 200" width={props.size ?? 200} height={props.size ?? 200} class="rock" aria-hidden="true">
      <defs>
        <radialGradient id={fill} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stop-color={`hsl(${props.rockHue} 22% 58%)`} />
          <stop offset="0.6" stop-color={`hsl(${props.rockHue} 20% 38%)`} />
          <stop offset="1" stop-color={`hsl(${props.rockHue} 24% 20%)`} />
        </radialGradient>
        <linearGradient id={vein} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color={`hsl(${props.veinHue} 100% 82%)`} />
          <stop offset="1" stop-color={`hsl(${props.veinHue} 85% 52%)`} />
        </linearGradient>
        <clipPath id={clip}>
          <path d={shape.outline} />
        </clipPath>
      </defs>
      <ellipse cx="100" cy="186" rx="70" ry="10" fill="#000" opacity="0.35" />
      <path d={shape.outline} fill={`url(#${fill})`} stroke={`hsl(${props.rockHue} 30% 12%)`} stroke-width="4" />
      <g clip-path={`url(#${clip})`}>
        <path d="M20 20L120 18L80 90L18 120Z" fill="#fff" opacity="0.08" />
        {shape.veins.map((v, i) => (
          <g key={i}>
            <path d={v.d} fill={`url(#${vein})`} stroke={`hsl(${props.veinHue} 70% 28%)`} stroke-width="1.6" />
            <circle cx={v.x - v.r * 0.25} cy={v.y - v.r * 0.3} r={v.r * 0.22} fill="#fff" opacity="0.75" />
          </g>
        ))}
        {shape.cracks.slice(0, crackCount).map((d, i) => (
          <path key={i} d={d} fill="none" stroke={`hsl(${props.rockHue} 35% 10%)`} stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        ))}
      </g>
    </svg>
  );
}
