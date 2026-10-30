import { webSound, type SoundRecipe } from '@game1/shell';
import type { Sound, SoundName } from './game.js';

/**
 * Cards on a wooden boat, and runs on a ranat, the Thai xylophone, in its five-note scale.
 * `gap` keeps quick play from turning into noise.
 */
const RECIPES: Record<SoundName, SoundRecipe> = {
  // A card laid on the pile: a soft slap and a wooden tock.
  play: {
    gap: 0.04,
    play: (v, t) => {
      v.hiss(t, 'highpass', 2600, 1800, 0.05, 0.12);
      v.tone(t, 'sine', 660, 620, 0.09, 0.1);
    },
  },
  // The fifth card in a row: a quick run up the ranat.
  streak: {
    gap: 0.1,
    play: (v, t) => {
      v.hiss(t, 'highpass', 2600, 1800, 0.05, 0.1);
      v.notes(t, [784, 880, 1046, 1175], 0.055, 0.16, 0.13);
    },
  },
  // A card slid off the stock.
  draw: {
    gap: 0.05,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 1900, 900, 0.11, 0.1);
    },
  },
  // A covered card turned face up.
  flip: {
    gap: 0.05,
    play: (v, t) => {
      v.hiss(t + 0.12, 'highpass', 3200, 2400, 0.03, 0.07);
      v.tone(t + 0.12, 'sine', 1397, 1397, 0.05, 0.04);
    },
  },
  // Not allowed: a soft knock on wood.
  nope: {
    gap: 0.15,
    play: (v, t) => {
      v.tone(t, 'sine', 262, 196, 0.1, 0.14);
    },
  },
  // The lotus wild: a little gong and a shimmer.
  wild: {
    gap: 0.3,
    play: (v, t) => {
      v.tone(t, 'sine', 523, 520, 0.8, 0.12);
      v.tone(t, 'sine', 1046, 1040, 0.5, 0.05);
      v.notes(t + 0.05, [1175, 1397, 1568], 0.06, 0.18, 0.07);
    },
  },
  won: {
    gap: 0.5,
    play: (v, t) => {
      v.notes(t, [523, 587, 659, 784, 880, 1046], 0.07, 0.24, 0.13);
      v.tone(t + 0.45, 'sine', 1568, 1568, 0.8, 0.06);
    },
  },
  lost: {
    gap: 0.5,
    play: (v, t) => {
      v.tone(t, 'triangle', 392, 330, 0.3, 0.12);
      v.tone(t + 0.28, 'triangle', 294, 262, 0.45, 0.1);
    },
  },
  // A card lifted back off the pile.
  undo: {
    gap: 0.08,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 900, 1800, 0.1, 0.07);
      v.tone(t, 'sine', 660, 880, 0.1, 0.06);
    },
  },
  // Coins counted out.
  buy: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'sine', 1568, 1568, 0.06, 0.1);
      v.tone(t + 0.06, 'sine', 2093, 2093, 0.12, 0.1);
    },
  },
  claim: {
    gap: 0.12,
    play: (v, t) => {
      v.notes(t, [784, 1046, 1319], 0.07, 0.2, 0.14);
    },
  },
};

/** Sound effects synthesized with Web Audio, so the game ships no audio files. */
export function gameSound(): Sound {
  return webSound(RECIPES);
}
