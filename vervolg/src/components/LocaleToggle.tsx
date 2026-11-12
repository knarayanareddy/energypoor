"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/i18n/dict";

/**
 * Switches the UI language and re-renders the current page in place.
 *
 * The cookie is written client-side so a static export would still work; the
 * server reads the same cookie on the next request. `router.refresh()` re-runs
 * the server components without losing scroll position or client state (the
 * swarm animation keeps playing).
 *
 * Rendered as two links, not a dropdown: there are exactly two languages, and a
 * <select> that changes the page on change is a well-known accessibility trap.
 */
export function LocaleToggle({ current, label, otherLabel }: { current: Locale; label: string; otherLabel?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const set = (next: Locale) => {
    if (next === current) return;
    // 1 year, path-wide. The default is Dutch, so "nl" could delete the cookie,
    // but writing it explicitly keeps "I chose Dutch" distinguishable from
    // "I never chose", which is what a future default change would need.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
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
