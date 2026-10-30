/**
 * One try at a level, a round: its board, the pollen left to shoot and what the goals still
 * need. A shot plays out in steps (the ball sticking, the pops, the falls, the butterflies),
 * which the screens animate one after another; the round itself is already in its final state.
 */
import { Rng } from '@game1/engine';
import type { Tool } from './content.js';
import {
  COLOURS,
  LAST_ROW,
  ROWS,
  beamCells,
  budsIn,
  cellAt,
  coloursOn,
  copyBoard,
  dropLoose,
  groupAt,
  makeBud,
  moveButterflies,
  newBoard,
  popCells,
  rainbowColour,
  reachedPip,
  trace,
  widthOf,
  within,
  type Board,
  type Bud,
  type Gone,
  type Layout,
  type Point,
} from './hive.js';

export type Goal = { kind: 'bees'; count: number } | { kind: 'top' } | { kind: 'collect'; colour: number; count: number };
export type GoalKind = Goal['kind'];

/** Everything a level is: its buds, colours, pollen and goals. */
export interface Level {
  layout: Layout;
  /** How many of the six colours the buds come in: fewer colours, more matches. */
  colours: number;
  shots: number;
  goals: readonly Goal[];
}

export interface Round {
  board: Board;
  /** The state of the random source that picks the colours of new pollen. */
  rng: number;
  shotsLeft: number;
  shotsMade: number;
  /** The colours of the pollen Pip holds, and of the one after it. */
  queue: [number, number];
  /** The nectar jar: buds popped and fallen since it last filled. */
  nectar: number;
  /** A full jar gave Pip a bomb, which is shot before the pollen and takes none. */
  bomb: boolean;
  /** Baby bees freed. */
  freed: number;
  /** Buds popped or fallen, by colour. */
  collected: number[];
  /** Times five more pollen were taken after running out. */
  continues: number;
}

/** Buds popped or fallen that fill the jar. */
export const NECTAR_FULL = 30;
/** Five more pollen after running out. */
export const MORE_SHOTS = 5;
/** Five more pollen after a bud reached Pip also blow away the buds of the lowest rows. */
export const CLEARED_ROWS = 4;
/** How far a bomb's blast reaches from where it sticks, in cells. */
export const BOMB_REACH = 2;

/** What was shot: pollen from the queue, the jar's bomb, or a tool. */
export type ShotKind = 'pollen' | 'jar' | Tool;

/** One part of a shot, for the screens: the board after it, and what happened in it. */
export interface Step {
  kind: 'stick' | 'pop' | 'fall' | 'butterflies';
  cells: readonly (Bud | null)[];
  popped: readonly Gone[];
  fallen: readonly Gone[];
  /** Cells whose honey melted. */
  melted: readonly number[];
  /** Cells whose butterfly changed the colour of its bud. */
  changed: readonly number[];
}

/** A shot played out. */
export interface Shot {
  kind: ShotKind;
  /** The colour of the pollen or of the rainbow where it stuck; -1 for a bomb or a sunbeam. */
  colour: number;
  /** Where the ball flew. */
  points: readonly Point[];
  /** Where it stuck; null for a sunbeam, which goes through to the branch. */
  cell: number | null;
  steps: Step[];
  freed: number;
  /** The jar filled with this shot, and a bomb waits for the next. */
  filled: boolean;
  won: boolean;
  /** Out of pollen, or a bud reached Pip, with goals still to reach. */
  stuck: boolean;
}

export function beesIn(layout: Layout): number {
  return layout.filter((seed) => seed?.bee).length;
}

function draw(r: Round, colours: number, rng: Rng): number {
  const on = coloursOn(r.board);
  return on.length > 0 ? (on[rng.int(on.length)] ?? 0) : rng.int(colours);
}

/** Pollen of a colour no bud has any more is swapped for one that some bud has. */
function refreshQueue(r: Round, colours: number, rng: Rng): void {
  const on = coloursOn(r.board);
  if (on.length === 0) return;
  for (let i = 0; i < 2; i++) if (!on.includes(r.queue[i] ?? -1)) r.queue[i] = draw(r, colours, rng);
}

export function startRound(level: Level, seed: number): Round {
  const rng = new Rng(seed);
  const board = newBoard(level.layout, level.colours, () => rng.next());
  const r: Round = {
    board,
    rng: 0,
    shotsLeft: level.shots,
    shotsMade: 0,
    queue: [0, 0],
    nectar: 0,
    bomb: false,
    freed: 0,
    collected: new Array<number>(COLOURS.length).fill(0),
    continues: 0,
  };
  r.queue = [draw(r, level.colours, rng), draw(r, level.colours, rng)];
  r.rng = rng.state;
  return r;
}

/** What each goal still needs: bees to free, buds of the top row, buds of a colour. A board cleared of every bud has reached them all. */
export function goalsLeft(r: Round, level: Level): number[] {
  const cleared = r.board.cells.every((bud) => bud === null);
  return level.goals.map((goal) => {
    switch (goal.kind) {
      case 'bees':
        return Math.max(0, goal.count - r.freed);
      case 'top':
        return budsIn(r.board, 0);
      case 'collect':
        return cleared ? 0 : Math.max(0, goal.count - (r.collected[goal.colour] ?? 0));
    }
  });
}

export function isWon(r: Round, level: Level): boolean {
  return goalsLeft(r, level).every((n) => n === 0);
}

