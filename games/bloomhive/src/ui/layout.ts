import type { RefObject } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import { BOARD_HEIGHT, COLS } from '../sim/hive.js';

/** The size of an element's content box, kept up to date as the screen changes. */
export function useContentSize(ref: RefObject<HTMLElement>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const style = getComputedStyle(el);
      const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      setSize((old) => (old.width === width && old.height === height ? old : { width, height }));
    };
    measure();
    // Old WebViews have no ResizeObserver; there the window's size is all that changes.
    const Observer = (window as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (!Observer) {
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('resize', measure);
      };
    }
    const observer = new Observer(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The biggest and smallest a bud gets across, in pixels. */
const MAX_BUD = 56;
const MIN_BUD = 22;

/** The biggest whole-pixel buds with which the whole meadow, Pip's place included, fits the space. */
export function budSize(space: { width: number; height: number }): number {
  const fit = Math.floor(Math.min(space.width / COLS, space.height / BOARD_HEIGHT));
  return Math.max(MIN_BUD, Math.min(MAX_BUD, fit));
}
