import { bool, isRecord, matchLocale, oneOf } from '@game1/engine';

/** The languages every game ships in. */
export const LOCALES = ['en', 'th'] as const;
export type Locale = (typeof LOCALES)[number];
/** The player's choice of language: one of the game's, or the device's. */
export type LocaleSetting = 'auto' | Locale;
const LOCALE_SETTINGS: readonly LocaleSetting[] = ['auto', ...LOCALES];

export function resolveLocale(setting: LocaleSetting, deviceLanguages: readonly string[]): Locale {
  if (setting !== 'auto') return setting;
  return matchLocale(deviceLanguages, LOCALES, 'en') as Locale;
}

/** The settings every game has, kept in its save as part of `state.settings`. */
export interface ShellSettings {
  sound: boolean;
  haptics: boolean;
  locale: LocaleSetting;
}

export function createSettings(): ShellSettings {
  return { sound: true, haptics: true, locale: 'auto' };
}

export function restoreSettings(data: unknown): ShellSettings {
  const settings = isRecord(data) ? data : {};
  return {
    sound: bool(settings.sound, true),
    haptics: bool(settings.haptics, true),
    locale: oneOf(settings.locale, LOCALE_SETTINGS, 'auto'),
  };
}
