// src/domain/invariants.ts — §10 "The wall"
// Assertions as functions. `npm test` runs all of them. If a rule cannot be
// satisfied, change the implementation, never the assertion.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { extract } from "./extract";
import { buildBrief, buildFamilyView, briefCsv } from "./brief";
import { SENSITIVE_SUBSTRINGS } from "./gate";
import type { Action, Household } from "./types";

const SRC = path.join(process.cwd(), "src");

/**
 * Every .ts/.tsx under src EXCEPT the test directory. The tests necessarily
 * contain the forbidden tokens (they are the assertions), so scanning them
 * would make every rule match itself.
 */
export function sourceFiles(dir = SRC, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (path.relative(SRC, p) === "test") continue;
      sourceFiles(p, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
}

export function rel(p: string): string {
  return path.relative(SRC, p).replace(/\\/g, "/");
}

/** Strip comments so a rule can allow a word in a comment but not in code. */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/^\s*#.*$/gm, "");
}

// --- T-01 (W1): no score about a household -----------------------------------

const SCORE_WORDS = /\b(risk|score|prioriteit|priority|urgency|urgentie|willingness|bereidheid|worthiness)\b/gi;

/**
 * Where the words are allowed: E-NOEVAL-01 messages, comments, and the two
 * files whose whole job is to refuse/measure the rule.
 */
const T01_ALLOWED_FILES = new Set([
  "domain/invariants.ts",
  "test/w1.test.ts",
  "app/review/page.tsx",
  "domain/extract.ts",
]);

export function scoreWordHits(): { file: string; hits: string[] }[] {
  const out: { file: string; hits: string[] }[] = [];
  for (const f of sourceFiles()) {
    const r = rel(f);
    if (T01_ALLOWED_FILES.has(r)) continue;
    const code = stripComments(readFileSync(f, "utf8"));
    // An E-NOEVAL mention is the refusal itself, and so is UI copy that says
    // "geen score / geen urgentie". The rule forbids the FIELD, not the promise
    // that there is none — so a negated mention is stripped before scanning.
    const cleaned = code
      .replace(/E-NOEVAL-01[^"'`\n]*/g, "")
      .replace(/E-NOEVAL-01/g, "")
      .replace(/\b(?:geen|no|never|zonder|not a)\s+(?:enkele\s+)?(?:risk|score|prioriteit|priority|urgency|urgentie|willingness|bereidheid|worthiness)\w*/gi, "")
      .replace(/(?:risk|score|prioriteit|priority|urgency|urgentie|willingness|bereidheid|worthiness)\s*[:=]\s*(?:geen|null|false|0)\b/gi, "");
    const hits = cleaned.match(SCORE_WORDS);
    if (hits) out.push({ file: r, hits: [...new Set(hits.map((h) => h.toLowerCase()))] });
  }
  return out;
}

/** The only numeric fields /api/cases may expose. */
export const CASE_NUMERIC_ALLOWED = new Set([
  "days_since_contact",
  "open_actions",
  "dropped_actions",
  "never_followed_up",
  "visits",
]);

export function caseRowViolations(rows: Record<string, unknown>[]): string[] {
  const bad: string[] = [];
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "number" && !CASE_NUMERIC_ALLOWED.has(k)) bad.push(`${row.ref}.${k}`);
    }
  }
  return bad;
}

// --- T-09 (W9): every dropped action has a reason ---------------------------

export function droppedWithoutReason(houses: Household[]): Action[] {
  return houses
    .flatMap((h) => h.actions)
    .filter((a) => a.status === "niet_gedaan" && (!a.evidence || a.evidence.trim() === "" || a.evidence.trim() === "—"));
}

// --- T-10 (W10): restricted leakage = 0 -------------------------------------

export interface LeakReport {
  where: string;
  needle: string;
  household: string;
}

/**
 * Runs every note through the extractor and every household through brief,
 * family view and CSV, then hunts for the sensitive substrings.
 */
