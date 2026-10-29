/**
 * The reef board: a grid of cells, each holding a piece, with the sand, rocks and kelp that
 * levels lay on it. Everything here is a plain function of a board and a source of new
 * pieces, so a level plays out the same way from the same save and the rules can be tested
 * without any screen.
 *
 * Three or more pieces of one colour in a row or a column match and are cleared; pieces above
 * fall into the gaps, and new ones come in at the top. Four in a line make a wave that clears
 * its row or column, an L or a T makes a bubble bomb that clears the cells around it, and five
 * in a line make a pearl that clears every piece of the colour it is swapped with.
 */

/** The six colours, each with its own shape on the board. */
export const COLOURS = ['coral', 'shell', 'star', 'glass', 'bubble', 'urchin'] as const;
export type Colour = (typeof COLOURS)[number];
/** Kinds of piece after the colours: the pearl, which has no colour, and the baby turtle, which never matches. */
export const PEARL = 6;
export const TURTLE = 7;
export const KINDS = 8;

export const NONE = 0;
/** A wave that clears its row, or its column. */
export const ROW = 1;
export const COL = 2;
/** A bubble bomb that clears the eight cells around it, and its own. */
export const BOMB = 3;
export type Special = typeof NONE | typeof ROW | typeof COL | typeof BOMB;

export interface Piece {
  /** Stays with the piece as it moves, so the screens can follow it. */
  readonly id: number;
  readonly kind: number;
  readonly special: Special;
}

export interface Board {
  readonly width: number;
  readonly height: number;
  /** Cells that are part of the board; the others are gaps that pieces fall through. */
  readonly open: readonly boolean[];
  pieces: (Piece | null)[];
  /** Layers of sand under a cell, cleared one at a time by clearing the piece on it. */
  sand: number[];
  /** Hits a rock still takes. A rock fills its cell: no piece, and nothing falls through it. */
  rock: number[];
  /** 1 where kelp holds a piece: it cannot be moved or fall, until a match or a blast cuts it free. */
  kelp: number[];
  nextId: number;
}

/** Where the board's sand, rocks and kelp start, and its gaps. */
export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly open: readonly boolean[];
  readonly sand: readonly number[];
  readonly rock: readonly number[];
  readonly kelp: readonly number[];
}

export const isColour = (kind: number): boolean => kind >= 0 && kind < COLOURS.length;
export const isSpecial = (piece: Piece | null): boolean => piece !== null && (piece.special !== NONE || piece.kind === PEARL);

export function xOf(b: Pick<Board, 'width'>, cell: number): number {
  return cell % b.width;
}
export function yOf(b: Pick<Board, 'width'>, cell: number): number {
  return Math.floor(cell / b.width);
}

/** The cells beside a cell, up, down, left and right, that are part of the board. */
export function neighbours(b: Pick<Board, 'width' | 'height' | 'open'>, cell: number): number[] {
  const x = cell % b.width;
  const y = Math.floor(cell / b.width);
  const out: number[] = [];
  if (y > 0 && b.open[cell - b.width]) out.push(cell - b.width);
  if (y < b.height - 1 && b.open[cell + b.width]) out.push(cell + b.width);
  if (x > 0 && b.open[cell - 1]) out.push(cell - 1);
  if (x < b.width - 1 && b.open[cell + 1]) out.push(cell + 1);
  return out;
}

export function adjacent(b: Pick<Board, 'width'>, a: number, c: number): boolean {
  const dx = Math.abs(xOf(b, a) - xOf(b, c));
  const dy = Math.abs(yOf(b, a) - yOf(b, c));
  return dx + dy === 1;
}

/** A piece the player can swap: not held by kelp. */
export function movable(b: Board, cell: number): boolean {
  return b.open[cell] === true && b.rock[cell] === 0 && b.pieces[cell] != null && b.kelp[cell] === 0;
}

/** Makes a new piece; the board keeps count so that every piece has its own id. */
export function makePiece(b: Board, kind: number, special: Special = NONE): Piece {
  const piece = { id: b.nextId, kind, special };
  b.nextId += 1;
  return piece;
}

