/**
 * The rice varieties a field is planted with. Field art like this is real: farmers plant rice
 * of different colours so that a picture shows when the field is seen from above. Each
 * picture is drawn in these inks; every letter is one of them.
 */
export const INKS = {
  k: '#2f2631',
  p: '#7b4ea0',
  r: '#d24c3f',
  o: '#ef8f35',
  y: '#f4cf4d',
  w: '#f7f2e6',
  g: '#2e7b3c',
  l: '#b9df6c',
  b: '#4c8ed4',
  c: '#a6d8f0',
  n: '#8c5a33',
  i: '#f29bbb',
  s: '#9ba3a8',
  t: '#dcb67f',
} as const;

export type Ink = keyof typeof INKS;

export function isInk(letter: string): letter is Ink {
  return Object.prototype.hasOwnProperty.call(INKS, letter);
}

/** The plain green rice around a picture. */
export const FIELD_GREEN = '#79b85a';
