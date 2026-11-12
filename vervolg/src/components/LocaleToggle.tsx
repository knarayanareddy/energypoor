"use client";

import { useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/i18n/dict";

/**
 * Switches the UI language.
 *
 * THE COOKIE ALONE IS NOT ENOUGH, and this component is the reason.
 *
 * A cookie cannot be written from a page served inside a cross-site iframe:
 * browsers that partition or block third-party storage silently discard the
 * write, `document.cookie` reads back empty, and the server therefore never
 * learns the choice. That is exactly what happened in the preview environment —
 * the app is proxied inside a frame, the toggle looked like it did nothing, and
 * the page stayed Dutch with no error anywhere. A local `localhost` test cannot
 * reproduce it because there the cookie is first-party.
 *
 * So the language also travels in the URL. `?lang=en` is read by the server on
 * every page, works inside any frame, survives a hard refresh, and makes the
 * chosen language something you can send to someone. The cookie is still
 * written when it is allowed, so a reader who navigates by clicking links
 * (which carry no parameter) stays in English.
 *
 * AND IT MUST BE A WHOLE-DOCUMENT NAVIGATION. `router.push()` looks like it
 * works — the page body does arrive in English — but the root layout is
 * preserved across a client-side transition, so `<html lang>`, the tab title
 * and the top bar keep the language they were mounted with. A page whose body
 * is English and whose chrome is Dutch is worse than one that never switched.
 * `window.location.assign` re-renders the document from scratch, which is the
 * honest way to change a document-level attribute, and keeps the URL visible.
 *
 * Two links, not a dropdown: there are exactly two languages, and a `<select>`
 * that changes the page on change is a well-known accessibility trap.
 */
export function LocaleToggle({
  current,
  label,
  otherLabel,
}: {
  current: Locale;
  label: string;
  otherLabel?: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();

  const set = (next: Locale) => {
    if (next === current) return;

    // 1. Best effort: a first-party cookie, so ordinary navigation keeps the
    //    choice. Wrapped because a blocked write is not an error we can catch —
    //    it simply does nothing — and must not stop step 2.
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* storage blocked; the parameter below is the real mechanism */
    }

    // 2. The mechanism that always works: put it in the URL, and reload the
    //    document so the layout (html lang, title, nav) is rebuilt too.
    const params = new URLSearchParams(search.toString());
    params.set("lang", next);
    start(() => window.location.assign(`${pathname}?${params.toString()}`));
  };

  return (
    <span className="locale-toggle" aria-label={label} data-pending={pending ? "1" : "0"}>
      {(["nl", "en"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          className={`loc ${l === current ? "on" : ""}`}
          aria-pressed={l === current}
          aria-label={l === current ? undefined : otherLabel}
          onClick={() => set(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