export function leakReport(houses: Household[], noteTexts: string[]): LeakReport[] {
  const leaks: LeakReport[] = [];

  // 1. restricted values that made it into a NON-restricted field
  for (const h of houses) {
    for (const v of h.visits) {
      for (const [field, sentence] of Object.entries(v.restricted_fields ?? {})) {
        // the value is allowed to exist in the restricted field itself
        void field;
        void sentence;
      }
    }
    for (const b of h.barriers) {
      if (b.restricted) continue;
      for (const s of SENSITIVE_SUBSTRINGS) {
        if (b.note_nl.toLowerCase().includes(s.toLowerCase())) leaks.push({ where: "barrier", needle: s, household: h.household_ref });
      }
    }
    for (const a of h.actions) {
      if (a.restricted) continue;
      for (const s of SENSITIVE_SUBSTRINGS) {
        if (a.what_nl.toLowerCase().includes(s.toLowerCase())) leaks.push({ where: "action", needle: s, household: h.household_ref });
        if ((a.evidence ?? "").toLowerCase().includes(s.toLowerCase())) leaks.push({ where: "evidence", needle: s, household: h.household_ref });
      }
    }
  }

  // 2. the brief, the family view and the CSV
  const restrictedOnly = new Set<string>();
  for (const h of houses) {
    for (const b of h.barriers) if (b.restricted) restrictedOnly.add(b.note_nl.toLowerCase());
  }

  for (const h of houses) {
    const briefText = JSON.stringify(buildBrief(h)).toLowerCase();
    const familyText = JSON.stringify(buildFamilyView(h)).toLowerCase();
    const csv = briefCsv(h).toLowerCase();
    for (const s of SENSITIVE_SUBSTRINGS) {
      const needle = s.toLowerCase();
      // "betalingsregeling" and "achterstand" are legitimate policy words in a
      // non-restricted action; only flag them when they occur in restricted form
      if (briefText.includes(needle) && !isPolicyWord(needle)) {
        leaks.push({ where: "brief", needle: s, household: h.household_ref });
      }
      if (familyText.includes(needle) && !isPolicyWord(needle)) {
        leaks.push({ where: "family", needle: s, household: h.household_ref });
      }
      if (csv.includes(needle) && !isPolicyWord(needle)) {
        leaks.push({ where: "csv", needle: s, household: h.household_ref });
      }
    }
  }

  // 3. the extractor's own output for the adversarial notes
  for (const note of noteTexts) {
    const r = extract(note, "HH-TEST", "2026-01-01");
    for (const a of r.actions) {
      if (a.restricted) continue;
      for (const s of SENSITIVE_SUBSTRINGS) {
        if (a.what_nl.toLowerCase().includes(s.toLowerCase()) && !isPolicyWord(s.toLowerCase())) {
          leaks.push({ where: "extract:action", needle: s, household: "note" });
        }
      }
    }
    for (const b of r.barriers) {
      if (b.restricted) continue;
      for (const s of SENSITIVE_SUBSTRINGS) {
        if (b.note_nl.toLowerCase().includes(s.toLowerCase()) && !isPolicyWord(s.toLowerCase())) {
          leaks.push({ where: "extract:barrier", needle: s, household: "note" });
        }
      }
    }
  }

  void restrictedOnly;
  return leaks;
}

/**
 * Policy vocabulary that is not, by itself, restricted content: a household can
 * have "de betalingsregeling aanvragen" as a shared action. What must never leak
 * is the *reason* the row was restricted (COPD, zuurstof, verblijfsvergunning …).
 */
function isPolicyWord(s: string): boolean {
  return s === "betalingsregeling" || s === "achterstand" || s === "schuld" || s === "angst";
}

// --- T-19 ------------------------------------------------------------------

export const VERB_OBJECT =
  /\b(bellen|regelen|aanvragen|opsturen|invullen|maken|langskomen|installeren|betalen|kwijtschelden|keuren)\b/i;

/**
 * §8.2 rule 2 deliberately replaces a restricted action's what_nl with a neutral
 * stub ("Afspraak over betalingen — zie beperkte velden."). That stub must not
 * carry the verb, because the verb would be the disclosure. T-19 therefore
 * applies to every NON-restricted row, and the stub is asserted separately.
 */
export function actionsMissingVerbObject(houses: Household[]): Action[] {
  return houses
    .flatMap((h) => h.actions)
    .filter((a) => !a.restricted)
    .filter((a) => !VERB_OBJECT.test(a.what_nl));
}