function sameColour(b: Board, cell: number, kind: number): boolean {
  const piece = b.pieces[cell];
  return piece != null && piece.kind === kind;
}

/** Whether the piece in a cell lines up with two or more of its colour in its row or its column. */
export function lineAt(b: Board, cell: number): boolean {
  const piece = b.pieces[cell];
  if (!piece || !isColour(piece.kind)) return false;
  const { kind } = piece;
  const x = cell % b.width;
  let run = 1;
  for (let i = x - 1; i >= 0 && sameColour(b, cell - (x - i), kind); i--) run++;
  for (let i = x + 1; i < b.width && sameColour(b, cell + (i - x), kind); i++) run++;
  if (run >= 3) return true;
  run = 1;
  for (let c = cell - b.width; c >= 0 && sameColour(b, c, kind); c -= b.width) run++;
  for (let c = cell + b.width; c < b.pieces.length && sameColour(b, c, kind); c += b.width) run++;
  return run >= 3;
}

/** A line of three or more of one colour. */
export interface Run {
  cells: number[];
  horizontal: boolean;
}

/** One match: the runs of one colour that share cells, which together make a line, an L, a T or a cross. */
export interface Group {
  kind: number;
  cells: number[];
  runs: Run[];
}

export function runs(b: Board): Run[] {
  const out: Run[] = [];
  const scan = (start: number, step: number, length: number, horizontal: boolean) => {
    let i = 0;
    while (i < length) {
      const piece = b.pieces[start + i * step];
      if (!piece || !isColour(piece.kind)) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < length && sameColour(b, start + j * step, piece.kind)) j++;
      if (j - i >= 3) out.push({ cells: Array.from({ length: j - i }, (_, k) => start + (i + k) * step), horizontal });
      i = j;
    }
  };
  for (let y = 0; y < b.height; y++) scan(y * b.width, 1, b.width, true);
  for (let x = 0; x < b.width; x++) scan(x, b.width, b.height, false);
  return out;
}

/** Every match on the board. */
export function groups(b: Board): Group[] {
  const all = runs(b);
  const owner = new Map<number, number>();
  const found: { kind: number; cells: Set<number>; runs: Run[] }[] = [];
  for (const run of all) {
    const touching = [...new Set(run.cells.map((cell) => owner.get(cell)).filter((g): g is number => g !== undefined))];
    let target: number;
    if (touching.length === 0) {
      target = found.length;
      found.push({ kind: b.pieces[run.cells[0] ?? 0]?.kind ?? 0, cells: new Set(), runs: [] });
    } else {
      target = touching[0] ?? 0;
      // A run that joins two groups makes them one.
      for (const other of touching.slice(1)) {
        const from = found[other];
        const into = found[target];
        if (!from || !into) continue;
        for (const cell of from.cells) {
          into.cells.add(cell);
          owner.set(cell, target);
        }
        into.runs.push(...from.runs);
        from.cells.clear();
        from.runs = [];
      }
    }
    const group = found[target];
    if (!group) continue;
    group.runs.push(run);
    for (const cell of run.cells) {
      group.cells.add(cell);
      owner.set(cell, target);
    }
  }
  return found.filter((g) => g.runs.length > 0).map((g) => ({ kind: g.kind, cells: [...g.cells].sort((p, q) => p - q), runs: g.runs }));
}

/** The special piece a match makes, if any, and of what kind. */
export function specialOf(group: Group): { kind: number; special: Special } | null {
  const longest = Math.max(...group.runs.map((run) => run.cells.length));
  if (longest >= 5) return { kind: PEARL, special: NONE };
  const across = group.runs.some((run) => run.horizontal);
  const down = group.runs.some((run) => !run.horizontal);
  if (across && down) return { kind: group.kind, special: BOMB };
  if (longest === 4) return { kind: group.kind, special: across ? ROW : COL };
  return null;
}

