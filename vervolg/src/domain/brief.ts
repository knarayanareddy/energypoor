// src/domain/brief.ts — §8.3
// Timeline → one page. Deterministic template: zero model calls.
import type { Action, Barrier, Household, PreVisitBrief, Visit } from "./types";
import { mirrorEn } from "../i18n/dossier";

const MS_DAY = 86400000;

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(toIso.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / MS_DAY);
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Dates, in both languages.
 *
 * A date is interface, not dossier content: "31 mrt 2025" next to an English
 * sentence is a mixed-language screen, and the Dutch abbreviation is not a
 * proper noun. So the month names are translated and the `Nl` names survive as
 * the Dutch case of the same two functions — the domain layer's defaults,
 * because a brief printed for a doorstep is printed in Dutch.
 *
 * `5 jun 2025` vs `5 Jun 2025`: the English forms are capitalised, the Dutch
 * ones are not. That is each language's own convention, not a typo.
 */
const MONTHS = {
  nl: {
    short: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
    long: [
      "januari", "februari", "maart", "april", "mei", "juni",
      "juli", "augustus", "september", "oktober", "november", "december",
    ],
  },
  en: {
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    long: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
  },
} as const;

export type DateLocale = keyof typeof MONTHS;

function joinDate(iso: string, month: string): string {
  const d = iso.slice(0, 10);
  return `${Number(d.slice(8, 10))} ${month} ${d.slice(0, 4)}`;
}

export function formatDate(iso: string | null, locale: DateLocale = "nl"): string {
  if (!iso) return locale === "nl" ? "geen datum" : "no date";
  return joinDate(iso, MONTHS[locale].short[Number(iso.slice(5, 7)) - 1]);
}

export function formatDateLong(iso: string | null, locale: DateLocale = "nl"): string {
  if (!iso) return locale === "nl" ? "geen datum" : "no date";
  return joinDate(iso, MONTHS[locale].long[Number(iso.slice(5, 7)) - 1]);
}

export function monthsAgo(days: number, locale: DateLocale = "nl"): string {
  const months = Math.round(days / 30.44);
  if (locale === "en") {
    if (months < 1) return `${days} ${days === 1 ? "day" : "days"}`;
    return `${months} ${months === 1 ? "month" : "months"}`;
  }
  if (months < 1) return `${days} ${days === 1 ? "dag" : "dagen"}`;
  return `${months} ${months === 1 ? "maand" : "maanden"}`;
}

// The Dutch spellings stay, because §8.3's brief and the visit copy are Dutch
// by requirement and call these by name.
export const formatDateNl = (iso: string | null) => formatDate(iso, "nl");
export const formatDateLongNl = (iso: string | null) => formatDateLong(iso, "nl");
export const monthsAgoNl = (days: number) => monthsAgo(days, "nl");

export const STALE_DAYS = 270;

/** Restricted items never reach the brief; the field NAME is all that surfaces. */
export function restrictedFieldNames(household: Household): string[] {
  const names: string[] = [];
  for (const v of household.visits) {
    for (const key of Object.keys(v.restricted_fields ?? {})) {
      if (!names.includes(key)) names.push(key);
    }
  }
  return names;
}

/**
 * The hand-over list. This is a worked example from the municipality's own
 * energy-poverty page, never an entitlement decision (§19).
 */
const HANDOVER: Record<string, { wat: string; waar: string; voorwaarden: string }> = {
  energiefonds: {
    wat: "Energiefonds Groningen — formulier + inkomensbewijs",
    waar: "Voorbeeldregeling gemeente Groningen",
    voorwaarden: "inkomen < 130% minimum",
  },
  energietoeslag: {
    wat: "Energietoeslag (NPLV) — aanvraagformulier",
    waar: "Voorbeeldregeling gemeente Groningen",
    voorwaarden: "inkomen tot 120% minimum, peildatum 1 januari",
  },
  voedselbank: {
    wat: "Voedselbank — aanmelding via het buurtteam",
    waar: "Voorbeeldregeling, geen automatische toekenning",
    voorwaarden: "verwijzing nodig van een hulpverlener",
  },
  kwijtschelding: {
    wat: "Kwijtschelding gemeentelijke belastingen",
    waar: "Voorbeeldregeling gemeente Groningen",
    voorwaarden: "inkomen op bijstandsniveau, geen vermogen",
  },
  huurtoeslag: {
    wat: "Huurtoeslag — formulier + huurovereenkomst",
    waar: "Voorbeeldregeling, landelijk",
    voorwaarden: "huur en inkomen binnen de grenzen",
  },
  tolk: {
    wat: "Tolkafspraak via het buurtteam",
    waar: "Voorbeeldregeling gemeente Groningen",
    voorwaarden: "aanvraag door de coach, 5 werkdagen vooraf",
  },
};

