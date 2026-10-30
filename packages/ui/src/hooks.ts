import { useEffect, useReducer, useRef, useState } from 'preact/hooks';

/** Re-renders whenever `subscribe` reports a change. */
export function useSubscription(subscribe: (onChange: () => void) => () => void): void {
  const [, force] = useReducer((n: number, _: undefined) => n + 1, 0);
  useEffect(
    () =>
      subscribe(() => {
        force(undefined);
      }),
    [subscribe],
  );
}

/** The current time, refreshed every `intervalMs` while mounted. */
export function useNow(intervalMs: number, clock: () => number = Date.now): number {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const id = setInterval(() => {
      setNow(clock());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs, clock]);
  return now;
}

/**
 * Press-and-hold repeat for buy buttons: fires once on press, then faster and faster while
 * held. Returns pointer handlers to spread on the button.
 */
export function useHoldRepeat(action: () => unknown, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });
  const stop = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => stop, []);
  const start = (event: PointerEvent) => {
    if (!enabled || event.button > 0) return;
    stop();
    if (actionRef.current() === false) return;
    let delay = 380;
    const again = () => {
      timerRef.current = setTimeout(() => {
        if (actionRef.current() === false) return;
        delay = Math.max(60, delay * 0.8);
        again();
      }, delay);
    };
    again();
  };
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop };
}