/** Where a match puts its special piece: where the player moved a piece into it, or else at its middle. */
function placeOf(b: Board, group: Group, special: Special, moved: readonly number[]): number | null {
  const free = (cell: number) => b.kelp[cell] === 0;
  for (const cell of moved) if (group.cells.includes(cell) && free(cell)) return cell;
  if (special === BOMB) {
    const across = new Set(group.runs.filter((run) => run.horizontal).flatMap((run) => run.cells));
    const corner = group.runs.filter((run) => !run.horizontal).flatMap((run) => run.cells).find((cell) => across.has(cell) && free(cell));
    if (corner !== undefined) return corner;
  }
  const longest = [...group.runs].sort((p, q) => q.cells.length - p.cells.length)[0];
  const middle = longest?.cells[Math.floor((longest.cells.length - 1) / 2)];
  if (middle !== undefined && free(middle)) return middle;
  return group.cells.find(free) ?? null;
}

// ---------------------------------------------------------------------------------------
// Clearing

/** What fired, for the screens to draw: a wave along a row or a column, a bomb, or a pearl's colour. */
export type Blast =
  | { kind: 'row' | 'col'; cell: number }
  | { kind: 'bomb'; cell: number; radius: number }
  | { kind: 'colour'; cell: number; colour: number }
  | { kind: 'all'; cell: number };

export interface Popped {
  piece: Piece;
  cell: number;
}

/** What one round of clearing did. */
export interface Cleared {
  popped: Popped[];
  blasts: Blast[];
  /** Cells of the special pieces the matches made. */
  made: number[];
  /** Cells where a layer of sand went, a rock was hit and kelp was cut. */
  sand: number[];
  rocks: number[];
  kelp: number[];
}

function emptyCleared(): Cleared {
  return { popped: [], blasts: [], made: [], sand: [], rocks: [], kelp: [] };
}

/** Clears cells, and lets every special piece it clears fire in turn. */
class Clearer {
  readonly out = emptyCleared();
  private readonly queue: { cell: number; piece: Piece }[] = [];

  constructor(
    private readonly b: Board,
    private readonly random: () => number,
  ) {}

  /** A match or a blast reaches a cell. */
  hit(cell: number): void {
    const b = this.b;
    if (!b.open[cell]) return;
    if ((b.rock[cell] ?? 0) > 0) {
      this.damageRock(cell);
      return;
    }
    if ((b.kelp[cell] ?? 0) > 0) {
      b.kelp[cell] = 0;
      this.out.kelp.push(cell);
      return;
    }
    const piece = b.pieces[cell];
    if (!piece || piece.kind === TURTLE) return;
    b.pieces[cell] = null;
    this.out.popped.push({ piece, cell });
    if ((b.sand[cell] ?? 0) > 0) {
      b.sand[cell] = (b.sand[cell] ?? 1) - 1;
      this.out.sand.push(cell);
    }
    if (piece.special !== NONE || piece.kind === PEARL) this.queue.push({ cell, piece });
  }

  /** A rock takes one hit from each match beside it, and one from each blast that reaches it. */
  damageRock(cell: number): void {
    const b = this.b;
    if ((b.rock[cell] ?? 0) <= 0) return;
    b.rock[cell] = (b.rock[cell] ?? 1) - 1;
    this.out.rocks.push(cell);
  }

  /** Lets every special piece cleared so far fire, and those they clear too. */
  fireAll(): void {
    for (let next = this.queue.shift(); next; next = this.queue.shift()) this.fire(next.cell, next.piece);
  }

  fire(cell: number, piece: Piece): void {
    const b = this.b;
    if (piece.kind === PEARL) {
      const colour = commonestColour(b);
      this.out.blasts.push({ kind: 'colour', cell, colour });
      this.colour(colour);
      return;
    }
    switch (piece.special) {
      case ROW:
        this.out.blasts.push({ kind: 'row', cell });
        this.row(yOf(b, cell));
        break;
      case COL:
        this.out.blasts.push({ kind: 'col', cell });
        this.col(xOf(b, cell));
        break;
      case BOMB:
        this.out.blasts.push({ kind: 'bomb', cell, radius: 1 });
        this.square(cell, 1);
        break;
      default:
        break;
    }
  }

  row(y: number): void {
    if (y < 0 || y >= this.b.height) return;
    for (let x = 0; x < this.b.width; x++) this.hit(y * this.b.width + x);
  }

  col(x: number): void {
    if (x < 0 || x >= this.b.width) return;
    for (let y = 0; y < this.b.height; y++) this.hit(y * this.b.width + x);
  }

