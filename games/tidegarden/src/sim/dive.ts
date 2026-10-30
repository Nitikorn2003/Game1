/**
 * One try at a level, a dive: its board, the moves left and what the goals still need. A move
 * plays out in steps (the swap, each round of clearing, each fall), which the screens animate
 * one after another; the dive itself is already in its final state.
 */
import { Rng } from '@game1/engine';
import {
  COLOURS,
  NONE,
  TURTLE,
  clearCell,
  clearMatches,
  clearRow,
  copyBoard,
  exitsOf,
  fireCombo,
  hasMove,
  isColour,
  isCombo,
  makePiece,
  movable,
  newBoard,
  remaining,
  settle,
  shuffle,
  swapPieces,
  swapWorks,
  adjacent,
  type Board,
  type Cleared,
  type Layout,
  type Piece,
} from './board.js';

export type Goal =
  | { kind: 'collect'; colour: number; count: number }
  | { kind: 'sand' }
  | { kind: 'rock' }
  | { kind: 'kelp' }
  | { kind: 'turtle'; count: number };
export type GoalKind = Goal['kind'];

/** Everything a level is: its board, colours, moves and goals. */
export interface Level {
  layout: Layout;
  /** How many of the six colours fall: fewer colours, more matches. */
  colours: number;
  moves: number;
  goals: readonly Goal[];
  /** Baby turtles on the board at once, in a level that brings them down. */
  turtlesAtOnce: number;
}

export interface Dive {
  board: Board;
  /** The state of the random source that picks the colours of new pieces. */
  rng: number;
  movesLeft: number;
  movesMade: number;
  /** Pieces cleared, by colour. */
  collected: number[];
  turtles: { spawned: number; saved: number };
  /** Times five more moves were taken after running out. */
  continues: number;
}

/** One part of a move, for the screens: the board after it, and what happened in it. */
export interface Step {
  kind: 'swap' | 'clear' | 'fall' | 'save' | 'shuffle';
  pieces: readonly (Piece | null)[];
  sand: readonly number[];
  rock: readonly number[];
  kelp: readonly number[];
  cleared: Cleared | null;
  /** Cells the turtles left the board from. */
  saved: number[];
}

/** A move played out. */
export interface Played {
  steps: Step[];
  won: boolean;
  /** Out of moves, with goals still to reach. */
  stuck: boolean;
}

export function turtleGoal(level: Level): number {
  for (const goal of level.goals) if (goal.kind === 'turtle') return goal.count;
  return 0;
}

export function startDive(level: Level, seed: number): Dive {
  const rng = new Rng(seed);
  const random = () => rng.next();
  const board = newBoard(level.layout, level.colours, random);
  const d: Dive = {
    board,
    rng: rng.state,
    movesLeft: level.moves,
    movesMade: 0,
    collected: new Array<number>(COLOURS.length).fill(0),
    turtles: { spawned: 0, saved: 0 },
    continues: 0,
  };
  // The first turtles start in the top row.
  const wanted = Math.min(level.turtlesAtOnce, turtleGoal(level));
  const tops = board.pieces.flatMap((piece, cell) => (cell < board.width && piece && movable(board, cell) && piece.special === NONE ? [cell] : []));
  for (let i = 0; i < wanted && tops.length > 0; i++) {
    const at = tops.splice(Math.floor(random() * tops.length), 1)[0];
    if (at === undefined) break;
    board.pieces[at] = makePiece(board, TURTLE);
    d.turtles.spawned += 1;
  }
  if (!hasMove(board)) shuffle(board, level.colours, random);
  d.rng = rng.state;
  return d;
}

/** What each goal still needs: pieces to collect, sand layers, rock hits, kelp, turtles. */
export function goalsLeft(d: Dive, level: Level): number[] {
  const left = remaining(d.board);
  return level.goals.map((goal) => {
    switch (goal.kind) {
      case 'collect':
        return Math.max(0, goal.count - (d.collected[goal.colour] ?? 0));
      case 'sand':
        return left.sand;
      case 'rock':
        return left.rock;
      case 'kelp':
        return left.kelp;
      case 'turtle':
        return Math.max(0, goal.count - d.turtles.saved);
    }
  });
}

export function isWon(d: Dive, level: Level): boolean {
  return goalsLeft(d, level).every((n) => n === 0);
}

export function isStuck(d: Dive, level: Level): boolean {
  return d.movesLeft <= 0 && !isWon(d, level);
}

/** Stars for a level reached: three with a quarter of its moves to spare, two with a tenth; one after more moves were taken. */
export function starsFor(d: Dive, level: Level): 1 | 2 | 3 {
  if (d.continues > 0) return 1;
  if (d.movesLeft >= Math.max(2, Math.round(level.moves * 0.25))) return 3;
  if (d.movesLeft >= Math.max(1, Math.round(level.moves * 0.1))) return 2;
  return 1;
}

function snapshot(b: Board, kind: Step['kind'], cleared: Cleared | null, saved: number[] = []): Step {
  return { kind, pieces: [...b.pieces], sand: [...b.sand], rock: [...b.rock], kelp: [...b.kelp], cleared, saved };
}

function count(d: Dive, cleared: Cleared): void {
  for (const { piece } of cleared.popped) if (isColour(piece.kind)) d.collected[piece.kind] = (d.collected[piece.kind] ?? 0) + 1;
}

