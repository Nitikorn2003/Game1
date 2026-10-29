import { CANALS, STOPS_PER_CANAL, type CanalId } from './content.js';

/** Levels on the canals; after the last one the levels go on in open water. */
export const TRIP_LEVELS = CANALS.length * STOPS_PER_CANAL;

export interface Place {
  index: number;
  canal: CanalId;
  /** The stop on the canal, counted from 0. */
  stop: number;
}

/** Where a level is on the trip: level 1 is the first stop of the first canal. Null in open water. */
export function placeOf(level: number): Place | null {
  if (level < 1 || level > TRIP_LEVELS) return null;
  const index = Math.floor((level - 1) / STOPS_PER_CANAL);
  const canal = CANALS[index];
  return canal ? { index, canal, stop: (level - 1) % STOPS_PER_CANAL } : null;
}

/** The canal that clearing `level` finishes, if it is a canal's last stop. */
export function canalFinishedBy(level: number): CanalId | null {
  const place = placeOf(level);
  return place && place.stop === STOPS_PER_CANAL - 1 ? place.canal : null;
}

/** How many canals are behind a player who cleared `cleared` levels. */
export function canalsDone(cleared: number): number {
  return Math.min(CANALS.length, Math.floor(Math.max(0, cleared) / STOPS_PER_CANAL));
}
