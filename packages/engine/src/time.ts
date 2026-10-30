export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** A clock that only moves when told to, for tests and simulations. */
export class ManualClock implements Clock {
  constructor(private t = 0) {}

  now(): number {
    return this.t;
  }

  set(ms: number): void {
    this.t = ms;
  }

  advance(ms: number): void {
    this.t += ms;
  }
}

/**
 * The local calendar day as YYYY-MM-DD. `offsetMinutes` follows Date#getTimezoneOffset
 * (minutes behind UTC, so UTC+7 is -420) and defaults to the device's offset at that time.
 */
export function localDayKey(ms: number, offsetMinutes: number = new Date(ms).getTimezoneOffset()): string {
  return new Date(ms - offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Whole days from one day key to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
