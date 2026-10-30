export interface Haptics {
  /** A short tick, e.g. a rock breaking. */
  light(): void;
  /** A strong bump, e.g. a Guardian falling. */
  heavy(): void;
}

/** Vibration through the browser (works in Android browsers and WebViews; iOS ignores it). */
export const webHaptics: Haptics = {
  light: () => {
    vibrate(12);
  },
  heavy: () => {
    vibrate([30, 40, 30]);
  },
};

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate(pattern);
  } catch {
    // Not supported here; haptics are optional.
  }
}

/** Calls `onHide` when the app goes to the background or the page is closed. */
export function onAppHidden(onHide: () => void): () => void {
  const visibility = () => {
    if (document.visibilityState === 'hidden') onHide();
  };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', onHide);
  return () => {
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', onHide);
  };
}

export function onAppVisible(onShow: () => void): () => void {
  const visibility = () => {
    if (document.visibilityState === 'visible') onShow();
  };
  document.addEventListener('visibilitychange', visibility);
  return () => {
    document.removeEventListener('visibilitychange', visibility);
  };
}
