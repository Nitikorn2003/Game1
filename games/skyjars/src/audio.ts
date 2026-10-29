import { webSound, type SoundRecipe } from '@game1/shell';
import type { Sound, SoundName } from './game.js';

/** Glassy night sounds: soft chimes and pours. `gap` keeps quick play from turning into noise. */
const RECIPES: Record<SoundName, SoundRecipe> = {
  // A jar lifted: a light clink of glass.
  pick: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'sine', 1568, 1568, 0.08, 0.08);
      v.tone(t, 'sine', 2350, 2350, 0.05, 0.04);
    },
  },
  // Starlight sliding down: a falling shimmer.
  pour: {
    gap: 0.06,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 3200, 1400, 0.16, 0.08);
      v.tone(t, 'sine', 988, 660, 0.16, 0.1);
    },
  },
  // A jar full of one colour rings like a bell.
  fill: {
    gap: 0.12,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 3200, 1400, 0.12, 0.06);
      v.tone(t + 0.05, 'sine', 1319, 1319, 0.5, 0.12);
      v.tone(t + 0.05, 'sine', 1976, 1976, 0.35, 0.05);
    },
  },
  solved: {
    gap: 0.5,
    play: (v, t) => {
      v.notes(t, [784, 988, 1175, 1568, 1976], 0.09, 0.3, 0.14);
      v.tone(t + 0.5, 'sine', 2637, 2637, 0.7, 0.05);
    },
  },
  // Not allowed: a soft low knock.
  nope: {
    gap: 0.15,
    play: (v, t) => {
      v.tone(t, 'sine', 220, 180, 0.1, 0.14);
    },
  },
  undo: {
    gap: 0.08,
    play: (v, t) => {
      v.tone(t, 'sine', 660, 988, 0.12, 0.08);
    },
  },
  stuck: {
    gap: 0.5,
    play: (v, t) => {
      v.tone(t, 'triangle', 392, 294, 0.45, 0.12);
    },
  },
  // A wand: a quick rising sparkle.
  hint: {
    gap: 0.2,
    play: (v, t) => {
      v.notes(t, [1319, 1760, 2349], 0.05, 0.12, 0.08);
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
      v.notes(t, [784, 1046, 1319], 0.07, 0.2, 0.14);
    },
  },
};

/** Sound effects synthesized with Web Audio, so the game ships no audio files. */
export function gameSound(): Sound {
  return webSound(RECIPES);
}
