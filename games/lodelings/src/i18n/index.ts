import { createTranslator, type Params, type Translator } from '@game1/engine';
import type { Locale } from '@game1/shell';
import { en, type StringKey } from './en.js';
import { th } from './th.js';

export { LOCALES, resolveLocale, type Locale } from '@game1/shell';
export type { StringKey };

const TABLES: Record<Locale, Partial<Record<StringKey, string>>> = { en: {}, th };

export function translator(locale: Locale): Translator<StringKey> {
  return createTranslator<StringKey>(en, TABLES[locale], locale);
}

export type T = (key: StringKey, params?: Params) => string;
