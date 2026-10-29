import type { Element, Rarity } from '../sim/content.js';

export interface Tones {
  base: string;
  light: string;
  dark: string;
  ink: string;
}

export function tones(hue: number, saturation = 72): Tones {
  return {
    base: `hsl(${hue} ${saturation}% 56%)`,
    light: `hsl(${hue} ${Math.min(100, saturation + 12)}% 78%)`,
    dark: `hsl(${hue} ${saturation - 8}% 36%)`,
    ink: `hsl(${hue} 55% 18%)`,
  };
}

export const ELEMENT_COLORS: Record<Element, { main: string; glow: string; hue: number }> = {
  ember: { main: '#ff7a45', glow: '#ffc06b', hue: 18 },
  tide: { main: '#3fb6ff', glow: '#9fe2ff', hue: 200 },
  grove: { main: '#62cf63', glow: '#c2f59a', hue: 112 },
  volt: { main: '#f7c948', glow: '#fff2a1', hue: 48 },
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#c9b8a6',
  rare: '#55b8ff',
  epic: '#c07bff',
  legendary: '#ffc23d',
};
