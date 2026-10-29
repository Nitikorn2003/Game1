import { useEffect, useRef } from 'preact/hooks';

/** Returns true when it handled the back press. */
export type BackHandler = () => boolean;

const handlers: { current: BackHandler }[] = [];

/**
 * The Android back button. The newest handler gets the press: a modal closes, and a modal that
 * needs an answer keeps it. False when nothing took it, so the app can go to the background.
 */
export function handleBack(): boolean {
  const top = handlers.at(-1);
  return top ? top.current() : false;
}

/** Adds a handler ahead of the ones added before it. Call the result to remove it. */
export function pushBackHandler(handler: BackHandler): () => void {
  const entry = { current: handler };
  handlers.push(entry);
  return () => {
    const at = handlers.indexOf(entry);
    if (at >= 0) handlers.splice(at, 1);
  };
}

/** While the component is mounted, the back button calls `handler` first. */
export function useBackHandler(handler: BackHandler): void {
  const latestRef = useRef(handler);
  useEffect(() => {
    latestRef.current = handler;
  });
  // Registered once, so a screen that re-renders keeps its place under the ones opened after it.
  useEffect(() => pushBackHandler(() => latestRef.current()), []);
}

/** Escape works like the back button, for keyboards. Call the result to stop. */
export function escapeGoesBack(target: EventTarget = window): () => void {
  const onKey = (e: Event) => {
    if ((e as KeyboardEvent).key === 'Escape' && handleBack()) e.preventDefault();
  };
  target.addEventListener('keydown', onKey);
  return () => {
    target.removeEventListener('keydown', onKey);
  };
}
