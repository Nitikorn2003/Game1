/**
 * Claude's artifact viewer can swap an open page for a newer version of it. The old version hands
 * over a snapshot and the new one starts from it, so a player keeps their progress even when the
 * browser keeps no storage. Anywhere else there is no snapshot and keep() does nothing.
 */
interface HotHost {
  data?: unknown;
  ready?: (start: (data: unknown) => void) => void;
  snapshot?: (take: () => unknown) => void;
}

export interface HotSwap {
  /** What the previous version handed over, if anything. */
  readonly data: unknown;
  /** Sets what to hand over to the next version. */
  keep(take: () => unknown): void;
}

export function hotSwap(waitMs = 1500): Promise<HotSwap> {
  const host = (globalThis as { claude?: { hot?: HotHost } }).claude?.hot;
  const keep = (take: () => unknown) => {
    host?.snapshot?.(take);
  };
  if (!host?.ready) return Promise.resolve({ data: host?.data, keep });
  return new Promise((resolve) => {
    // Start without a snapshot rather than not at all if the viewer never answers.
    const timer = setTimeout(() => {
      resolve({ data: undefined, keep });
    }, waitMs);
    host.ready?.((data) => {
      clearTimeout(timer);
      resolve({ data, keep });
    });
  });
}