  square(cell: number, radius: number): void {
    const cx = xOf(this.b, cell);
    const cy = yOf(this.b, cell);
    for (let y = cy - radius; y <= cy + radius; y++)
      for (let x = cx - radius; x <= cx + radius; x++) if (x >= 0 && y >= 0 && x < this.b.width && y < this.b.height) this.hit(y * this.b.width + x);
  }

  colour(colour: number): void {
    this.b.pieces.forEach((piece, cell) => {
      if (piece?.kind === colour) this.hit(cell);
    });
  }

  everything(): void {
    for (let cell = 0; cell < this.b.pieces.length; cell++) this.hit(cell);
  }

  /** Every piece of a colour becomes a special piece of the given kind, then they all fire. */
  convert(colour: number, special: Special | 'wave'): void {
    const b = this.b;
    b.pieces.forEach((piece, cell) => {
      if (!piece || piece.kind !== colour || piece.special !== NONE) return;
      const made: Special = special === 'wave' ? (this.random() < 0.5 ? ROW : COL) : special;
      b.pieces[cell] = { id: piece.id, kind: piece.kind, special: made };
    });
    b.pieces.forEach((piece, cell) => {
      if (piece?.kind === colour) this.hit(cell);
    });
  }
}

/** The colour with the most pieces on the board; the first such colour on a tie. */
export function commonestColour(b: Board): number {
  const counts = new Array<number>(COLOURS.length).fill(0);
  for (const piece of b.pieces) if (piece && isColour(piece.kind)) counts[piece.kind] = (counts[piece.kind] ?? 0) + 1;
  let best = 0;
  counts.forEach((n, kind) => {
    if (n > (counts[best] ?? 0)) best = kind;
  });
  return best;
}

/** Clears every match on the board, and makes the special pieces they earn. Null when nothing matches. */
export function clearMatches(b: Board, moved: readonly number[], random: () => number): Cleared | null {
  const found = groups(b);
  if (found.length === 0) return null;
  const clearer = new Clearer(b, random);
  const toMake: { cell: number; kind: number; special: Special }[] = [];
  for (const group of found) {
    const made = specialOf(group);
    if (made) {
      const cell = placeOf(b, group, made.special, moved);
      if (cell !== null) toMake.push({ cell, ...made });
    }
    // A match hits each rock beside it once.
    const beside = new Set<number>();
    for (const cell of group.cells) for (const n of neighbours(b, cell)) if ((b.rock[n] ?? 0) > 0) beside.add(n);
    for (const cell of beside) clearer.damageRock(cell);
  }
  for (const group of found) for (const cell of group.cells) clearer.hit(cell);
  clearer.fireAll();
  for (const { cell, kind, special } of toMake) {
    if (b.pieces[cell] || (b.kelp[cell] ?? 0) > 0) continue;
    b.pieces[cell] = makePiece(b, kind, special);
    clearer.out.made.push(cell);
  }
  return clearer.out;
}

/** Whether swapping two pieces fires them together, even without a match. */
export function isCombo(b: Board, a: number, c: number): boolean {
  const p = b.pieces[a];
  const q = b.pieces[c];
  if (!p || !q || p.kind === TURTLE || q.kind === TURTLE) return false;
  if (p.kind === PEARL || q.kind === PEARL) return true;
  return p.special !== NONE && q.special !== NONE;
}

/**
 * Fires two special pieces swapped together, the piece moved from `from` now at `to`. Returns
 * null when they make no combo, and the swap is then an ordinary one.
 */
