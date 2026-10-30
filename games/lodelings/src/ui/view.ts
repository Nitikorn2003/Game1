import { formatDuration, formatNumber } from '@game1/engine';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Game, HatchResult, ToastParam } from '../game.js';
import type { Locale, StringKey, T } from '../i18n/index.js';
import type { SpeciesId } from '../sim/content.js';
import type { GameState } from '../sim/state.js';

export type TabKey = 'upgrades' | 'lodelings' | 'eggs' | 'relics' | 'shop';
export type RewardsTab = 'daily' | 'quests' | 'achievements';

export type ModalState =
  | { kind: 'hatch'; result: HatchResult }
  | { kind: 'rewards'; tab: RewardsTab }
  | { kind: 'settings' }
  | { kind: 'lodeling'; id: SpeciesId }
  | { kind: 'resurface' }
  | { kind: 'privacy' };

/** How many levels or upgrades one press of a buy button buys. */
export type BuyAmount = 1 | 10 | 'max';

/** Screen state that is not part of the save. */
export interface Ui {
  open: (modal: ModalState | null) => void;
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  buyAmount: BuyAmount;
  setBuyAmount: (amount: BuyAmount) => void;
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
  const s = game.state;
  const units = { d: t('time.d'), h: t('time.h'), m: t('time.m'), s: t('time.s') };
  return {
    game,
    ui,
    s,
    t,
    locale,
    now: game.now(),
    day: game.today(),
    fmt: (value) => formatNumber(value, s.settings.numbers),
    time: (seconds) => formatDuration(seconds, units),
    tp: (key, params) => {
      if (!params) return t(key);
      const resolved: Record<string, string | number> = {};
      for (const [name, value] of Object.entries(params)) resolved[name] = typeof value === 'object' ? t(value.key) : value;
      return t(key, resolved);
    },
  };
}