const HANDOVER_TRIGGERS: { re: RegExp; key: string }[] = [
  { re: /energiefonds|voucher/i, key: "energiefonds" },
  { re: /energietoeslag/i, key: "energietoeslag" },
  { re: /voedselbank/i, key: "voedselbank" },
  { re: /kwijtschelding/i, key: "kwijtschelding" },
  { re: /huurtoeslag/i, key: "huurtoeslag" },
  { re: /tolk/i, key: "tolk" },
];

/**
 * §8.3 derivation rules, in the order the spec gives them, capped at four.
 * Every question is traceable to a row in the file.
 */
export function deriveAskToday(household: Household, actions: Action[], barriers: Barrier[], today: string): string[] {
  const out: string[] = [];
  const push = (q: string) => {
    if (out.length < 4 && !out.includes(q)) out.push(q);
  };

  for (const a of actions) {
    if (a.restricted) continue;
    if (a.status === "niet_gedaan") push(`${capFirst(a.what_nl)} — is dat gelukt? Zo nee, waar liep het vast?`);
  }

  for (const a of actions) {
    if (a.restricted) continue;
    if (a.status === "onbekend" && a.by_when && a.by_when < today) {
      push(`${capFirst(a.what_nl)} — is dat nog gelukt voor ${formatDateNl(a.by_when)}?`);
    }
  }

  const lastVisit = household.visits[household.visits.length - 1];
  const lastBarrierIds = new Set(lastVisit?.barriers_added ?? []);
  const taalNow = barriers.some((b) => b.kind === "taal" && !b.restricted && lastBarrierIds.has(b.barrier_id));
  if (taalNow) push("Heeft u hulp nodig bij het formulier?");

  for (const a of actions) {
    if (a.restricted) continue;
    if (a.status === "afgesproken" && a.by_when === null) {
      // what_nl is "<object> <infinitive>", so "wilt u <what> doen" produces a
      // double infinitive. "gaat u <what>" is the same question in correct Dutch.
      push(`Wanneer gaat u ${lowerFirst(a.what_nl)}?`);
    }
  }

  return out.slice(0, 4);
}

function capFirst(x: string): string {
  return x ? x[0].toUpperCase() + x.slice(1) : x;
}

