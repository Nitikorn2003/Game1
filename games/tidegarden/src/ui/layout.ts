import type { RefObject } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';

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

/** The biggest and smallest a cell of the board gets, in pixels. */
const MAX_CELL = 64;
const MIN_CELL = 26;

/** The biggest whole-pixel cells that fit the whole board in the space. */
export function cellSize(space: { width: number; height: number }, width: number, height: number): number {
  const fit = Math.floor(Math.min(space.width / width, space.height / height));
  return Math.max(MIN_CELL, Math.min(MAX_CELL, fit));
}
