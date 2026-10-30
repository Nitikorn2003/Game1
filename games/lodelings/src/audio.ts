import { webSound, type SoundRecipe } from '@game1/shell';
import type { Sound, SoundName } from './game.js';

/** The game's sound effects; `gap` keeps fast mining from turning into noise. */
const RECIPES: Record<SoundName, SoundRecipe> = {
  tap: {
    gap: 0.035,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 1800, 900, 0.05, 0.35);
      v.tone(t, 'sine', 150, 70, 0.07, 0.35);
    },
  },
  crit: {
    gap: 0.05,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 2400, 1200, 0.06, 0.4);
      v.tone(t, 'sine', 170, 60, 0.09, 0.45);
      v.tone(t, 'triangle', 1900, 1600, 0.12, 0.18);
    },
  },
  break: {
    gap: 0.09,
    play: (v, t) => {
      v.hiss(t, 'lowpass', 1400, 300, 0.18, 0.5);
      v.tone(t, 'sine', 110, 40, 0.16, 0.45);
    },
  },
  gem: {
    gap: 0.1,
    play: (v, t) => {
      v.tone(t, 'sine', 1320, 1320, 0.08, 0.2);
      v.tone(t + 0.07, 'sine', 1760, 1760, 0.14, 0.2);
    },
  },
  egg: {
    gap: 0.3,
    play: (v, t) => {
      v.tone(t, 'triangle', 520, 880, 0.16, 0.22);
    },
  },
  hatch: {
    gap: 0.5,
    play: (v, t) => {
      v.notes(t, [523, 659, 784, 1046], 0.08, 0.16, 0.2);
    },
  },
  guardian: {
    gap: 0.5,
    play: (v, t) => {
      v.tone(t, 'sawtooth', 90, 70, 0.45, 0.12);
      v.tone(t, 'sine', 60, 40, 0.5, 0.4);
    },
  },
  win: {
    gap: 0.5,
    play: (v, t) => {
      v.notes(t, [392, 523, 659, 784], 0.09, 0.2, 0.2);
      v.tone(t + 0.36, 'triangle', 1046, 1046, 0.4, 0.16);
    },
  },
  lose: {
    gap: 0.5,
    play: (v, t) => {
      v.tone(t, 'triangle', 330, 196, 0.45, 0.2);
    },
  },
  buy: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'square', 988, 988, 0.05, 0.06);
      v.tone(t + 0.05, 'square', 1319, 1319, 0.1, 0.06);
    },
  },
  skill: {
    gap: 0.15,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 400, 2600, 0.28, 0.4);
    },
  },
  claim: {
    gap: 0.12,
    play: (v, t) => {
      v.tone(t, 'sine', 880, 880, 0.3, 0.18);
      v.tone(t + 0.06, 'sine', 1320, 1320, 0.35, 0.14);
    },
  },
};

/** Sound effects synthesized with Web Audio, so the game ships no audio files. */
export function gameSound(): Sound {
  return webSound(RECIPES);
}
