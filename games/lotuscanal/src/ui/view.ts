import { formatDuration, formatNumber } from '@game1/engine';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Game, ToastParam } from '../game.js';
import type { Locale, StringKey, T } from '../i18n/index.js';
import { rankOf, RANK_LABELS, suitOf, WILD, type Card } from '../sim/cards.js';
import type { CardBack, Mode, Scene, Tool } from '../sim/content.js';
import * as R from '../sim/rules.js';
import type { GameState } from '../sim/state.js';

export type Screen = { kind: 'home' } | { kind: 'play'; mode: Mode };

export type ModalState =
  | { kind: 'shop' }
  | { kind: 'settings' }
  | { kind: 'privacy' }
  | { kind: 'map' }
  | { kind: 'looks' }
  | { kind: 'results' }
  | { kind: 'tool'; mode: Mode; tool: Tool };

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
  /** The look the cards and the canal are drawn in. */
  back: CardBack;
  scene: Scene;
  fmt: (value: number) => string;
  time: (seconds: number) => string;
  /** A card's name, for screen readers: "7 of fish". */
  cardName: (card: Card) => string;
  /** Translates toast-style parameters, where a parameter may itself be a string key. */
  tp: (key: StringKey, params?: Readonly<Record<string, ToastParam>>) => string;
}

export const ViewContext = createContext<View | null>(null);

export function useView(): View {
  const view = useContext(ViewContext);
  if (!view) throw new Error('useView needs a ViewContext provider');
  return view;
}

/** The ranks with a name of their own; the others are read as numbers. */
const RANK_NAMES: Readonly<Partial<Record<number, StringKey>>> = { 0: 'rank.ace', 10: 'rank.jack', 11: 'rank.queen', 12: 'rank.king' };

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
    back: R.backInUse(game.state),
    scene: R.sceneInUse(game.state),
    // Coins read better in full: 1,240 rather than 1.24K.
    fmt: (value) => (Math.abs(value) < 1_000_000 ? Math.round(value).toLocaleString('en-US') : formatNumber(value, 'short')),
    time: (seconds) => formatDuration(seconds, units),
    cardName: (card) => {
      if (card === WILD) return t('card.wild');
      const named = RANK_NAMES[rankOf(card)];
      return t('card.name', { rank: named ? t(named) : (RANK_LABELS[rankOf(card)] ?? ''), suit: t(`suit.${suitOf(card)}`) });
    },
    tp: (key, params) => {
      if (!params) return t(key);
      const resolved: Record<string, string | number> = {};
      for (const [name, value] of Object.entries(params)) resolved[name] = typeof value === 'object' ? t(value.key) : value;
      return t(key, resolved);
    },
  };
}
