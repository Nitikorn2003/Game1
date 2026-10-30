/**
 * The shapes a patch can have. Patches are never turned: each way round is its own shape, as
 * the player sees it in the tray. Drawn as rows from the top, `#` for a square.
 */
const DRAWINGS = {
  dot: '#',
  duo_h: '##',
  duo_v: '#/#',
  tri_h: '###',
  tri_v: '#/#/#',
  corner_a: '##/#.',
  corner_b: '##/.#',
  corner_c: '#./##',
  corner_d: '.#/##',
  quad_h: '####',
  quad_v: '#/#/#/#',
  square: '##/##',
  ell_a: '#./#./##',
  ell_b: '.#/.#/##',
  ell_c: '##/#./#.',
  ell_d: '##/.#/.#',
  ell_e: '###/#..',
  ell_f: '###/..#',
  ell_g: '#../###',
  ell_h: '..#/###',
  tee_a: '###/.#.',
  tee_b: '.#./###',
  tee_c: '#./##/#.',
  tee_d: '.#/##/.#',
  zig_a: '.##/##.',
  zig_b: '##./.##',
  zig_c: '#./##/.#',
  zig_d: '.#/##/#.',
  long_h: '#####',
  long_v: '#/#/#/#/#',
  bend_a: '###/#../#..',
  bend_b: '###/..#/..#',
  bend_c: '#../#../###',
  bend_d: '..#/..#/###',
  slab_h: '###/###',
  slab_v: '##/##/##',
  block: '###/###/###',
} as const;

export type ShapeId = keyof typeof DRAWINGS;

export interface Shape {
  id: ShapeId;
  /** The squares, as [column, row] from the top left. */
  cells: readonly (readonly [number, number])[];
  width: number;
  height: number;
}

function parse(id: ShapeId): Shape {
  const rows = DRAWINGS[id].split('/');
  const cells: [number, number][] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') cells.push([x, y]);
  });
  return { id, cells, width: Math.max(...rows.map((row) => row.length)), height: rows.length };
}

export const SHAPE_IDS = Object.keys(DRAWINGS) as ShapeId[];
export const SHAPES: Readonly<Record<ShapeId, Shape>> = Object.fromEntries(SHAPE_IDS.map((id) => [id, parse(id)])) as Record<ShapeId, Shape>;

/**
 * How often each family turns up, shared among its shapes. Small patches are common enough to
 * fill gaps, big ones rare enough that a board can be kept open.
 */
const FAMILY_WEIGHTS: readonly (readonly [string, number])[] = [
  ['dot', 4],
  ['duo', 6],
  ['tri', 6],
  ['corner', 8],
  ['quad', 6],
  ['square', 6],
  ['ell', 8],
  ['tee', 4],
  ['zig', 4],
  ['long', 4],
  ['bend', 4],
  ['slab', 4],
  ['block', 3],
];

const familyOf = (id: ShapeId) => id.split('_')[0] ?? id;

/** Every shape with its chance weight. */
export const SHAPE_WEIGHTS: readonly (readonly [ShapeId, number])[] = SHAPE_IDS.map((id) => {
  const family = familyOf(id);
  const weight = FAMILY_WEIGHTS.find(([name]) => name === family)?.[1] ?? 0;
  return [id, weight / SHAPE_IDS.filter((other) => familyOf(other) === family).length] as const;
});

export function isShapeId(value: unknown): value is ShapeId {
  return typeof value === 'string' && Object.hasOwn(DRAWINGS, value);
}
