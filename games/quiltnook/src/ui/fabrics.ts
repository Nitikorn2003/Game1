import type { FabricSetId } from '../sim/content.js';

export type PatternKind = 'dots' | 'stripes' | 'gingham' | 'flowers' | 'zigzag' | 'hearts' | 'stars' | 'leaves';

export interface FabricLook {
  base: string;
  accent: string;
  pattern: PatternKind;
}

type Four = readonly [FabricLook, FabricLook, FabricLook, FabricLook];

const f = (base: string, accent: string, pattern: PatternKind): FabricLook => ({ base, accent, pattern });

/**
 * The four fabrics of each set. Within a set every fabric has its own colour and its own
 * pattern, so that matching fabrics can be told apart without seeing colour.
 */
export const FABRIC_LOOKS: Readonly<Record<FabricSetId, Four>> = {
  cottage: [f('#d65a4a', '#fbe3d4', 'dots'), f('#e3ac3c', '#fff1c9', 'gingham'), f('#86ad82', '#e6f2df', 'stripes'), f('#6a8fd2', '#fdf6e4', 'flowers')],
  meadow: [f('#5c9f57', '#fff4cc', 'flowers'), f('#efc63f', '#fffbe6', 'dots'), f('#7ccbb7', '#e8faf4', 'gingham'), f('#e07fa6', '#fde6ef', 'stripes')],
  indigo: [f('#3e4b98', '#c9d2ff', 'zigzag'), f('#86bde5', '#f0f8ff', 'dots'), f('#5a7eae', '#dbe7f6', 'stripes'), f('#25345e', '#f2e2a8', 'stars')],
  sunset: [f('#ee7a64', '#ffe3d9', 'gingham'), f('#f4ab5c', '#fff0dc', 'stripes'), f('#de5f8b', '#ffe0eb', 'dots'), f('#86569b', '#ecd9f4', 'zigzag')],
  candy: [f('#f291c0', '#fff1f8', 'dots'), f('#ab92e2', '#f4eeff', 'stripes'), f('#ecd463', '#fffbe0', 'gingham'), f('#6ccfa4', '#eefff7', 'hearts')],
  woodland: [f('#6a8a3a', '#dfe9c3', 'leaves'), f('#8c5f3d', '#ead6c2', 'stripes'), f('#3c7b5a', '#cfe8da', 'dots'), f('#a8344b', '#f5d5db', 'gingham')],
};

/** One 20 × 20 tile of a pattern, as SVG shapes in the accent colour. */
export function tileShapes(look: FabricLook): string {
  const a = look.accent;
  switch (look.pattern) {
    case 'dots':
      return `<circle cx="5" cy="5" r="2.4" fill="${a}"/><circle cx="15" cy="15" r="2.4" fill="${a}"/>`;
    case 'stripes':
      return `<path d="M-5 5L5-5M-5 25L25-5M15 25L25 15" stroke="${a}" stroke-width="3.4"/>`;
    case 'gingham':
      return `<rect width="10" height="20" fill="${a}" opacity="0.42"/><rect width="20" height="10" fill="${a}" opacity="0.42"/>`;
    case 'flowers':
      return `<g fill="${a}"><circle cx="10" cy="6.6" r="2.6"/><circle cx="13.4" cy="10" r="2.6"/><circle cx="10" cy="13.4" r="2.6"/><circle cx="6.6" cy="10" r="2.6"/></g><circle cx="10" cy="10" r="1.8" fill="#f3c33f"/><circle cx="0" cy="0" r="1.2" fill="${a}"/><circle cx="20" cy="20" r="1.2" fill="${a}"/>`;
    case 'zigzag':
      return `<path d="M0 7l5-4 5 4 5-4 5 4M0 17l5-4 5 4 5-4 5 4" fill="none" stroke="${a}" stroke-width="2.2"/>`;
    case 'hearts':
      return `<path d="M10 15.5C4.2 11.6 4.6 6.4 7.4 6c1.4-.2 2.3.7 2.6 1.6.3-.9 1.2-1.8 2.6-1.6 2.8.4 3.2 5.6-2.6 9.5Z" fill="${a}"/>`;
    case 'stars':
      return `<path d="m10 4.5 1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5L10 4.5Z" fill="${a}"/><circle cx="2" cy="17" r="1" fill="${a}"/><circle cx="17" cy="2" r="0.8" fill="${a}"/>`;
    case 'leaves':
      return `<ellipse cx="10" cy="10" rx="2.4" ry="5.2" transform="rotate(40 10 10)" fill="${a}"/><path d="M6.5 13.5l7-7" stroke="${look.base}" stroke-width="0.8"/>`;
  }
}

const images = new Map<string, string>();

/** The pattern as a CSS background image, made once per fabric. */
export function fabricImage(look: FabricLook): string {
  const key = `${look.base}${look.accent}${look.pattern}`;
  let image = images.get(key);
  if (!image) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">${tileShapes(look)}</svg>`;
    image = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    images.set(key, image);
  }
  return image;
}

/** The inline style of a square sewn in this fabric. */
export function fabricStyle(look: FabricLook): { backgroundColor: string; backgroundImage: string } {
  return { backgroundColor: look.base, backgroundImage: fabricImage(look) };
}

export function lookOf(set: FabricSetId, fabric: number): FabricLook {
  return FABRIC_LOOKS[set][fabric] ?? FABRIC_LOOKS[set][0];
}
