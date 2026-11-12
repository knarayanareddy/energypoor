import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, parseLocale, type Locale } from "@/i18n/dict";

/**
 * Make `?lang=` visible to parts of the app that never receive `searchParams`.
 *
 * A page gets `searchParams`; a **layout** does not, and `generateMetadata`
 * does not either. The top bar and the tab title live there, so a cookie-only
 * or page-only language selection renders the chrome in Dutch above English
 * content — and a cookie cannot be written at all when the app is framed
 * cross-site. So the middleware lifts the parameter into a request header, and
 * `getLocale()` prefers it. One value, three readers, no duplication.
 *
 * The `Set-Cookie` here is the persistence half: when storage is allowed it
 * keeps the choice across plain link navigation. When storage is blocked this
 * is silently dropped — which is precisely why the URL carries the language and
 * the cookie is only an optimisation.
 *
 * The third source is the `Referer`. With storage blocked and no parameter on
 * the href, clicking a plain `<Link>` would otherwise drop back to Dutch, so a
 * reader who switched once would lose English on their very next click. The
 * referring page still carries `?lang=en`, so the choice is forwarded. It is
 * weaker than a parameter (a bookmark, a typed URL or a fresh tab starts in
 * Dutch again) and that is acceptable: a language is remembered per visit, not
 * inferred about the reader.
 */
export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const requested = url.searchParams.get("lang");

  const headers = new Headers(req.headers);
  const resolved = requested
    ? parseLocale(requested)
    : localeFromReferer(req.headers.get("referer"));

  if (resolved) {
    // An explicit URL value, or one carried in by a link from a page that had
    // it. Recorded as a header so every reader — layout, metadata, page —
    // resolves the same language.
    headers.set("x-vervolg-lang", resolved);
  }

  const res = NextResponse.next({ request: { headers } });
  if (resolved) {
    res.cookies.set(LOCALE_COOKIE, resolved, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return res;
}

/** The `lang` of the page that linked here, or null when it cannot be read. */
function localeFromReferer(referer: string | null): Locale | null {
  if (!referer) return null;
  try {
    const value = new URL(referer).searchParams.get("lang");
    // `parseLocale` defaults to Dutch, which is right for the app and wrong
    // here: a referrer with no usable value must not be treated as a choice.
    return isLocale(value) ? value : null;
  } catch {
    return null; // a malformed Referer is not an error worth failing the page over
  }
}

export const config = {
  // Everything except Next's own asset routes and the API. The API reads the
  // cookie itself (a refusal is never worth a redirect), and static files have
  // no language.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