export function fireCombo(b: Board, from: number, to: number, random: () => number): Cleared | null {
  if (!isCombo(b, from, to)) return null;
  // After the swap, the moved piece is at `to` and the other at `from`.
  const moved = b.pieces[to];
  const other = b.pieces[from];
  if (!moved || !other) return null;
  const clearer = new Clearer(b, random);
  const take = (cell: number) => {
    const piece = b.pieces[cell];
    if (!piece) return;
    b.pieces[cell] = null;
    clearer.out.popped.push({ piece, cell });
    if ((b.sand[cell] ?? 0) > 0) {
      b.sand[cell] = (b.sand[cell] ?? 1) - 1;
      clearer.out.sand.push(cell);
    }
  };
  const pearl = moved.kind === PEARL ? moved : other.kind === PEARL ? other : null;
  if (pearl) {
    const partner = pearl === moved ? other : moved;
    const pearlCell = pearl === moved ? to : from;
    const partnerCell = pearl === moved ? from : to;
    take(pearlCell);
    if (partner.kind === PEARL) {
      take(partnerCell);
      clearer.out.blasts.push({ kind: 'all', cell: to });
      clearer.everything();
    } else if (partner.special === NONE) {
      clearer.out.blasts.push({ kind: 'colour', cell: partnerCell, colour: partner.kind });
      clearer.colour(partner.kind);
    } else {
      clearer.out.blasts.push({ kind: 'colour', cell: partnerCell, colour: partner.kind });
      clearer.convert(partner.kind, partner.special === BOMB ? BOMB : 'wave');
    }
    clearer.fireAll();
    return clearer.out;
  }
  // Two waves, a wave and a bomb, or two bombs.
  take(from);
  take(to);
  const waves = [moved, other].filter((p) => p.special === ROW || p.special === COL).length;
  const x = xOf(b, to);
  const y = yOf(b, to);
  if (waves === 2) {
    clearer.out.blasts.push({ kind: 'row', cell: to }, { kind: 'col', cell: to });
    clearer.row(y);
    clearer.col(x);
  } else if (waves === 1) {
    for (const d of [-1, 0, 1]) {
      if (y + d >= 0 && y + d < b.height) clearer.out.blasts.push({ kind: 'row', cell: (y + d) * b.width + x });
      if (x + d >= 0 && x + d < b.width) clearer.out.blasts.push({ kind: 'col', cell: y * b.width + x + d });
      clearer.row(y + d);
      clearer.col(x + d);
    }
  } else {
    clearer.out.blasts.push({ kind: 'bomb', cell: to, radius: 2 });
    clearer.square(to, 2);
  }
  clearer.fireAll();
  return clearer.out;
}

/** Clears one cell, the way a crab's claw does: the piece, a rock's hit or the kelp. */
export function clearCell(b: Board, cell: number, random: () => number): Cleared {
  const clearer = new Clearer(b, random);
  clearer.hit(cell);
  clearer.fireAll();
  return clearer.out;
}

/** Clears a whole row, the way the tide does. */
export function clearRow(b: Board, y: number, random: () => number): Cleared {
  const clearer = new Clearer(b, random);
  clearer.out.blasts.push({ kind: 'row', cell: y * b.width });
  clearer.row(y);
  clearer.fireAll();
  return clearer.out;
}

// ---------------------------------------------------------------------------------------
// Falling

/** Whether something can fall into a cell from above: a piece, or a new one from the top. */
function fedFromAbove(b: Board, cell: number): boolean {
  for (let c = cell - b.width; c >= 0; c -= b.width) {
    if (!b.open[c]) continue;
    if ((b.rock[c] ?? 0) > 0 || (b.kelp[c] ?? 0) > 0) return false;
    if (b.pieces[c]) return true;
  }
  return true;
}

/** The first cell of a column that is part of the board, where new pieces come in. */
export function topOf(b: Pick<Board, 'width' | 'height' | 'open'>, x: number): number | null {
  for (let y = 0; y < b.height; y++) if (b.open[y * b.width + x]) return y * b.width + x;
  return null;
}

/** The last cell of each column, where baby turtles leave the board. */
export function exitsOf(b: Pick<Board, 'width' | 'height' | 'open'>): number[] {
  const out: number[] = [];
  for (let x = 0; x < b.width; x++)
    for (let y = b.height - 1; y >= 0; y--)
      if (b.open[y * b.width + x]) {
        out.push(y * b.width + x);
        break;
      }
  return out;
}

/**
 * Lets pieces fall into the gaps, straight down through cells that are not part of the board,
 * and slide down beside a rock or kelp that stops them; new pieces come in at the top. Returns
 * whether anything moved.
 */
