import { describe, expect, it } from 'vitest';
import { LOCALES, SHELL_EN, SHELL_TH, privacyPolicy, resolveLocale } from '../src/index.js';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).toSorted();

describe('the shell text', () => {
  it('has the same placeholders in Thai as in English', () => {
    const broken = Object.entries(SHELL_EN).filter(([key, text]) => placeholders(SHELL_TH[key as keyof typeof SHELL_EN]).join() !== placeholders(text).join());
    expect(broken.map(([key]) => key)).toEqual([]);
  });

  it('picks the device language when it is one of the games’, else English', () => {
    expect(resolveLocale('auto', ['th-TH', 'en-US'])).toBe('th');
    expect(resolveLocale('auto', ['de-DE'])).toBe('en');
    expect(resolveLocale('en', ['th-TH'])).toBe('en');
  });

  it('names the game in its privacy policy, with the same sections in every language', () => {
    const policy = privacyPolicy('Quiltwork', 'help@example.com');
    const ids = policy.en.map((s) => s.id);
    for (const locale of LOCALES) {
      expect(policy[locale].map((s) => s.id)).toEqual(ids);
      expect(policy[locale].find((s) => s.id === 'who')?.body).toContain('Quiltwork');
      expect(policy[locale].find((s) => s.id === 'who')?.body).toContain('help@example.com');
      expect(policy[locale].every((s) => s.heading !== '' && s.body !== '')).toBe(true);
    }
    expect(privacyPolicy('Quiltwork', '').en.find((s) => s.id === 'who')?.body).toContain('Google Play page');
  });
});
