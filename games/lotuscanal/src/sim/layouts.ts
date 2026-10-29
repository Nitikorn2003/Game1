/**
 * The shapes cards are dealt in. In the drawings below each `o` is a card; one character is
 * half a card's width and one line half a card's height, so a card overlaps the cards next to
 * it on the lines above and below. Lower lines lie on top: a card is face up, and can be
 * played, once no card lies on it.
 */

export const LAYOUT_IDS = ['peaks2', 'pyramid', 'boat', 'peaks3', 'stacks', 'bridge', 'waves', 'valley', 'lotus', 'market', 'peaks4', 'summit'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

const ART: Readonly<Record<LayoutId, readonly string[]>> = {
  peaks2: [
    '   o       o',
    '  o o     o o',
    ' o o o   o o o',
    'o o o o o o o o',
  ],
  pyramid: [
    '     o',
    '    o o',
    '   o o o',
    '  o o o o',
    ' o o o o o',
    'o o o o o o',
  ],
  boat: [
    '       o',
    '       o',
    'o o o o o o o o',
    ' o o o o o o o',
    '  o o o o o o',
  ],
  peaks3: [
    '   o     o     o',
    '  o o   o o   o o',
    ' o o o o o o o o o',
    'o o o o o o o o o o',
  ],
  stacks: [
    'o   o   o   o',
    'o   o   o   o',
    'o   o   o   o',
    'o   o   o   o',
    ' o o o o o o',
  ],
  bridge: [
    'o o           o o',
    'o o           o o',
    'o o o o o o o o o',
    ' o o o o o o o o',
  ],
  waves: [
    'o o o o o o o o o',
    ' o o o o o o o o',
    'o o o o o o o o o',
  ],
  valley: [
    'o               o',
    ' o             o',
    'o o           o o',
    ' o o o     o o o',
    'o o o o o o o o o',
  ],
  lotus: [
    '     o   o',
    '  o   o o   o',
    ' o o o o o o o',
    '  o o o o o o',
    'o o o o o o o o',
  ],
  market: [
    'o o   o o   o o',
    'o o   o o   o o',
    ' o o o o o o o',
    'o o o o o o o o',
  ],
  peaks4: [
    '   o   o   o   o',
    '  o o o o o o o o',
    ' o o o o o o o o o',
    'o o o o o o o o o o',
  ],
  summit: [
    '      o',
    '     o o',
    '    o o o',
    '   o o o o',
    '  o o o o o',
    ' o o o o o o',
    'o o o o o o o',
  ],
};

/** Where a card lies: in half card widths from the left and half card heights from the top. */
export interface Spot {
  col: number;
  row: number;
}

export interface Layout {
  id: LayoutId;
  /** Top lines first, each from the left; this is also the order they are drawn in. */
  spots: readonly Spot[];
  /** The spots lying on each spot; it is face up once all of them are cleared. */
  coveredBy: readonly (readonly number[])[];
  /** The spots each spot lies on. */
  covers: readonly (readonly number[])[];
  /** The size of the whole shape, in half cards. */
  width: number;
  height: number;
}

/** Whether a card at `top` lies on one at `under`: the line below, and less than a card's width apart. */
function liesOn(top: Spot, under: Spot): boolean {
  return top.row === under.row + 1 && Math.abs(top.col - under.col) <= 1;
}

export function parseLayout(id: LayoutId, art: readonly string[]): Layout {
  const spots: Spot[] = [];
  art.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === 'o') spots.push({ col, row });
      else if (ch !== ' ') throw new Error(`Layout ${id} has "${String(ch)}" on line ${String(row + 1)}.`);
    }
  });
  for (let i = 1; i < spots.length; i++) {
    const a = spots[i - 1];
    const b = spots[i];
    if (a && b && a.row === b.row && b.col - a.col < 2) throw new Error(`Layout ${id} has two cards on top of each other on line ${String(a.row + 1)}.`);
  }
  const coveredBy = spots.map((under) => spots.flatMap((top, j) => (liesOn(top, under) ? [j] : [])));
  const covers = spots.map((top) => spots.flatMap((under, j) => (liesOn(top, under) ? [j] : [])));
  return {
    id,
    spots,
    coveredBy,
    covers,
    width: Math.max(...spots.map((s) => s.col)) + 2,
    height: Math.max(...spots.map((s) => s.row)) + 2,
  };
}

export const LAYOUTS: Readonly<Record<LayoutId, Layout>> = Object.fromEntries(LAYOUT_IDS.map((id) => [id, parseLayout(id, ART[id])])) as Record<LayoutId, Layout>;

export function isLayoutId(v: unknown): v is LayoutId {
  return typeof v === 'string' && (LAYOUT_IDS as readonly string[]).includes(v);
}
