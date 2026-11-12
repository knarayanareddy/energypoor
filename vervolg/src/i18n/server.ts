/**
 * Server-side locale resolution.
 *
 * A cookie, not a route prefix, for a specific reason: every page in this build
 * is already `force-dynamic` and reads JSON off disk on each request. Adding
 * `[lang]` segments would double the route table (9 screens → 18) and, worse,
 * make every `Link href="/household/HH-027"` in the app locale-dependent — a
 * class of bug that only shows up when someone switches language mid-flow.
 *
 * The cookie is read on the server so the first paint is in the right language.
 * There is no flash of Dutch for an English reader.
 */
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, parseLocale, t, type DictKey, type Locale, type T } from "./dict";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return parseLocale(store.get(LOCALE_COOKIE)?.value);
}

/** `const { locale, t } = await getI18n()` — the call every server page makes. */
export async function getI18n(): Promise<{
  locale: Locale;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  other: Locale;
}> {
  const locale = await getLocale();
  return {
    locale,
    t: (key, vars) => t(locale, key, vars),
    other: LOCALES.find((l) => l !== locale) ?? DEFAULT_LOCALE,
  };
}

export type { T };
