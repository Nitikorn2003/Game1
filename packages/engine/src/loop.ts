import type { Clock } from './time.js';

export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

/** requestAnimationFrame where it exists (it pauses in hidden tabs), else a 60 Hz timer. */
export const browserScheduler: FrameScheduler = {
  request: (callback) =>
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(() => {
          callback();
        })
      : (setTimeout(callback, 16) as unknown as number),
  cancel: (handle) => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
    else clearTimeout(handle);
  },
};

export interface LoopOptions {
  clock: Clock;
  scheduler: FrameScheduler;
  /** Simulation step length. Every step gets exactly this much time. */
  stepMs: number;
  /** Gaps up to this long are simulated step by step; longer ones go to onGap. */
  maxCatchUpMs: number;
  onStep(stepSeconds: number, now: number): void;
  /** A long gap, e.g. the app was in the background. The game decides how to credit it. */
  onGap(gapMs: number, now: number): void;
  onFrame?(now: number): void;
}

/**
 * Fixed-step game loop. Rendering runs once per frame; simulation runs in fixed steps so
 * that results do not depend on the frame rate or on how often the device wakes us up.
 */
export class FixedStepLoop {
  private last = 0;
  private carry = 0;
  private handle: number | null = null;

  constructor(private readonly options: LoopOptions) {}

  get running(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.handle !== null) return;
    this.last = this.options.clock.now();
    this.carry = 0;
    this.schedule();
  }

  stop(): void {
    if (this.handle !== null) this.options.scheduler.cancel(this.handle);
    this.handle = null;
  }

  /** Runs everything due up to the clock's current time. Each frame calls it; tests may too. */
  pump(): void {
    const now = this.options.clock.now();
    const elapsed = now - this.last;
    this.last = now;
    if (elapsed > this.options.maxCatchUpMs) {
      this.carry = 0;
      this.options.onGap(elapsed, now);
    } else if (elapsed > 0) {
      // A clock that jumps backwards (elapsed < 0) simply grants nothing.
      this.carry += elapsed;
      const step = this.options.stepMs;
      while (this.carry >= step) {
        this.carry -= step;
        this.options.onStep(step / 1000, now - this.carry);
      }
    }
    this.options.onFrame?.(now);
  }

  private schedule(): void {
    this.handle = this.options.scheduler.request(() => {
      if (this.handle === null) return;
      this.pump();
      // A step or frame callback may have stopped the loop.
      if (this.running) this.schedule();
    });
  }
}
