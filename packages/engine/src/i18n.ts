export type Params = Readonly<Record<string, string | number>>;

export interface Translator<K extends string> {
  readonly locale: string;
  t(key: K, params?: Params): string;
}

/**
 * Looks strings up in the locale's table, falling back to the base (English) table.
 * `{name}` in a string is replaced by params.name.
 */
export function createTranslator<K extends string>(
  base: Readonly<Record<K, string>>,
  table: Readonly<Partial<Record<K, string>>>,
  locale: string,
): Translator<K> {
  return {
    locale,
    t(key, params) {
      const template = table[key] ?? base[key];
      if (params === undefined) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = params[name];
        return value === undefined ? match : String(value);
      });
    },
  };
}

/** The best supported locale for the device's languages; "th-TH" matches "th". */
export function matchLocale(preferred: readonly string[], supported: readonly string[], fallback: string): string {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const exact = supported.find((s) => s.toLowerCase() === lower);
    if (exact !== undefined) return exact;
    const language = lower.split('-')[0];
    const partial = supported.find((s) => s.toLowerCase() === language);
    if (partial !== undefined) return partial;
  }
  return fallback;
}
