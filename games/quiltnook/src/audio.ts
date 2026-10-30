import { webSound, type SoundRecipe } from '@game1/shell';
import type { Sound, SoundName } from './game.js';

/** Soft sewing-room sounds; `gap` keeps quick play from turning into noise. */
const RECIPES: Record<SoundName, SoundRecipe> = {
  pick: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'sine', 880, 1180, 0.05, 0.1);
    },
  },
  place: {
    gap: 0.05,
    play: (v, t) => {
      v.hiss(t, 'lowpass', 900, 250, 0.07, 0.22);
      v.tone(t, 'sine', 240, 170, 0.09, 0.22);
    },
  },
  // A quick run of stitches.
  seam: {
    gap: 0.08,
    play: (v, t) => {
      for (let i = 0; i < 4; i++) v.hiss(t + i * 0.045, 'bandpass', 2600, 3400, 0.03, 0.22);
      v.tone(t, 'triangle', 523, 784, 0.22, 0.12);
    },
  },
  perfect: {
    gap: 0.15,
    play: (v, t) => {
      for (let i = 0; i < 4; i++) v.hiss(t + i * 0.045, 'bandpass', 2600, 3400, 0.03, 0.18);
      v.notes(t + 0.05, [784, 988, 1175, 1568], 0.07, 0.18, 0.16);
    },
  },
  cleared: {
    gap: 0.4,
    play: (v, t) => {
      v.notes(t, [523, 659, 784, 1046, 1318], 0.08, 0.25, 0.18);
      v.tone(t + 0.42, 'sine', 1568, 1568, 0.5, 0.1);
    },
  },
  stuck: {
    gap: 0.5,
    play: (v, t) => {
      v.tone(t, 'triangle', 392, 262, 0.45, 0.16);
    },
  },
  // Two closes of a pair of scissors.
  snip: {
    gap: 0.15,
    play: (v, t) => {
      v.hiss(t, 'highpass', 4000, 3000, 0.035, 0.25);
      v.hiss(t + 0.09, 'highpass', 4200, 3200, 0.035, 0.25);
    },
  },
  buy: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'sine', 988, 988, 0.06, 0.12);
      v.tone(t + 0.06, 'sine', 1319, 1319, 0.12, 0.12);
    },
  },
  claim: {
    gap: 0.12,
    play: (v, t) => {
      v.notes(t, [659, 880, 1046], 0.07, 0.2, 0.16);
    },
  },
};

/** Sound effects synthesized with Web Audio, so the game ships no audio files. */
export function gameSound(): Sound {
  return webSound(RECIPES);
}