export function settle(b: Board, spawn: (b: Board) => Piece): boolean {
  let changed = false;
  for (let guard = 0; guard < 10_000; guard++) {
    let moved = false;
    for (let x = 0; x < b.width; x++) {
      for (let y = b.height - 1; y >= 0; y--) {
        const cell = y * b.width + x;
        if (!b.open[cell] || (b.rock[cell] ?? 0) > 0 || b.pieces[cell]) continue;
        for (let c = cell - b.width; c >= 0; c -= b.width) {
          if (!b.open[c]) continue;
          if ((b.rock[c] ?? 0) > 0 || (b.kelp[c] ?? 0) > 0) break;
          const piece = b.pieces[c];
          if (!piece) continue;
          b.pieces[cell] = piece;
          b.pieces[c] = null;
          moved = true;
          break;
        }
      }
      const top = topOf(b, x);
      if (top !== null && (b.rock[top] ?? 0) === 0 && !b.pieces[top]) {
        b.pieces[top] = spawn(b);
        moved = true;
      }
    }
    if (!moved) {
      // Only once nothing can fall straight down: a piece slides down beside whatever stops the pieces above a gap.
      outer: for (let y = b.height - 1; y >= 1; y--) {
        for (let x = 0; x < b.width; x++) {
          const cell = y * b.width + x;
          if (!b.open[cell] || (b.rock[cell] ?? 0) > 0 || b.pieces[cell] || fedFromAbove(b, cell)) continue;
          for (const dx of [-1, 1]) {
            const nx = x + dx;
            if (nx < 0 || nx >= b.width) continue;
            const from = cell - b.width + dx;
            if (movable(b, from)) {
              b.pieces[cell] = b.pieces[from] ?? null;
              b.pieces[from] = null;
              moved = true;
              break outer;
            }
          }
        }
      }
    }
    if (!moved) return changed;
    changed = true;
  }
  return changed;
}

// ---------------------------------------------------------------------------------------
// Moves

/** The cell a baby turtle crawls down into: the next cell of the board below it, past any gap, as pieces fall. */
export function crawlTo(b: Pick<Board, 'width' | 'open'>, cell: number): number | null {
  for (let c = cell + b.width; c < b.open.length; c += b.width) if (b.open[c]) return c;
  return null;
}

/** Whether a swap lets a baby turtle crawl down a cell, which it may do with or without a match. */
export function crawls(b: Board, a: number, c: number): boolean {
  const top = Math.min(a, c);
  const below = Math.max(a, c);
  return b.pieces[top]?.kind === TURTLE && crawlTo(b, top) === below && b.pieces[below]?.kind !== TURTLE;
}

/** The cell below one that a swap down reaches: the next cell for a piece, and past a gap for a turtle. */
function downOf(b: Board, cell: number): number | null {
  if (b.pieces[cell]?.kind === TURTLE) return crawlTo(b, cell);
  return cell + b.width < b.pieces.length ? cell + b.width : null;
}

/** Whether swapping two pieces makes a match, fires them together, or lets a turtle crawl down. */
export function swapWorks(b: Board, a: number, c: number): boolean {
  if (!movable(b, a) || !movable(b, c)) return false;
  if (crawls(b, a, c)) return true;
  if (!adjacent(b, a, c)) return false;
  if (isCombo(b, a, c)) return true;
  const p = b.pieces[a] ?? null;
  const q = b.pieces[c] ?? null;
  b.pieces[a] = q;
  b.pieces[c] = p;
  const works = lineAt(b, a) || lineAt(b, c);
  b.pieces[a] = p;
  b.pieces[c] = q;
  return works;
}

export interface Move {
  from: number;
  to: number;
}

/** Every swap that works, each pair once. */
export function movesOf(b: Board): Move[] {
  const out: Move[] = [];
  for (let cell = 0; cell < b.pieces.length; cell++) {
    if (!movable(b, cell)) continue;
    const x = cell % b.width;
    if (x < b.width - 1 && swapWorks(b, cell, cell + 1)) out.push({ from: cell, to: cell + 1 });
    const down = downOf(b, cell);
    if (down !== null && swapWorks(b, cell, down)) out.push({ from: cell, to: down });
  }
  return out;
}