function lowerFirst(s: string): string {
  if (!s) return s;
  // keep proper nouns alone: only lowercase a leading word that is not capitalised mid-sentence
  const first = s.split(" ")[0];
  if (first.length > 1 && /^[A-Z][a-z]/.test(first) && !/^(De|Het|Een|Ik|Wij|Ze|Zij|U)$/.test(first)) {
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function buildBrief(household: Household, today = todayIso()): PreVisitBrief {
  const visitDate = (id: string | null) =>
    household.visits.find((v) => v.visit_id === id)?.date ?? null;

  // A completed or dropped action is reported at the visit where that status
  // was observed, because that is the fact the coach needs on the doorstep —
  // not the date the action was first agreed. Same helper as the family view.
  const shared = household.actions.filter((a) => !a.restricted).map((a) => stampVisitDate(household, a));
  const agreed = shared.filter((a) => a.status === "afgesproken");
  const unknown = shared.filter((a) => a.status === "onbekend");
  const completed = shared.filter((a) => a.status === "gedaan");
  const dropped = shared.filter((a) => a.status === "niet_gedaan");

  const handKeys = new Set<string>();
  for (const a of shared) {
    for (const t of HANDOVER_TRIGGERS) {
      if (t.re.test(a.what_nl)) handKeys.add(t.key);
      if (t.re.test(a.evidence ?? "")) handKeys.add(t.key);
    }
  }
  const hand_over_nl = [...handKeys].map((k) => HANDOVER[k]).filter(Boolean);
  if (hand_over_nl.length === 0) {
    hand_over_nl.push(HANDOVER.energietoeslag);
  }

  const last = household.last_visit;
  const stale_days = last ? Math.max(0, daysBetween(last, today)) : 0;

  return {
    household_ref: household.household_ref,
    display_nl: household.display_nl,
    last_visit: last,
    agreed: [...agreed, ...unknown],
    completed,
    dropped,
    ask_today_nl: deriveAskToday(household, shared, household.barriers, today),
    hand_over_nl,
    restricted_fields_excluded: restrictedFieldNames(household),
    generated_at: new Date().toISOString(),
    stale_days,
  };
}

/**
 * What the household sees: the same file, no ids, no internal notes, no
 * restricted rows, no label, no programme manager comment (§4, §9.1 stage 7).
 */
export interface FamilyView {
  display_nl: string;
  intro_nl: string;
  appointments: { what_nl: string; when_nl: string; state_nl: string; state: string }[];
  barriers_nl: string[];
  visits_nl: { date_nl: string; count: number; preview_nl: string }[];
  corrections_nl: { at: string; field: string; to: string }[];
  footer_nl: string;
}

const STATE_NL: Record<string, string> = {
  afgesproken: "Afgesproken",
  gedaan: "Gedaan",
  niet_gedaan: "Niet gedaan",
  onbekend: "We weten het nog niet",
};

const STATE_EN: Record<string, string> = {
  afgesproken: "Agreed",
  gedaan: "Done",
  niet_gedaan: "Not done",
  onbekend: "We do not know yet",
};

/**
 * §6.1 — the household's own view, in B1 Dutch.
 *
 * Dutch is the artefact: this page exists to be read on paper by the person the
 * file is about, in Groningen. The English strings are a mirror for a reviewer
 * reading the UI in English, never a replacement — and the printed brief
 * (`buildBrief`) has no English path at all, because §8.3 mandates one A4 page,
 * in Dutch.
 *
 * Both are built here so the two can never disagree about what was agreed; the
 * wording differs, the data does not.
 */
const FAMILY_COPY = {
  nl: {
    intro:
      "Dit is uw eigen dossier. U ziet precies wat de energiecoach heeft opgeschreven. Klopt er iets niet, dan kunt u het hieronder corrigeren.",
    noDate: "nog geen datum",
    none: "Er staan nog geen afspraken in uw dossier.",
    nothingAgreed: "Geen afspraken vastgelegd.",
    footer: "Dit dossier wordt nooit met de corporatie of de energieleverancier gedeeld.",
  },
  en: {
    intro:
      "This is your own file. You see exactly what the energy coach wrote down. If something is not right, you can correct it below.",
    noDate: "no date yet",
    none: "There are no appointments in your file yet.",
    nothingAgreed: "No appointments recorded.",
    footer: "This file is never shared with the housing corporation or the energy supplier.",
  },
} as const;

/**
 * The date a completed or dropped action is reported at. Shared with the brief
 * so the coach's A4 and the household's own view can never disagree about when
 * something happened.
 */
function stampVisitDate(household: Household, a: Action): Action {
  if (a.status === "gedaan" || a.status === "niet_gedaan") {
    const d = household.visits.find((v) => v.visit_id === a.status_at_visit)?.date;
    if (d) return { ...a, by_when: d };
  }
  return a;
}

export function buildFamilyView(
  household: Household,
  corrections: { at: string; field: string; to: string }[] = [],
  locale: DateLocale = "nl",
): FamilyView {
  const shared = household.actions.filter((a) => !a.restricted).map((a) => stampVisitDate(household, a));
  const copy = FAMILY_COPY[locale];
  const stateOf = (s: string) => (locale === "en" ? STATE_EN : STATE_NL)[s] ?? s;
  return {
    display_nl: household.display_nl,
    intro_nl: copy.intro,
    appointments: shared.map((a) => ({
      what_nl: a.what_nl,
      when_nl: a.by_when ? formatDateLong(a.by_when, locale) : copy.noDate,
      state_nl: stateOf(a.status),
      state: a.status,
    })),
    barriers_nl: household.barriers.filter((b) => !b.restricted).map((b) => b.note_nl),
    // A transcript is a coach's raw dictation and may contain restricted
    // sentences. The household sees what was AGREED at the visit — never the
    // dictation. English: a raw note is not a household-facing artefact.
    visits_nl: household.visits.map((v) => {
      const added = v.actions_added
        .map((id) => household.actions.find((a) => a.action_id === id))
        .filter((a): a is NonNullable<typeof a> => !!a && !a.restricted)
        .map((a) => (locale === "en" ? (mirrorEn(a.what_nl) ?? a.what_nl) : a.what_nl));
      return {
        date_nl: formatDateLong(v.date, locale),
        count: added.length,
        preview_nl: added.length ? added.join(" · ") : copy.nothingAgreed,
      };
    }),
    corrections_nl: corrections,
    footer_nl: copy.footer,
  };
}

/** CSV export for the coach — never contains restricted rows (§8.2 rule 4). */
export function briefCsv(household: Household): string {
  const rows = [["action_id", "who", "what_nl", "by_when", "status", "evidence"]];
  for (const a of household.actions) {
    if (a.restricted) continue;
    rows.push([a.action_id, a.who, a.what_nl, a.by_when ?? "", a.status, a.evidence ?? ""]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function visitById(household: Household, id: string): Visit | undefined {
  return household.visits.find((v) => v.visit_id === id);
}
