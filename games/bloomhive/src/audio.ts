import { webSound, type SoundRecipe } from '@game1/shell';
import type { Sound, SoundName } from './game.js';

/**
 * A summer meadow: soft puffs of air, wooden plinks like a kalimba in a sunny pentatonic
 * scale, and the hum of bees. `gap` keeps quick shots and big falls from turning into noise.
 */
const RECIPES: Record<SoundName, SoundRecipe> = {
  // Pip throws the pollen: a soft puff.
  shoot: {
    gap: 0.06,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 900, 2200, 0.1, 0.06);
      v.tone(t, 'sine', 330, 520, 0.08, 0.04);
    },
  },
  // It sticks without a pop: a little wooden knock.
  stick: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'triangle', 392, 330, 0.07, 0.07);
    },
  },
  // Buds pop: two kalimba notes and a breath of petals.
  pop: {
    gap: 0.08,
    play: (v, t) => {
      v.notes(t, [784, 1047], 0.06, 0.16, 0.08);
      v.hiss(t + 0.02, 'highpass', 2600, 1800, 0.12, 0.04);
    },
  },
  // A baby bee flies free: a little buzz up, and a chime.
  bee: {
    gap: 0.25,
    play: (v, t) => {
      v.tone(t, 'sawtooth', 220, 330, 0.22, 0.025);
      v.notes(t + 0.08, [880, 1175, 1568], 0.06, 0.2, 0.08);
    },
  },
  // The nectar jar is full: a glug, and a bright bell.
  jar: {
    gap: 0.4,
    play: (v, t) => {
      v.tone(t, 'sine', 196, 392, 0.18, 0.09);
      v.tone(t + 0.16, 'sine', 1568, 1568, 0.5, 0.06);
    },
  },
  // The pollen in hand swapped for the next: a flick.
  swap: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'sine', 660, 880, 0.06, 0.06);
    },
  },
  // Nothing to shoot: a dull bump.
  nope: {
    gap: 0.15,
    play: (v, t) => {
      v.tone(t, 'sine', 196, 165, 0.12, 0.08);
    },
  },
  // The goals reached: a run up the pentatonic scale, and a hum of happy bees.
  won: {
    gap: 0.6,
    play: (v, t) => {
      v.notes(t, [523, 587, 659, 784, 880, 1047, 1319], 0.07, 0.28, 0.11);
      v.tone(t + 0.3, 'sawtooth', 247, 262, 0.6, 0.02);
    },
  },
  // A round ended without its goals: two falling notes.
  lost: {
    gap: 0.5,
    play: (v, t) => {
      v.tone(t, 'triangle', 440, 392, 0.3, 0.09);
      v.tone(t + 0.28, 'triangle', 349, 294, 0.45, 0.08);
    },
  },
  // A tool from the pouch: a shimmer.
  tool: {
    gap: 0.2,
    play: (v, t) => {
      v.notes(t, [1319, 1568, 2093], 0.03, 0.12, 0.06);
      v.hiss(t, 'bandpass', 3000, 1200, 0.25, 0.05);
    },
  },
  // Honey counted out.
  buy: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'sine', 1319, 1319, 0.07, 0.07);
      v.tone(t + 0.06, 'sine', 1760, 1760, 0.08, 0.06);
    },
  },
  claim: {
    gap: 0.12,
    play: (v, t) => {
      v.notes(t, [784, 988, 1319], 0.07, 0.2, 0.13);
    },
  },
};

/** Sound effects synthesized with Web Audio, so the game ships no audio files. */
export function gameSound(): Sound {
  return webSound(RECIPES);
}
