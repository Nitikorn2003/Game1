import { webSound, type SoundRecipe } from '@game1/shell';
import type { Sound, SoundName } from './game.js';

/**
 * A warm little bakery: soft wooden taps on the counter, the rustle of a paper box and a shop
 * bell, music-box notes in a sunny major scale. `gap` keeps quick tapping from turning into noise.
 */
const RECIPES: Record<SoundName, SoundRecipe> = {
  // A pastry set down on the tray: a soft wooden tap.
  take: {
    gap: 0.04,
    play: (v, t) => {
      v.tone(t, 'triangle', 520, 440, 0.06, 0.07);
      v.hiss(t, 'bandpass', 1800, 1400, 0.03, 0.03);
    },
  },
  // Three boxed up: the box folds shut, and two bright notes.
  set: {
    gap: 0.08,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 900, 2600, 0.09, 0.05);
      v.notes(t + 0.05, [784, 1175], 0.07, 0.18, 0.08);
    },
  },
  // Sprinkled pastries boxed up: the box, and a shimmer of sugar.
  sprinkle: {
    gap: 0.1,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 900, 2600, 0.09, 0.05);
      v.notes(t + 0.04, [1047, 1319, 1568, 2093], 0.04, 0.14, 0.06);
    },
  },
  // A ribbon box opens: a pull of ribbon and a rising chime.
  open: {
    gap: 0.2,
    play: (v, t) => {
      v.hiss(t, 'highpass', 2400, 4200, 0.18, 0.04);
      v.notes(t + 0.06, [659, 880, 1319], 0.06, 0.2, 0.08);
    },
  },
  // The tray is full: a low thump and a little worried bell.
  full: {
    gap: 0.4,
    play: (v, t) => {
      v.tone(t, 'sine', 150, 110, 0.22, 0.12);
      v.tone(t + 0.12, 'triangle', 622, 587, 0.3, 0.05);
    },
  },
  // The spatula scrapes a pastry back.
  spatula: {
    gap: 0.15,
    play: (v, t) => {
      v.hiss(t, 'bandpass', 3200, 1600, 0.16, 0.05);
      v.tone(t + 0.06, 'triangle', 440, 330, 0.1, 0.06);
    },
  },
  // The rolling pin rolls the counter: a wooden rumble back and forth.
  rollingpin: {
    gap: 0.3,
    play: (v, t) => {
      v.hiss(t, 'lowpass', 500, 900, 0.22, 0.08);
      v.hiss(t + 0.22, 'lowpass', 900, 500, 0.22, 0.08);
      v.notes(t + 0.3, [523, 659, 784], 0.05, 0.14, 0.05);
    },
  },
  // The whisk whips up a set: a whirr, and the box.
  whisk: {
    gap: 0.3,
    play: (v, t) => {
      v.tone(t, 'sawtooth', 180, 420, 0.24, 0.025);
      v.hiss(t, 'bandpass', 1200, 3400, 0.24, 0.05);
      v.notes(t + 0.26, [784, 1175], 0.07, 0.18, 0.08);
    },
  },
  // Pastries up to the cooling rack: the clink of a wire rack.
  room: {
    gap: 0.3,
    play: (v, t) => {
      v.tone(t, 'sine', 1760, 1700, 0.12, 0.05);
      v.tone(t + 0.07, 'sine', 2349, 2300, 0.14, 0.04);
      v.tone(t + 0.14, 'sine', 1976, 1900, 0.16, 0.04);
    },
  },
  // Nothing to take there: a dull little knock.
  nope: {
    gap: 0.15,
    play: (v, t) => {
      v.tone(t, 'sine', 196, 165, 0.1, 0.08);
    },
  },
  // The counter cleared: the shop bell and a run up the scale.
  won: {
    gap: 0.6,
    play: (v, t) => {
      v.tone(t, 'sine', 2093, 2093, 0.5, 0.05);
      v.tone(t + 0.04, 'sine', 2637, 2637, 0.45, 0.03);
      v.notes(t + 0.12, [523, 659, 784, 1047, 1319, 1568], 0.07, 0.26, 0.1);
    },
  },
  // A round ended with the counter not cleared: two falling notes.
  lost: {
    gap: 0.5,
    play: (v, t) => {
      v.tone(t, 'triangle', 440, 392, 0.3, 0.09);
      v.tone(t + 0.28, 'triangle', 349, 294, 0.45, 0.08);
    },
  },
  // Sugar counted out.
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
