import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en.js';
import { th } from '../src/i18n/th.js';
import { ALBUM_IDS, PICTURES } from '../src/sim/fields.js';

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

describe('the names of the pictures and the albums', () => {
  const languages: Record<string, Partial<Record<string, string>>> = { en, th: { ...en, ...th } };

  it('are all there, and no two alike, in every language', () => {
    for (const [language, table] of Object.entries(languages)) {
      for (const [prefix, ids] of [
        ['picture', PICTURES.map((picture) => picture.id)],
        ['album', ALBUM_IDS],
        ['lore', ALBUM_IDS],
      ] as const) {
        const names = ids.map((id) => table[`${prefix}.${id}`] ?? '');
        expect(names.filter((name) => name.trim() === ''), `${language} ${prefix}`).toEqual([]);
        expect(new Set(names).size, `${language} ${prefix}`).toBe(ids.length);
      }
    }
  });
});
