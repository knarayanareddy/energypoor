/**
 * Server-side locale resolution, in two places and in this order:
 *
 *   1. `?lang=en` on the URL — always wins.
 *   2. the `vervolg-locale` cookie.
 *   3. Dutch.
 *
 * The parameter exists because **a cookie cannot be written from inside a
 * cross-site iframe**. Browsers that partition or block third-party storage
 * discard the write silently, so a cookie-only toggle appears to do nothing in
 * a preview proxy while working perfectly on localhost. The URL has no such
 * problem, and a language you can put in a link is also a language you can send
 * to a reviewer.
 *
 * A cookie, not a `[lang]` route prefix: the segments would double the route
 * table (9 screens → 18) and make every `Link` in the app locale-dependent —
 * a class of bug that only shows up when someone switches language mid-flow.
 *
 * Read on the server, so the first paint is already in the right language.
 * There is no flash of Dutch for an English reader.
 */
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, parseLocale, t, type DictKey, type Locale, type T } from "./dict";

/** The header `src/middleware.ts` sets from `?lang=`. */
const LANG_HEADER = "x-vervolg-lang";

/** Pages that accept `?lang=`. A dynamic page receives `searchParams`. */
type Search = { lang?: string | string[] } | undefined;

export async function getLocale(searchParams?: Search): Promise<Locale> {
  // 1. `?lang=` straight off the page's props (pages get searchParams).
  const fromUrl = searchParams?.lang;
  if (typeof fromUrl === "string" && fromUrl) return parseLocale(fromUrl);

  // 2. The same value lifted by the middleware, for readers that never receive
  //    searchParams — the layout's top bar and generateMetadata.
  const header = (await headers()).get(LANG_HEADER);
  if (header) return parseLocale(header);

  // 3. The remembered choice.
  const store = await cookies();
  return parseLocale(store.get(LOCALE_COOKIE)?.value);
}

/** `const { locale, t } = await getI18n({ searchParams })` — the call every
 *  server page makes. Passing the page's `searchParams` lets `?lang=` win. */
export async function getI18n(searchParams?: Search): Promise<{
  locale: Locale;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  other: Locale;
}> {
  const locale = await getLocale(searchParams);
  return {
    locale,
    t: (key, vars) => t(locale, key, vars),
    other: LOCALES.find((l) => l !== locale) ?? DEFAULT_LOCALE,
  };
}

export type { T };