export function hasMove(b: Board): boolean {
  for (let cell = 0; cell < b.pieces.length; cell++) {
    if (!movable(b, cell)) continue;
    const x = cell % b.width;
    if (x < b.width - 1 && swapWorks(b, cell, cell + 1)) return true;
    const down = downOf(b, cell);
    if (down !== null && swapWorks(b, cell, down)) return true;
  }
  return false;
}

export function swapPieces(b: Board, a: number, c: number): void {
  const p = b.pieces[a] ?? null;
  b.pieces[a] = b.pieces[c] ?? null;
  b.pieces[c] = p;
}

// ---------------------------------------------------------------------------------------
// New boards and shuffles

/** A colour for a cell that does not make a match with the pieces already left of it and above it. */
function calmColour(b: Board, cell: number, colours: number, random: () => number): number {
  const x = cell % b.width;
  const banned = new Set<number>();
  const left1 = x >= 1 ? b.pieces[cell - 1] : null;
  const left2 = x >= 2 ? b.pieces[cell - 2] : null;
  if (left1 && left2 && left1.kind === left2.kind) banned.add(left1.kind);
  const up1 = b.pieces[cell - b.width] ?? null;
  const up2 = b.pieces[cell - 2 * b.width] ?? null;
  if (up1 && up2 && up1.kind === up2.kind) banned.add(up1.kind);
  const allowed = Array.from({ length: colours }, (_, k) => k).filter((k) => !banned.has(k));
  return allowed[Math.floor(random() * allowed.length)] ?? 0;
}

/** A board laid out as the level says, filled with pieces that make no match yet but leave a move to make. */
export function newBoard(layout: Layout, colours: number, random: () => number): Board {
  const b: Board = {
    width: layout.width,
    height: layout.height,
    open: layout.open,
    pieces: new Array<Piece | null>(layout.width * layout.height).fill(null),
    sand: [...layout.sand],
    rock: [...layout.rock],
    kelp: [...layout.kelp],
    nextId: 1,
  };
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let cell = 0; cell < b.pieces.length; cell++) {
      b.pieces[cell] = b.open[cell] && b.rock[cell] === 0 ? makePiece(b, calmColour(b, cell, colours, random)) : null;
    }
    if (hasMove(b)) return b;
  }
  return b;
}

/**
 * Mixes up the colours of the plain pieces when no swap works, leaving special pieces, turtles
 * and kelp where they are, until there is no match and a move to make. Returns false when the
 * board cannot be mixed into one with a move.
 */
export function shuffle(b: Board, colours: number, random: () => number): boolean {
  const cells = b.pieces.flatMap((piece, cell) => (piece && isColour(piece.kind) && piece.special === NONE && b.kelp[cell] === 0 ? [cell] : []));
  const kinds = cells.map((cell) => b.pieces[cell]?.kind ?? 0);
  for (let attempt = 0; attempt < 200; attempt++) {
    // After many tries with the same colours, new colours.
    const pool = attempt < 100 ? [...kinds] : kinds.map(() => Math.floor(random() * colours));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const t = pool[i] ?? 0;
      pool[i] = pool[j] ?? 0;
      pool[j] = t;
    }
    cells.forEach((cell, i) => {
      const piece = b.pieces[cell];
      if (piece) b.pieces[cell] = { id: piece.id, kind: pool[i] ?? 0, special: NONE };
    });
    if (groups(b).length === 0 && hasMove(b)) return true;
  }
  return false;
}

/** How much sand, rock and kelp is left. */
export function remaining(b: Board): { sand: number; rock: number; kelp: number } {
  let sand = 0;
  let rock = 0;
  let kelp = 0;
  for (let cell = 0; cell < b.pieces.length; cell++) {
    sand += b.sand[cell] ?? 0;
    rock += b.rock[cell] ?? 0;
    kelp += b.kelp[cell] ?? 0;
  }
  return { sand, rock, kelp };
}

/** A copy of the board that can change without changing this one. Pieces never change, so they are shared. */
export function copyBoard(b: Board): Board {
  return { width: b.width, height: b.height, open: b.open, pieces: [...b.pieces], sand: [...b.sand], rock: [...b.rock], kelp: [...b.kelp], nextId: b.nextId };
}
