import { formatDuration, formatNumber } from '@game1/engine';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Game, ToastParam } from '../game.js';
import type { Locale, StringKey, T } from '../i18n/index.js';
import type { Buddy, Tool, Water } from '../sim/content.js';
import type { ZoneId } from '../sim/levels.js';
import * as R from '../sim/rules.js';
import type { GameState } from '../sim/state.js';

export type Screen = { kind: 'home' } | { kind: 'play' };

export type ModalState =
  | { kind: 'shop' }
  | { kind: 'settings' }
  | { kind: 'privacy' }
  | { kind: 'looks' }
  | { kind: 'rules' }
  | { kind: 'zone'; zone: ZoneId }
  | { kind: 'results' }
  | { kind: 'stuck' }
  | { kind: 'tool'; tool: Tool };

/** Screen state that is not part of the save. */
export interface Ui {
  screen: Screen;
  go: (screen: Screen) => void;
  open: (modal: ModalState | null) => void;
  /** False when the browser keeps nothing between visits. */
  persistent: boolean;
  version: string;
}

/** Everything a screen needs for one render: the game, its state and the formatters. */
export interface View {
  game: Game;
  ui: Ui;
  s: GameState;
  t: T;
  locale: Locale;
  now: number;
  day: string;
  /** The looks the reef is drawn in. */
  water: Water;
  buddy: Buddy;
  fmt: (value: number) => string;
  time: (seconds: number) => string;
  /** Translates toast-style parameters, where a parameter may itself be a string key. */
  tp: (key: StringKey, params?: Readonly<Record<string, ToastParam>>) => string;
}

export const ViewContext = createContext<View | null>(null);

export function useView(): View {
  const view = useContext(ViewContext);
  if (!view) throw new Error('useView needs a ViewContext provider');
  return view;
}

export function makeView(game: Game, ui: Ui, t: T, locale: Locale): View {
  const units = { d: t('time.d'), h: t('time.h'), m: t('time.m'), s: t('time.s') };
  return {
    game,
    ui,
    s: game.state,
    t,
    locale,
    now: game.now(),
    day: game.today(),
    water: R.waterInUse(game.state),
    buddy: R.buddyInUse(game.state),
    // Sand dollars read better in full: 1,240 rather than 1.24K.
    fmt: (value) => (Math.abs(value) < 1_000_000 ? Math.round(value).toLocaleString('en-US') : formatNumber(value, 'short')),
    time: (seconds) => formatDuration(seconds, units),
    tp: (key, params) => {
      if (!params) return t(key);
      const resolved: Record<string, string | number> = {};
      for (const [name, value] of Object.entries(params)) resolved[name] = typeof value === 'object' ? t(value.key) : value;
      return t(key, resolved);
    },
  };
}