/** Out of pollen with no bomb to shoot, or a bud at Pip, and the goals not reached. */
export function isStuck(r: Round, level: Level): boolean {
  return !isWon(r, level) && ((r.shotsLeft <= 0 && !r.bomb) || reachedPip(r.board));
}

/** Stars for a level reached: three with a quarter of its pollen to spare, two with a tenth; one after more pollen was taken. */
export function starsFor(r: Round, level: Level): 1 | 2 | 3 {
  if (r.continues > 0) return 1;
  if (r.shotsLeft >= Math.max(2, Math.round(level.shots * 0.25))) return 3;
  if (r.shotsLeft >= Math.max(1, Math.round(level.shots * 0.1))) return 2;
  return 1;
}

/** What Pip shoots next with no tool chosen: the jar's bomb when there is one, or the pollen in hand. */
export function loaded(r: Round): 'jar' | 'pollen' {
  return r.bomb ? 'jar' : 'pollen';
}

/** Swaps the pollen in hand for the next; it takes no pollen. */
export function swapQueue(r: Round): boolean {
  if (r.queue[0] === r.queue[1]) return false;
  r.queue = [r.queue[1], r.queue[0]];
  return true;
}

function step(b: Board, kind: Step['kind'], parts: Partial<Omit<Step, 'kind' | 'cells'>> = {}): Step {
  return { kind, cells: [...b.cells], popped: [], fallen: [], melted: [], changed: [], ...parts };
}

/**
 * Shoots at an angle: the loaded pollen or bomb, or a tool. Null when nothing can be shot: the
 * round is over, or out of pollen with no tool, or the ball would stick nowhere.
 */
export function shoot(r: Round, level: Level, angle: number, tool: Tool | null = null): Shot | null {
  if (isWon(r, level) || isStuck(r, level)) return null;
  const kind: ShotKind = tool ?? loaded(r);
  const b = r.board;
  const flight = trace(b, angle, kind === 'sunbeam');
  if (kind !== 'sunbeam' && flight.cell === null) return null;
  const rng = new Rng(r.rng);
  const steps: Step[] = [];
  const popped: Gone[] = [];
  let colour = -1;
  let melted: number[] = [];
  if (kind === 'sunbeam') {
    melted = popCells(b, beamCells(flight.points), popped);
  } else if (kind === 'bomb' || kind === 'jar') {
    melted = popCells(b, within(flight.cell ?? 0, BOMB_REACH), popped);
  } else {
    const cell = flight.cell ?? 0;
    colour = kind === 'rainbow' ? rainbowColour(b, cell) : r.queue[0];
    b.cells[cell] = makeBud(b, 'bud', colour);
    steps.push(step(b, 'stick'));
    const group = groupAt(b, cell);
    if (group.length >= 3) melted = popCells(b, group, popped);
  }
  if (popped.length > 0 || melted.length > 0) steps.push(step(b, 'pop', { popped, melted }));
  const fallen = dropLoose(b);
  if (fallen.length > 0) steps.push(step(b, 'fall', { fallen }));

  // The tally: bees freed, colours collected, and the jar.
  let freed = 0;
  for (const { bud } of [...popped, ...fallen]) {
    if (bud.bee) freed++;
    if (bud.kind === 'bud') r.collected[bud.colour] = (r.collected[bud.colour] ?? 0) + 1;
  }
  r.freed += freed;
  if (kind === 'pollen') {
    r.shotsLeft -= 1;
    r.shotsMade += 1;
    r.queue = [r.queue[1], draw(r, level.colours, rng)];
  } else if (kind === 'jar') r.bomb = false;
  r.nectar += popped.length + fallen.length;
  let filled = false;
  if (r.nectar >= NECTAR_FULL && !r.bomb) {
    r.nectar -= NECTAR_FULL;
    r.bomb = true;
    filled = true;
  }
  r.nectar = Math.min(r.nectar, NECTAR_FULL - 1);
  const won = isWon(r, level);
  if (!won) {
    const changed = moveButterflies(b, level.colours);
    if (changed.length > 0) steps.push(step(b, 'butterflies', { changed }));
  }
  refreshQueue(r, level.colours, rng);
  r.rng = rng.state;
  return { kind, colour, points: flight.points, cell: flight.cell, steps, freed, filled, won, stuck: isStuck(r, level) };
}

/**
 * Five more pollen after running out or after a bud reached Pip; a bud at Pip also blows away
 * the buds of the lowest rows, and the bees in them fly free.
 */
export function addShots(r: Round, level: Level): boolean {
  if (!isStuck(r, level)) return false;
  if (reachedPip(r.board)) {
    const b = r.board;
    for (let row = ROWS - CLEARED_ROWS; row <= LAST_ROW; row++)
      for (let col = 0; col < widthOf(row); col++) {
        const cell = cellAt(row, col);
        if (b.cells[cell]?.bee) r.freed += 1;
        b.cells[cell] = null;
      }
    for (const { bud } of dropLoose(b)) if (bud.bee) r.freed += 1;
  }
  r.shotsLeft += MORE_SHOTS;
  r.continues += 1;
  return true;
}

/** A copy of a round that can be played without changing this one, for hints and for the bot. */
export function copyRound(r: Round): Round {
  return { ...r, board: copyBoard(r.board), queue: [r.queue[0], r.queue[1]], collected: [...r.collected] };
}
