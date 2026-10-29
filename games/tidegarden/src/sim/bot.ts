/**
 * A player who never plans ahead: each turn it makes the swap that does the most for the goals
 * right away, and it never uses a tool. The levels' moves are tuned on it, so that most levels
 * can be reached by playing this simply, and a player who thinks ahead has moves to spare.
 */
import { TURTLE, clearMatches, copyBoard, crawls, fireCombo, isCombo, movesOf, swapPieces, xOf, yOf, type Move } from './board.js';
import { goalsLeft, isWon, startDive, swap, type Dive, type Level } from './dive.js';

/** What a turtle crawling down one cell is worth: a little more than a cell cleared under it, as it always works. */
const CRAWL = 4;

/** How much a swap does for the goals, cleared on a copy of the board without what falls after. */
function scoreOf(d: Dive, level: Level, move: Move, left: readonly number[]): number {
  const b = copyBoard(d.board);
  const combo = isCombo(b, move.from, move.to);
  const wants = (kind: string) => level.goals.some((goal, i) => goal.kind === kind && (left[i] ?? 0) > 0);
  // A turtle crawling down is a cell nearer the sea, match or not.
  let score = crawls(b, move.from, move.to) && wants('turtle') ? CRAWL : 0;
  swapPieces(b, move.from, move.to);
  const cleared = combo ? fireCombo(b, move.from, move.to, () => 0.5) : clearMatches(b, [move.to, move.from], () => 0.5);
  if (!cleared) return score;
  const turtles = wants('turtle') ? b.pieces.flatMap((piece, cell) => (piece?.kind === TURTLE ? [cell] : [])) : [];
  for (const { piece, cell } of cleared.popped) {
    score += 1;
    if (level.goals.some((goal, i) => goal.kind === 'collect' && goal.colour === piece.kind && (left[i] ?? 0) > 0)) score += 3;
    // Clearing under a turtle brings it down.
    for (const t of turtles) if (xOf(b, t) === xOf(b, cell) && cell > t) score += 3;
  }
  if (wants('sand')) score += 4 * cleared.sand.length;
  if (wants('rock')) score += 4 * cleared.rocks.length;
  if (wants('kelp')) score += 4 * cleared.kelp.length;
  score += 5 * cleared.made.length;
  // Lower on the board, more falls after: a small nudge.
  return score + yOf(b, move.to) * 0.05 - Math.abs(xOf(b, move.to) - b.width / 2) * 0.01;
}

export function botMove(d: Dive, level: Level): Move | null {
  const left = goalsLeft(d, level);
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const move of movesOf(d.board)) {
    const score = scoreOf(d, level, move, left);
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}

/** The moves the bot takes to reach a level's goals from a seed, or Infinity when it does not within `cap`. */
export function movesNeeded(level: Level, seed: number, cap = 80): number {
  const unbounded: Level = { ...level, moves: cap };
  const d = startDive(unbounded, seed);
  while (d.movesLeft > 0 && !isWon(d, unbounded)) {
    const move = botMove(d, unbounded);
    if (!move || !swap(d, unbounded, move.from, move.to)) break;
  }
  return isWon(d, unbounded) ? d.movesMade : Infinity;
}

/** The share of seeds on which the bot reaches the goals within the level's moves. */
export function winRate(level: Level, seeds: readonly number[]): number {
  return seeds.filter((seed) => movesNeeded(level, seed, level.moves) <= level.moves).length / seeds.length;
}

/** The fewest moves with which the bot reaches the goals on at least `target` of the seeds. */
export function tuneMoves(level: Level, target: number, seeds: readonly number[], cap = 80): number {
  const needed = seeds.map((seed) => movesNeeded(level, seed, cap)).sort((p, q) => p - q);
  return needed[Math.max(0, Math.ceil(target * needed.length) - 1)] ?? cap;
}
