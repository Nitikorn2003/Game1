import { afterEach, describe, expect, it, vi } from 'vitest';
import { hotSwap } from '../src/hotswap.js';

const host = globalThis as { claude?: unknown };

afterEach(() => {
  delete host.claude;
  vi.useRealTimers();
});

describe('hotSwap', () => {
  it('has nothing to carry over outside the artifact viewer', async () => {
    const swap = await hotSwap();
    expect(swap.data).toBeUndefined();
    expect(() => {
      swap.keep(() => 1);
    }).not.toThrow();
  });

  it('starts from what the viewer hands over and registers the next snapshot', async () => {
    let take: (() => unknown) | undefined;
    host.claude = {
      hot: {
        ready: (start: (data: unknown) => void) => setTimeout(() => {
          start({ save: 'abc' });
        }, 5),
        snapshot: (t: () => unknown) => {
          take = t;
        },
      },
    };
    const swap = await hotSwap();
    expect(swap.data).toEqual({ save: 'abc' });
    swap.keep(() => ({ save: 'xyz' }));
    expect(take?.()).toEqual({ save: 'xyz' });
  });

  it('reads the data directly when the viewer has no ready hook', async () => {
    host.claude = { hot: { data: { save: 'abc' } } };
    expect((await hotSwap()).data).toEqual({ save: 'abc' });
  });

  it('starts anyway if the viewer never answers', async () => {
    vi.useFakeTimers();
    host.claude = { hot: { ready: () => undefined } };
    const swap = hotSwap(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await swap).data).toBeUndefined();
  });
});
