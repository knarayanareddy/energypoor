import type { Locale } from "@/i18n/dict";
import { LOCALE_COOKIE, parseLocale } from "@/i18n/dict";

/**
 * API refusal messages.
 *
 * The E-codes (`E-ACTION-01`, …) are the machine contract from §9.3 and never
 * change. The sentence beside them is read by a coach on the capture screen, so
 * it follows the UI language. The API takes the same cookie the pages do, which
 * means a request from an English screen answers in English without the client
 * having to pass a header — and a `curl` with no cookie still gets Dutch, which
 * is what the tests and `scripts/verify-chain.ts` expect.
 *
 * Dutch stays the default on purpose: every one of these is a refusal, and a
 * refusal is the one message that must not be ambiguous to the person holding
 * the phone.
 */
const MESSAGES = {
  badBody: { nl: "Ongeldige body.", en: "Invalid body." },
  noDossier: {
    nl: "Kies eerst een dossier. Een notitie zonder dossier wordt niet opgeslagen.",
    en: "Pick a dossier first. A note without a dossier is not stored.",
  },
  emptyNote: { nl: "Er staat geen notitie in.", en: "There is no note in this." },
  confirmAsCoach: { nl: "Bevestig als coach.", en: "Confirm as coach." },
  unknownDossier: { nl: "Onbekend dossier.", en: "Unknown dossier." },
  noDossierShort: { nl: "Geen dossier.", en: "No dossier." },
  incompleteCorrection: { nl: "Onvolledige correctie.", en: "Incomplete correction." },
  movedToRestricted: {
    nl: "Dit is verplaatst naar een beperkt veld.",
    en: "This has been moved to a restricted field.",
  },
  unknownTarget: { nl: "Onbekend doel.", en: "Unknown target." },
  demoOnly: { nl: "Alleen in de demo.", en: "Demo only." },
  opMustBe: { nl: "op moet 'tamper' of 'reset' zijn.", en: "op must be 'tamper' or 'reset'." },
  householdDidNotShare: {
    nl: "Het huishouden heeft dit niet gedeeld.",
    en: "The household has not shared this.",
  },
  neverSharedWithCorp: {
    nl: "Dit dossier wordt nooit met de corporatie gedeeld.",
    en: "This dossier is never shared with the housing corporation.",
  },
} as const;

export type ApiMessageKey = keyof typeof MESSAGES;

/** Read the locale from a request without pulling `next/headers` into a route
 *  handler that may already have a `Request`. Falls back to Dutch. */
export function localeFromRequest(req: Request): Locale {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  return parseLocale(m?.[1]);
}

export function apiMessage(locale: Locale, key: ApiMessageKey): string {
  return MESSAGES[key][locale];
}
