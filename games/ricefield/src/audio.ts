import { webSound, type SoundRecipe } from '@game1/shell';
import type { Sound, SoundName } from './game.js';

/**
 * Wet mud and paddy water, and a bamboo xylophone (the angklung's notes) in a five-note scale.
 * `gap` keeps a quick drag across a row from turning into noise.
 */
const RECIPES: Record<SoundName, SoundRecipe> = {
  // A seedling pushed into the mud: a soft squelch and a low wooden note.
  plant: {
    gap: 0.035,
    play: (v, t) => {
      v.hiss(t, 'lowpass', 900, 300, 0.07, 0.12);
      v.tone(t, 'sine', 392, 349, 0.08, 0.08);
    },
  },
  // A pebble set down in the water: a light plip.
  pebble: {
    gap: 0.035,
    play: (v, t) => {
      v.tone(t, 'sine', 1046, 1568, 0.05, 0.07);
      v.hiss(t + 0.02, 'bandpass', 2400, 1600, 0.05, 0.04);
    },
  },
  // A wrong move: a dull knock and a drop.
  mistake: {
    gap: 0.2,
    play: (v, t) => {
      v.tone(t, 'triangle', 233, 175, 0.22, 0.13);
      v.hiss(t, 'lowpass', 500, 200, 0.12, 0.08);
    },
  },
  // A row or column finished: three bamboo notes up.
  line: {
    gap: 0.12,
    play: (v, t) => {
      v.hiss(t, 'lowpass', 900, 300, 0.06, 0.08);
      v.notes(t + 0.02, [784, 880, 1175], 0.055, 0.16, 0.1);
    },
  },
  // The picture grows in: a run up the scale, and a bell.
  grown: {
    gap: 0.6,
    play: (v, t) => {
      v.notes(t, [523, 587, 659, 784, 880, 1046, 1175], 0.075, 0.26, 0.12);
      v.tone(t + 0.55, 'sine', 1568, 1568, 1, 0.06);
      v.tone(t + 0.55, 'sine', 2093, 2093, 0.7, 0.03);
    },
  },
  // A hint: a lantern lit, with a shimmer.
  hint: {
    gap: 0.25,
    play: (v, t) => {
      v.tone(t, 'sine', 880, 1320, 0.25, 0.06);
      v.notes(t + 0.08, [1175, 1397, 1760], 0.06, 0.18, 0.06);
    },
  },
  // The last heart gone: two falling notes.
  wilt: {
    gap: 0.5,
    play: (v, t) => {
      v.tone(t, 'triangle', 392, 330, 0.3, 0.12);
      v.tone(t + 0.28, 'triangle', 294, 247, 0.45, 0.1);
    },
  },
  // Seeds poured out.
  buy: {
    gap: 0.05,
    play: (v, t) => {
      v.hiss(t, 'highpass', 3000, 5000, 0.12, 0.06);
      v.tone(t + 0.03, 'sine', 1568, 1568, 0.08, 0.08);
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
