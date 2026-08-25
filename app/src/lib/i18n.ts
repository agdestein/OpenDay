// Tiny i18n layer. No library: each module owns its own strings as a
// `Localized<...>` record, and TypeScript guarantees every language is
// complete (a missing translation is a compile error, not a runtime fallback).
//
// English is the source language; Dutch is the event language (`?lang=nl` on
// the stand machines); Norwegian exists for playtesting.

export type Lang = 'en' | 'nl' | 'no';

export const LANGS: Lang[] = ['en', 'nl', 'no'];

/** Per-language variants of a value: a string, a message function, a chapter list... */
export type Localized<T> = Record<Lang, T>;

export const LANG_LABELS: Localized<string> = { en: 'English', nl: 'Nederlands', no: 'Norsk' };

const STORAGE_KEY = 'arcade-lang';

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as string[]).includes(value);
}

function initialLang(): Lang {
  // URL param is the per-machine default at the stand; localStorage remembers
  // an in-session switch across reloads; English otherwise.
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (isLang(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Storage blocked: fall through.
  }
  return 'en';
}

let current: Lang = initialLang();
document.documentElement.lang = current;

export function getLang(): Lang {
  return current;
}

/** Screens created after this call render in the new language (menu re-renders itself). */
export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage blocked: the choice just doesn't survive a reload.
  }
}

/** The current language's variant of a localized value. */
export function pick<T>(localized: Localized<T>): T {
  return localized[current];
}

/** Locale-aware number formatting (nl and no use the decimal comma). */
export function fmtNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(current === 'en' ? 'en-GB' : current, options);
}
