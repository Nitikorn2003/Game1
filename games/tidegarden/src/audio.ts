import { webSound, type SoundRecipe } from '@game1/shell';
import type { Sound, SoundName } from './game.js';

/**
 * Water and bubbles, and a marimba in a bright major scale. `gap` keeps quick moves and long
 * cascades from turning into noise.
 */
const RECIPES: Record<SoundName, SoundRecipe> = {
  // Two pieces trading places: a soft swish through the water.
  swap: {
    gap: 0.05,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 700, 1500, 0.12, 0.06);
    },
  },
  // A swap that does nothing: a dull bump, and back.
  nope: {
    gap: 0.15,
    play: (v, t) => {
      v.tone(t, 'sine', 196, 165, 0.12, 0.1);
      v.hiss(t, 'lowpass', 600, 300, 0.08, 0.05);
    },
  },
  // A match: bubbles popping, and a marimba note.
  match: {
    gap: 0.08,
    play: (v, t) => {
      v.tone(t, 'sine', 660, 990, 0.06, 0.09);
      v.tone(t + 0.04, 'sine', 880, 1320, 0.05, 0.06);
      v.notes(t + 0.02, [784, 988], 0.06, 0.14, 0.07);
    },
  },
  // A wave, a bomb or a pearl: a rush of water and a run up.
  special: {
    gap: 0.15,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 400, 2400, 0.35, 0.08);
      v.notes(t + 0.04, [659, 784, 988, 1319], 0.05, 0.16, 0.08);
    },
  },
  // A baby turtle reaches the sea: a happy chirp and a splash.
  save: {
    gap: 0.3,
    play: (v, t) => {
      v.tone(t, 'sine', 1047, 1568, 0.1, 0.08);
      v.tone(t + 0.12, 'sine', 1319, 1976, 0.1, 0.07);
      v.hiss(t + 0.2, 'highpass', 1800, 900, 0.25, 0.06);
    },
  },
  // The goals reached: a run up the scale, and a chime.
  won: {
    gap: 0.6,
    play: (v, t) => {
      v.notes(t, [523, 659, 784, 1047, 1319, 1568], 0.07, 0.28, 0.12);
      v.tone(t + 0.5, 'sine', 2093, 2093, 1, 0.05);
    },
  },
  // A dive ended without its goals: two falling notes.
  lost: {
    gap: 0.5,
    play: (v, t) => {
      v.tone(t, 'triangle', 392, 349, 0.3, 0.1);
      v.tone(t + 0.28, 'triangle', 330, 262, 0.45, 0.09);
    },
  },
  // A tool from the bag: a snap, and the water rushing in.
  tool: {
    gap: 0.2,
    play: (v, t) => {
      v.tone(t, 'square', 880, 440, 0.05, 0.04);
      v.hiss(t + 0.03, 'bandpass', 2000, 500, 0.3, 0.08);
    },
  },
  // Sand dollars counted out.
  buy: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'sine', 1568, 1568, 0.07, 0.07);
      v.tone(t + 0.06, 'sine', 2093, 2093, 0.08, 0.06);
    },
  },
  claim: {
    gap: 0.12,
    play: (v, t) => {
      v.notes(t, [784, 1047, 1319], 0.07, 0.2, 0.14);
    },
  },
};

/** Sound effects synthesized with Web Audio, so the game ships no audio files. */
export function gameSound(): Sound {
  return webSound(RECIPES);
}
