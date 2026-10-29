import { createTranslator, matchLocale, type Params, type Translator } from '@game1/engine';
import type { LocaleSetting } from '../sim/state.js';
import { en, type StringKey } from './en.js';
import { th } from './th.js';

export type { StringKey };
export const LOCALES = ['en', 'th'] as const;
export type Locale = (typeof LOCALES)[number];

const TABLES: Record<Locale, Partial<Record<StringKey, string>>> = { en: {}, th };

export function resolveLocale(setting: LocaleSetting, deviceLanguages: readonly string[]): Locale {
  if (setting !== 'auto') return setting;
  return matchLocale(deviceLanguages, LOCALES, 'en') as Locale;
}

export function translator(locale: Locale): Translator<StringKey> {
  return createTranslator<StringKey>(en, TABLES[locale], locale);
}

export type T = (key: StringKey, params?: Params) => string;
