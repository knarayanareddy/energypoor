// src/domain/gate.ts — §8.1 / §8.2
// The restricted-content gate is the FairTech product. Classification is per
// *field*, never per household: a household is never flagged.
//
// Every pattern is word-bounded. The spec's literal patterns are unbounded and
// "IND" then matches "sinds", "status" is fine but "taal" (barrier lexicon)
// matches "betaalt", and "eind" matches "IND" — i.e. the literal regex would
// mark ordinary sentences restricted. See REVIEW.md, D-02.
import type { BarrierKind } from "./types";

export type RestrictedKind = "health" | "debt" | "legal" | "family";

export const RESTRICTED_KINDS: RestrictedKind[] = ["health", "debt", "legal", "family"];

export const RESTRICTED_PATTERNS: Record<RestrictedKind, RegExp> = {
  health:
    /\bCOPD\b|\bastma\b|\blongen\b|\bhart\b|\bkanker\b|\bdiabetes\b|\brollator\b|\bzuurstof\w*\b|\bmantelzorg\w*\b|\bpsychisch\w*\b|\bdepressi\w*\b|\bGGZ\b|\bmedicatie\b/i,
  debt:
    /\bschuld\w*\b|\bachterstand\w*\b|\bachter (?:met|op)\b|\bbetalingsregeling\w*\b|\bincasso\b|\bdeurwaarder\b|\bloonbeslag\b|\bniet betaald\b|\brood staan\b|\b(?:kan|kunnen|kon|konden)\b[^.!?]{0,30}\bniet\b[^.!?]{0,20}\bbetalen\b|\bhuur niet betalen\b/i,
  legal:
    /\bverblijfsvergunning\b|\bverblijfsstatus\b|\basiel\w*\b|\buitzetting\b|\bontruiming\b|\billegaal\b|\bIND\b|\bstatus\b/i,
  family: /\bechtscheiding\b|\bhuiselijk\b|\bgeweld\b|\bvoogdij\b|\bjeugdzorg\b/i,
};

/** Which restricted kinds a sentence touches, in a fixed priority order. */
export function classifyRestricted(sentence: string): RestrictedKind[] {
  return RESTRICTED_KINDS.filter((k) => RESTRICTED_PATTERNS[k].test(sentence));
}

export function isRestricted(sentence: string): boolean {
  return classifyRestricted(sentence).length > 0;
}

/** Neutral stubs for a restricted *action* (§8.2 rule 2). Never contains the value. */
export function neutralStub(kind: RestrictedKind): string {
  switch (kind) {
    case "health":
      return "Afspraak over gezondheid — zie beperkte velden.";
    case "debt":
      return "Afspraak over betalingen — zie beperkte velden.";
    case "legal":
      return "Afspraak met een instantie — zie beperkte velden.";
    case "family":
      return "Afspraak over een persoonlijke situatie — zie beperkte velden.";
  }
}

/** Neutral stub for a restricted *barrier*. The barrier keeps a kind, never a value. */
export function restrictedBarrierStub(kind: RestrictedKind): string {
  const nl =
    kind === "health"
      ? "gezondheid"
      : kind === "debt"
        ? "betalingen"
        : kind === "legal"
          ? "een instantie"
          : "een persoonlijke situatie";
  return `Beperkte notitie over ${nl} — zie beperkte velden.`;
}

/** The barrier kind a restricted hit maps onto. */
export function restrictedBarrierKind(kind: RestrictedKind): BarrierKind {
  switch (kind) {
    case "health":
      return "gezondheid";
    case "debt":
      return "kosten";
    case "legal":
    case "family":
      return "anders";
  }
}

/**
 * Stable field names for restricted storage: health_mention_1, debt_mention_2 …
 * The counter is per kind within one visit. Field names (never values) are what
 * the brief footer prints.
 */
export function nextRestrictedField(kind: RestrictedKind, existing: Record<string, string>): string {
  let n = 1;
  while (existing[`${kind}_mention_${n}`] !== undefined) n++;
  return `${kind}_mention_${n}`;
}

/**
 * T-10's fixture-sensitive substrings. Used by the tests to prove that no
 * restricted *value* reaches the brief, the household view or a CSV export.
 */
export const SENSITIVE_SUBSTRINGS = [
  "COPD",
  "zuurstof",
  "rollator",
  "verblijfsvergunning",
  "betalingsregeling",
  "achterstand",
  "schuld",
  "angst",
  "voogdij",
  "huiselijk",
];
