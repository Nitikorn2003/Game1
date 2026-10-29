import { webSound, type SoundRecipe } from '@game1/shell';
import type { Sound, SoundName } from './game.js';

/** The game's sound effects; `gap` keeps fast tapping from turning into noise. */
const RECIPES: Record<SoundName, SoundRecipe> = {
  tap: {
    gap: 0.04,
    play: (v, t) => {
      v.tone(t, 'sine', 660, 990, 0.06, 0.25);
    },
  },
  buy: {
    gap: 0.05,
    play: (v, t) => {
      v.tone(t, 'square', 988, 988, 0.05, 0.06);
      v.tone(t + 0.05, 'square', 1319, 1319, 0.1, 0.06);
    },
  },
  claim: {
    gap: 0.12,
    play: (v, t) => {
      v.notes(t, [523, 659, 784], 0.07, 0.18, 0.18);
    },
  },
};

/** Sound effects synthesized with Web Audio, so the game ships no audio files. */
export function gameSound(): Sound {
  return webSound(RECIPES);
}
