/**
 * A player who never plans ahead: for each shot it tries every aim with the pollen in hand and
 * with the next, and takes the one that does the most for the goals right away. It never uses
 * a tool. The levels' pollen is tuned on it, so that most levels can be reached by playing
 * this simply, and a player who thinks ahead has pollen to spare.
 */
import { centreOf, neighbours, reachedPip, rowOf, type Board } from './hive.js';
import { copyRound, goalsLeft, isWon, shoot, startRound, swapQueue, type Level, type Round, type Shot } from './round.js';

/** The aims the bot tries, in degrees: every 2.5 from 10 to 170. */
const AIMS: readonly number[] = Array.from({ length: 65 }, (_, i) => 10 + i * 2.5);

export interface Aim {
  angle: number;
  /** Swap the pollen in hand for the next before shooting. */
  swap: boolean;
}

function nearestBee(b: Board, cell: number): number {
  const at = centreOf(cell);
  let best = Infinity;
  b.cells.forEach((bud, c) => {
    if (!bud?.bee) return;
    const p = centreOf(c);
    best = Math.min(best, Math.hypot(p.x - at.x, p.y - at.y));
  });
  return best;
}

/** How much a shot did for the goals. */
function scoreOf(level: Level, before: Round, shot: Shot, after: Round, left: readonly number[]): number {
  if (shot.won) return 10_000;
  if (reachedPip(after.board)) return -1_000;
  const wants = (kind: string) => level.goals.some((goal, i) => goal.kind === kind && (left[i] ?? 0) > 0);
  const last = shot.steps.at(-1);
  const popped = shot.steps.reduce((n, s) => n + s.popped.length, 0);
  const fallen = shot.steps.reduce((n, s) => n + s.fallen.length, 0);
  let score = popped + fallen * 1.5;
  if (wants('bees')) score += 30 * shot.freed;
  const leftAfter = goalsLeft(after, level);
  level.goals.forEach((goal, i) => {
    const done = (left[i] ?? 0) - (leftAfter[i] ?? 0);
    if (goal.kind === 'top') score += 8 * done;
    else if (goal.kind === 'collect') score += 4 * done;
  });
  score += shot.steps.reduce((n, s) => n + s.melted.length, 0);
  const cell = shot.cell;
  if (cell !== null && last) {
    const bud = after.board.cells[cell];
    if (bud && popped === 0) {
      // Nothing popped: put it with its colour, high up, and not in front of a bee.
      for (const n of neighbours(cell)) {
        const other = after.board.cells[n];
        if (other?.kind === 'bud' && !other.honey && other.colour === bud.colour) score += 1.2;
      }
      score -= 0.35 * rowOf(cell);
    }
    if (wants('bees')) score -= 0.15 * Math.min(12, nearestBee(before.board, cell));
    if (wants('top')) score -= 0.08 * rowOf(cell);
  }
  return score;
}

/** The bot's best shot from a round as it stands; null when nothing can be shot. */
export function botAim(r: Round, level: Level, canSwap = true): Aim | null {
  const left = goalsLeft(r, level);
  let best: Aim | null = null;
  let bestScore = -Infinity;
  const tries = canSwap && !r.bomb && r.queue[0] !== r.queue[1] ? [false, true] : [false];
  for (const swap of tries) {
    const base = copyRound(r);
    if (swap) swapQueue(base);
    for (const angle of AIMS) {
      const trial = copyRound(base);
      const shot = shoot(trial, level, angle);
      if (!shot) continue;
      const score = scoreOf(level, base, shot, trial, left) - (swap ? 0.01 : 0);
      if (score > bestScore) {
        best = { angle, swap };
        bestScore = score;
      }
    }
  }
  return best;
}

/** The pollen the bot shoots to reach a level's goals from a seed, or Infinity when it does not within `cap`. */
export function shotsNeeded(level: Level, seed: number, cap = 90): number {
  const unbounded: Level = { ...level, shots: cap };
  const r = startRound(unbounded, seed);
  for (let guard = 0; guard < cap * 3 && !isWon(r, unbounded); guard++) {
    const aim = botAim(r, unbounded);
    if (!aim) break;
    if (aim.swap) swapQueue(r);
    if (!shoot(r, unbounded, aim.angle)) break;
  }
  return isWon(r, unbounded) ? r.shotsMade : Infinity;
}

/** The share of seeds on which the bot reaches the goals with the level's pollen. */
export function winRate(level: Level, seeds: readonly number[]): number {
  return seeds.filter((seed) => shotsNeeded(level, seed, level.shots) <= level.shots).length / seeds.length;
}

/** The least pollen with which the bot reaches the goals on at least `target` of the seeds. */
export function tuneShots(level: Level, target: number, seeds: readonly number[], cap = 90): number {
  const needed = seeds.map((seed) => shotsNeeded(level, seed, cap)).sort((p, q) => p - q);
  return needed[Math.max(0, Math.ceil(target * needed.length) - 1)] ?? cap;
}
