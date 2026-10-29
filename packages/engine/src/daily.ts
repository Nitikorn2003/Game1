import { daysBetween } from './time.js';

/**
 * Whether a once-a-day reward last taken on `lastDay` can be taken on `today`.
 * A clock turned back to an earlier day never qualifies.
 */
export function isNewDay(lastDay: string | null, today: string): boolean {
  return lastDay === null || daysBetween(lastDay, today) > 0;
}