/** Plays out everything a change on the board sets off: falls, turtles leaving, and every match after. */
function playOut(d: Dive, level: Level, rng: Rng, first: Cleared | null, moved: readonly number[], steps: Step[]): void {
  const b = d.board;
  const random = () => rng.next();
  const goal = turtleGoal(level);
  const onBoard = () => b.pieces.filter((piece) => piece?.kind === TURTLE).length;
  // A new turtle comes in with the first new pieces after the last one on the board went.
  let turtleDue = goal > 0 && d.turtles.spawned < goal && onBoard() < level.turtlesAtOnce;
  const spawn = (board: Board): Piece => {
    if (turtleDue) {
      turtleDue = false;
      d.turtles.spawned += 1;
      return makePiece(board, TURTLE);
    }
    return makePiece(board, Math.floor(random() * level.colours));
  };
  if (first) {
    count(d, first);
    steps.push(snapshot(b, 'clear', first));
  }
  // Special pieces from the first matches go where the player moved a piece; not after a combo or a tool.
  let lastMoved = first ? [] : moved;
  const exits = exitsOf(b);
  for (let round = 0; round < 100; round++) {
    const cleared = clearMatches(b, lastMoved, random);
    lastMoved = [];
    if (cleared) {
      count(d, cleared);
      steps.push(snapshot(b, 'clear', cleared));
    }
    const fell = settle(b, spawn);
    if (fell) steps.push(snapshot(b, 'fall', null));
    const leaving = exits.filter((cell) => b.pieces[cell]?.kind === TURTLE);
    if (leaving.length > 0) {
      for (const cell of leaving) b.pieces[cell] = null;
      d.turtles.saved += leaving.length;
      turtleDue = d.turtles.spawned < goal && onBoard() < level.turtlesAtOnce;
      steps.push(snapshot(b, 'save', null, leaving));
    }
    if (!cleared && !fell && leaving.length === 0) break;
  }
  if (!isWon(d, level) && !hasMove(b) && shuffle(b, level.colours, random)) steps.push(snapshot(b, 'shuffle', null));
}

function finish(d: Dive, level: Level, rng: Rng, steps: Step[]): Played {
  d.rng = rng.state;
  const won = isWon(d, level);
  return { steps, won, stuck: !won && d.movesLeft <= 0 };
}

/** Whether a swap would be taken: neighbours, both free to move, and making a match or firing together. */
export function canSwap(d: Dive, from: number, to: number): boolean {
  return swapWorks(d.board, from, to);
}

/**
 * Swaps two neighbouring pieces, which takes a move. Null when the swap makes no match (the
 * pieces go back and no move is taken), or when the dive is over.
 */
export function swap(d: Dive, level: Level, from: number, to: number): Played | null {
  if (d.movesLeft <= 0 || isWon(d, level) || !canSwap(d, from, to)) return null;
  return move(d, level, from, to, true);
}

function move(d: Dive, level: Level, from: number, to: number, costs: boolean): Played {
  const rng = new Rng(d.rng);
  const random = () => rng.next();
  const b = d.board;
  const steps: Step[] = [];
  const combo = isCombo(b, from, to);
  swapPieces(b, from, to);
  steps.push(snapshot(b, 'swap', null));
  if (costs) {
    d.movesLeft -= 1;
    d.movesMade += 1;
  }
  const first = combo ? fireCombo(b, from, to, random) : null;
  playOut(d, level, rng, first, [to, from], steps);
  return finish(d, level, rng, steps);
}

// ---------------------------------------------------------------------------------------
// Tools, which take no move

/** Whether the claw would clear anything in a cell: a piece other than a turtle, a rock or kelp. */
export function clawWorks(d: Dive, cell: number): boolean {
  const b = d.board;
  if (!b.open[cell]) return false;
  if ((b.rock[cell] ?? 0) > 0 || (b.kelp[cell] ?? 0) > 0) return true;
  const piece = b.pieces[cell];
  return piece != null && piece.kind !== TURTLE;
}

export function claw(d: Dive, level: Level, cell: number): Played | null {
  if (isWon(d, level) || !clawWorks(d, cell)) return null;
  const rng = new Rng(d.rng);
  const steps: Step[] = [];
  const first = clearCell(d.board, cell, () => rng.next());
  playOut(d, level, rng, first, [], steps);
  return finish(d, level, rng, steps);
}

/** Whether the tide would clear anything in a row. */
export function tideWorks(d: Dive, y: number): boolean {
  if (y < 0 || y >= d.board.height) return false;
  for (let x = 0; x < d.board.width; x++) if (clawWorks(d, y * d.board.width + x)) return true;
  return false;
}

export function tide(d: Dive, level: Level, y: number): Played | null {
  if (isWon(d, level) || !tideWorks(d, y)) return null;
  const rng = new Rng(d.rng);
  const steps: Step[] = [];
  const first = clearRow(d.board, y, () => rng.next());
  playOut(d, level, rng, first, [], steps);
  return finish(d, level, rng, steps);
}

/** Whether the hermit crab may swap two pieces: neighbours, both free to move, match or not. */
export function freeSwapWorks(d: Dive, from: number, to: number): boolean {
  return adjacent(d.board, from, to) && movable(d.board, from) && movable(d.board, to);
}

/** Swaps any two neighbouring pieces without taking a move, whether they match or not. */
export function freeSwap(d: Dive, level: Level, from: number, to: number): Played | null {
  if (isWon(d, level) || !freeSwapWorks(d, from, to)) return null;
  return move(d, level, from, to, false);
}

/** Five more moves after running out. */
export const MORE_MOVES = 5;

export function addMoves(d: Dive, level: Level): boolean {
  if (!isStuck(d, level)) return false;
  d.movesLeft += MORE_MOVES;
  d.continues += 1;
  return true;
}

/** A copy of a dive that can be played without changing this one, for hints and for the bot. */
export function copyDive(d: Dive): Dive {
  return { ...d, board: copyBoard(d.board), collected: [...d.collected], turtles: { ...d.turtles } };
}
