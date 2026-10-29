import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en.js';
import { th } from '../src/i18n/th.js';

// The same in every language: the game's name.
const SAME_EVERYWHERE = ['app.title'];

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).toSorted();

describe('the Thai text', () => {
  it('translates every string', () => {
    const missing = Object.keys(en).filter((key) => !(key in th) && !SAME_EVERYWHERE.includes(key));
    expect(missing).toEqual([]);
  });

  it('keeps the placeholders of every string', () => {
    const table: Partial<Record<string, string>> = th;
    const broken = Object.entries(en).filter(([key, text]) => {
      const thai = table[key];
      return thai !== undefined && placeholders(thai).join() !== placeholders(text).join();
    });
    expect(broken.map(([key]) => key)).toEqual([]);
  });
});
