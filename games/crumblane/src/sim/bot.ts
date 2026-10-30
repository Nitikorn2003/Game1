/**
 * A player who never plans ahead: it takes the pastry that does the most right away
 * (finishing a set, then making a pair whose third is in sight, then starting a set it can
 * see the rest of), keeping a place free on the tray when it can, and otherwise digging where
 * it uncovers the most. It never uses a tool or makes room.
 *
 * Played with a random source it is a casual player, who does not see every tile: it spots
 * most of the pastries that match its tray and a few others. The levels' kinds are tuned on
 * that player, so that most levels can be cleared playing this simply. Without one it sees
 * everything, which is the hint the game shows.
 */
import { Rng } from '@game1/engine';
import { coverOf } from './counter.js';
import { TRAY, copyRound, isStuck, isWon, startRound, take, takeable, underOf, type Level, type Round } from './round.js';

/** How many tiles taking `tile` would leave uncovered. */
function uncovers(r: Round, level: Level, tile: number): number {
  const cover = coverOf(level.slots);
  return (underOf(level.slots)[tile] ?? []).filter((u) => r.at[u] === 'counter' && (cover[u] ?? []).every((j) => j === tile || r.at[j] !== 'counter')).length;
}

/** The share of the pastries matching its tray that a casual player spots. */
export const SPOT_MATCHES = 0.75;
/** How many other pastries a casual player looks at each time. */
export const GLANCE = 6;

/** The tile the bot would take next, from the counter or the rack; null when it can take none. */
export function botPick(r: Round, level: Level, rng: Rng | null = null): number | null {
  if (isStuck(r) || isWon(r)) return null;
  const can = takeable(r, level);
  const all = [...r.rack, ...r.at.flatMap((p, i) => (p === 'counter' && can[i] ? [i] : []))];
  if (all.length === 0) return null;
  const onTray = new Map<number, number>();
  for (const t of r.tray) onTray.set(r.kinds[t] ?? -1, (onTray.get(r.kinds[t] ?? -1) ?? 0) + 1);
  let choices = all;
  if (rng) {
    const matches = all.filter((t) => onTray.has(r.kinds[t] ?? -1) && rng.chance(SPOT_MATCHES));
    const others = all.filter((t) => !matches.includes(t));
    const glanced: number[] = [];
    for (let k = 0; k < GLANCE && others.length > 0; k++) glanced.push(...others.splice(rng.int(others.length), 1));
    choices = [...matches, ...glanced];
  }
  const inSight = new Map<number, number>();
  for (const t of choices) inSight.set(r.kinds[t] ?? -1, (inSight.get(r.kinds[t] ?? -1) ?? 0) + 1);
  let best: number | null = null;
  let top = -Infinity;
  for (const tile of choices) {
    const kind = r.kinds[tile] ?? -1;
    const have = onTray.get(kind) ?? 0;
    const seen = inSight.get(kind) ?? 0;
    let score = have === 2 ? 1000 : have === 1 ? (seen >= 2 ? 800 : 400) : seen >= 3 ? 600 : seen === 2 ? 200 : 0;
    if (have < 2) {
      const after = r.tray.length + 1;
      if (after >= TRAY) score -= 100_000;
      else if (after === TRAY - 1) score -= 300;
    }
    if (r.at[tile] === 'counter') score += 5 * uncovers(r, level, tile);
    // Ties go to the tile the player would see first, or at random for the tuning.
    score += rng ? rng.next() : -tile * 1e-6;
    if (score > top) {
      top = score;
      best = tile;
    }
  }
  return best;
}

/** How the bot did on one deal: whether it cleared the counter, and the most pastries its tray held. */
export function botPlay(level: Level, seed: number): { won: boolean; peak: number } {
  const r = copyRound(startRound(level, seed));
  const rng = new Rng(seed ^ 0x5bd1e995);
  for (let n = 0; n < level.slots.length + 1; n++) {
    const tile = botPick(r, level, rng);
    if (tile === null) break;
    take(r, level, tile);
  }
  return { won: isWon(r), peak: r.peak };
}

/** The share of deals the bot clears. */
export function winRate(level: Level, seeds: readonly number[]): number {
  return seeds.filter((seed) => botPlay(level, seed).won).length / Math.max(1, seeds.length);
}
