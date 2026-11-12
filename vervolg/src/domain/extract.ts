// src/domain/extract.ts — §7.2
// A transparent rules engine over Dutch text. No model is called. Same input →
// same output, byte for byte (T-14).
//
// Deviations from the literal spec text are logged in REVIEW.md; the material
// ones are: word-bounded lexicons (an unbounded "taal" matches "betaalt", and
// an unbounded "IND" matches "sinds"), clause-level redaction for the shared
// barrier note, and non-restricted barriers are only taken from sentences that
// did not already produce an action.
import type { ActionStatus, BarrierKind, NeedsInput, RestrictedHit, Who } from "./types";
import {
  classifyRestricted,
  nextRestrictedField,
  neutralStub,
  restrictedBarrierKind,
  restrictedBarrierStub,
  type RestrictedKind,
} from "./gate";

export interface ExtractedAction {
  who: Who;
  what_nl: string;
  by_when: string | null;
  restricted: boolean;
  source_sentence: string;
}

export interface ExtractedBarrier {
  kind: BarrierKind;
  note_nl: string;
  restricted: boolean;
  source_sentence: string;
}

export interface ExtractionResult {
  actions: ExtractedAction[];
  barriers: ExtractedBarrier[];
  next_step: string;
  restricted_hits: RestrictedHit[];
  needs_input: NeedsInput[];
}

export const NEEDS_INPUT_QUESTION = "Wie doet wat, en wanneer?";

// ---------------------------------------------------------------------------
// sentences
// ---------------------------------------------------------------------------

// A period only ends a sentence when it is followed by whitespace + something
// that can start a Dutch sentence, and when it is not part of a number/abbrev.
const SENTENCE_END = /(?<=(?<!\b\d)\.)\s+(?=[A-ZÀ-Ý"'(]|$)/;

/** Split on [.!?] and newline, Dutch sentence order preserved. */
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[!?])\s+|(?<=\.)\s+(?=[A-ZÀ-Ý"'(])/))
    .flatMap((line) => line.split(SENTENCE_END))
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.replace(/[^a-zA-ZÀ-ÿ0-9]/g, "").length > 1);
}

/**
 * Clause split for redaction: "..., dus de drempel is een probleem."
 * Coordinating conjunctions are their own boundary so a restricted clause can
 * be dropped without taking the housing fact with it.
 */
export function splitClauses(sentence: string): string[] {
  return sentence
    .split(/(?:,\s*|\s+)(?:en|maar|want|dus|omdat|doordat|terwijl)\s+/i)
    .flatMap((c) => c.split(/,\s*/))
    .map((c) => c.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// actors
// ---------------------------------------------------------------------------

const ACTOR_PATTERNS: { re: RegExp; who: Who }[] = [
  { re: /\b(?:de )?gemeente\b/i, who: "gemeente" },
  { re: /\b(?:de )?corporatie\b|\bwoningcorporatie\b/i, who: "corporatie" },
  { re: /\bmevrouw\b|\bmeneer\b|\bhet gezin\b|\bfamilie\b/i, who: "huishouden" },
  { re: /\bzij\b|\bze\b|\bu\b/i, who: "huishouden" },
  { re: /\bik\b|\bwij\b|\bwe\b/i, who: "coach" },
];

/**
 * The actor that owns the action: the earliest actor mentioned BEFORE the verb
 * (Dutch puts the subject first in the clause), else the first one after it.
 */
export function findActor(sentence: string, verbStart: number, verbEnd: number): Who | null {
  let before: { who: Who; at: number } | null = null;
  let after: { who: Who; at: number } | null = null;
  for (const { re, who } of ACTOR_PATTERNS) {
    const g = new RegExp(re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = g.exec(sentence))) {
      const at = m.index;
      if (at < verbStart) {
        if (!before || at < before.at) before = { who, at };
      } else if (at >= verbEnd) {
        if (!after || at < after.at) after = { who, at };
      }
    }
  }
  return before?.who ?? after?.who ?? null;
}

// ---------------------------------------------------------------------------
// verbs — the closed list from §7.2 step 2c
// ---------------------------------------------------------------------------

interface VerbRule {
  inf: string;
  re: RegExp;
  /** separable verbs: the particle that closes the verb group appears later */
  particle?: RegExp;
}

export const VERB_RULES: VerbRule[] = [
  { inf: "aanvragen", re: /\baanvra(?:gen|agt|agden|agde|ag)\b|\baangevraagd\b|\bvra(?:ag|agt|agde|agden|gen)\b/i, particle: /\baan\b/i },
  { inf: "opsturen", re: /\bopstur(?:en|en|de|den)\b|\bopgestuurd\b|\bstuur(?:t|de|den)?\b|\bgestuurd\b/i, particle: /\bop\b/i },
  { inf: "invullen", re: /\binvul(?:len|t|de|den)\b|\bingevuld\b|\bvul(?:t|de|den)?\b|\bgevuld\b/i, particle: /\bin\b/i },
  { inf: "langskomen", re: /\blangskomen\b|\blangsgekomen\b|\bkom(?:t|en)?\b/i, particle: /\blangs\b/i },
  { inf: "kwijtschelden", re: /\bkwijt(?:schelden|scheldt|gescholden)\b/i },
  { inf: "laten keuren", re: /\blaten keuren\b|\blaat keuren\b|\bkeur(?:t|en|de|den)?\b|\bgekeurd\b/i },
  { inf: "installeren", re: /\binstalleer(?:t|en|de|den)?\b|\bgeïnstalleerd\b/i },
  { inf: "betalen", re: /\bbetaal(?:t|de|den)?\b|\bbetaald\b|\bbetalen\b|\bbetaalt\b/i },
  { inf: "bellen", re: /\bbel\b|\bbelt\b|\bbellen\b|\bbelde\b|\bbelden\b|\bgebeld\b/i },
  { inf: "regelen", re: /\bregel(?:t|en|de|den)?\b|\bgeregeld\b/i },
  { inf: "maken", re: /\bmaak(?:t|te|ten)?\b|\bgemaakt\b|\bmaken\b/i },
];

interface VerbMatch {
  rule: VerbRule;
  start: number;
  end: number;
  /** end of the particle, for separable verbs ("stuurt het bewijs op") */
  groupEnd: number;
  particleAt: number | null;
}

export function findVerb(sentence: string): VerbMatch | null {
  for (const rule of VERB_RULES) {
    const g = new RegExp(rule.re.source, "gi");
    const m = g.exec(sentence);
    if (!m) continue;
    const start = m.index;
    const end = start + m[0].length;
    if (rule.particle) {
      const tail = sentence.slice(end);
      const p = new RegExp(rule.particle.source, "i").exec(tail);
      if (!p) continue; // separable verb without its particle: not this rule
      return { rule, start, end, groupEnd: end + p.index + p[0].length, particleAt: end + p.index };
    }
    return { rule, start, end, groupEnd: end, particleAt: null };
  }
  return null;
}

// ---------------------------------------------------------------------------
// when
// ---------------------------------------------------------------------------

export const MONTHS_NL = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

const MONTH_ALT = MONTHS_NL.join("|");

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function lastDayOfMonth(y: number, m: number): string {
  return iso(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
}

function addDays(dateIso: string, days: number): string {
  const t = Date.parse(dateIso + "T00:00:00Z");
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

/** The first of the §7.2 step 4 markers, plus morgen/vandaag. */
export function extractByWhen(sentence: string, visitDate: string): string | null {
  const isoMatch = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(sentence);
  if (isoMatch) return isoMatch[0];

  const vy = Number(visitDate.slice(0, 4));
  const vm = Number(visitDate.slice(5, 7));

  if (/\bvolgende week\b/i.test(sentence)) return addDays(visitDate, 7);
  if (/\bovermorgen\b/i.test(sentence)) return addDays(visitDate, 2);
  if (/\bmorgen\b/i.test(sentence)) return addDays(visitDate, 1);

  const eind = new RegExp(`\\beind\\s+(${MONTH_ALT})\\b`, "i").exec(sentence);
  if (eind) {
    const m = MONTHS_NL.indexOf(eind[1].toLowerCase()) + 1;
    return lastDayOfMonth(m < vm ? vy + 1 : vy, m);
  }

  const voor = new RegExp(`\\bvoor\\s+(\\d{1,2})\\s+(${MONTH_ALT})\\b`, "i").exec(sentence);
  if (voor) {
    const d = Number(voor[1]);
    const m = MONTHS_NL.indexOf(voor[2].toLowerCase()) + 1;
    return iso(m < vm ? vy + 1 : vy, m, d);
  }

  if (/\bdeze maand\b/i.test(sentence)) return lastDayOfMonth(vy, vm);

  return null;
}

// ---------------------------------------------------------------------------
// barriers (§7.2 step 7)
// ---------------------------------------------------------------------------

// Word boundaries are deliberate: without them "taal" matches "betaalt" and
// "IND" matches "sinds". Lexemes added beyond the spec list are marked +.
export const BARRIER_LEXICON: { kind: BarrierKind; re: RegExp }[] = [
  {
    kind: "kosten",
    re: /\bte duur\b|\bkan(?:nen)? (?:het|dat|dit)? ?niet betalen\b|\bgeen geld\b|\bschuld\w*\b|\bachterstand\w*\b|\backter (?:met|op)\b|\bniet (?:meer|meer)? ?(?:kan|kunnen)? ?betalen\b|\brekening\w*\b/i,
  },
  {
    kind: "taal",
    re: /\bbegrijpt[^.]{0,40}\bniet\b|\bNederlands\b|\btaal\b|\bformulier\w*\b|\blezen\b|\buitspraak\b|\btolk\b|\bdon't understand\b|\bdo not understand\b|\banlamad[ıi]m\b|\bbilmiyorum\b|\bgesprek in het\b/i,
  },
  {
    kind: "wantrouwen",
    re: /\bvertrouwt[^.]{0,20}\bniet\b|\bbang\b|\bheeft slechte ervaring\w*\b|\bweigert\b|\bwil geen hulp\b|\bgeen hulp meer\b|\bhaakt af\b/i, // + wil geen hulp, geen hulp meer, haakt af
  },
  {
    kind: "gezondheid",
    re: /\bziek\b|\bklachten\b|\blongen\b|\bastma\b|\brollator\b|\bmantelzorg\b/i,
  },
  {
    kind: "administratie",
    re: /\bpapieren\b|\bDigiD\b|\bpost\b|\bbrieven\b|\badministratie\b|\bopent\b/i, // + opent
  },
  {
    kind: "woning",
    re: /\bvocht\b|\bschimmel\b|\btocht\b|\benkel glas\b|\bkapot\b|\bdoet het niet\b|\bniet meer doet\b|\bverwarming\b|\bdrempel\w*\b|\bvoordeur\b/i, // + verwarming, drempel, voordeur
  },
];

/** Which barrier kinds the restricted gate has already spoken for. */
const RESTRICTED_OWNED_KINDS: Record<RestrictedKind, BarrierKind[]> = {
  health: ["gezondheid"],
  debt: ["kosten"],
  legal: ["anders"],
  family: ["anders"],
};

/**
 * Drop the clauses that carry restricted content, so a shared field cannot
 * echo a restricted value (this is what makes T-10 hold).
 */
export function redactRestrictedClauses(sentence: string): string {
  const kept = splitClauses(sentence).filter((c) => classifyRestricted(c).length === 0);
  return kept.join(", ").trim();
}

// ---------------------------------------------------------------------------
// what_nl
// ---------------------------------------------------------------------------

const LEADING_STRIP = new Set(
  `de het een dat dit die deze er nog wel ook al samen even toch dan weer
   precies iets wat daar hier mijn zijn haar hun ons
   volgende week eind maand morgen overmorgen vandaag deze
   over van voor met bij in op aan uit om te naar`
    .split(/\s+/)
    .filter(Boolean),
);

const TRAILING_STRIP = new Set(
  `de het een van voor met bij in op aan uit om te naar en of maar want dus
   deze dat dit die er nog wel al dan toch even`
    .split(/\s+/)
    .filter(Boolean),
);

const ACTOR_WORDS = new Set([
  "ik",
  "wij",
  "we",
  "jij",
  "je",
  "u",
  "hij",
  "zij",
  "ze",
  "mij",
  "mevrouw",
  "meneer",
  "gezin",
  "familie",
  "gemeente",
  "corporatie",
  "woningcorporatie",
]);

const ACTOR_PHRASE = /\b(?:de |het )?(?:woningcorporatie|corporatie|gemeente|mevrouw|meneer|het gezin|familie)\b/gi;

const WEAK_OBJECTS = new Set(["dat", "dit", "die", "het", "er", "iets", "wat", "daar", "hier", "niets"]);

const DATE_PHRASE = new RegExp(
  `\\b(?:volgende week|deze maand|eind\\s+(?:${MONTH_ALT})|voor\\s+\\d{1,2}\\s+(?:${MONTH_ALT})|overmorgen|morgen|vandaag)\\b`,
  "gi",
);

const MONTH_DATE = new RegExp(`\\b\\d{1,2}\\s+(?:${MONTH_ALT})\\b`, "gi");

/** Mass nouns and bare plurals: no article, so the phrase stays natural. */
const BARE_NOUNS = new Set([
  "brieven",
  "papieren",
  "post",
  "geld",
  "kwijtschelding",
  "huurtoeslag",
  "huurverlaging",
  "isolatie",
  "vocht",
  "schimmel",
  "tocht",
]);

/**
 * Dutch neuter nouns that take "het". Not a general gender guess — a lookup for
 * the words this extractor actually produces. "de formulier" is wrong and a
 * rule-of-thumb based on the ending cannot fix it; a list can.
 */
const HET_WORDS = new Set([
  "formulier",
  "aanvraagformulier",
  "energiefonds",
  "energielabel",
  "onderhoud",
  "gesprek",
  "gezin",
  "dossier",
  "bewijs",
  "inkomensbewijs",
  "contract",
  "bedrag",
  "termijn",
  "vocht",
  "glas",
  "huis",
  "jaar",
  "geld",
  "probleem",
  "recht",
  "voorstel",
  "bezoek",
  "advies",
  "onderzoek",
  "verslag",
  "verzoek",
  "antwoord",
]);

const DETERMINERS = new Set(["de", "het", "een", "mijn", "zijn", "haar", "hun", "ons", "onze", "dit", "dat", "deze"]);

export function objectPhrase(raw: string, maxTokens = 12): string | null {
  let s = ` ${raw} `;
  // a coordinating conjunction starts a new clause, not a longer object
  s = s.split(/\s+(?:en|maar|want|dus|omdat)\s+/)[0];
  s = s.replace(DATE_PHRASE, " ");
  s = s.replace(MONTH_DATE, " ");
  s = s.replace(/\b(?:\d{4})-(?:\d{2})-(?:\d{2})\b/g, " ");
  s = s.replace(/[.,;:!?'"()]+/g, " ");
  // actors are not part of the object
  s = s.replace(ACTOR_PHRASE, " ");
  // "een afspraak met over het vocht" -> "een afspraak over het vocht"
  s = s.replace(/\bmet\s+(?=(?:over|van|voor|in|op|bij|aan)\b)/gi, " ");
  s = s.replace(/\s+/g, " ").trim();

  const tokens = s.split(" ").filter(Boolean).filter((t, i) => !(i === 0 && ACTOR_WORDS.has(t.toLowerCase())));
  let lo = 0;
  let hi = tokens.length;
  while (lo < hi && LEADING_STRIP.has(tokens[lo].toLowerCase())) lo++;
  while (hi > lo && TRAILING_STRIP.has(tokens[hi - 1].toLowerCase())) hi--;
  const kept = tokens.slice(lo, Math.min(hi, lo + maxTokens));
  if (kept.length === 0) return null;
  if (kept.every((t) => WEAK_OBJECTS.has(t.toLowerCase()))) return null;

  // Restore the definite article the leading-strip removed. Dutch needs a
  // determiner on a common-noun object; mass nouns and plurals do not take one.
  const first = kept[0];
  const head = first.toLowerCase().replace(/[^a-zà-ÿ]/g, "");
  if (!DETERMINERS.has(head) && !BARE_NOUNS.has(head) && /^[a-zà-ÿ]/.test(first) && head.length > 2) {
    kept.unshift(HET_WORDS.has(head) ? "het" : "de");
  }
  return kept.join(" ");
}

/**
 * Build "<object> <infinitive>". Returns null when the sentence carries no
 * concrete verb-object pair — the extractor never invents one.
 */
export function buildWhatNl(sentence: string, vm: VerbMatch): string | null {
  const before = sentence.slice(0, vm.start);
  const after = sentence.slice(vm.groupEnd);
  const between = vm.particleAt !== null ? sentence.slice(vm.end, vm.particleAt) : "";

  // separable verbs carry the object between stem and particle
  for (const cand of [between, after, before]) {
    if (!cand || !cand.trim()) continue;
    const object = objectPhrase(cand);
    if (!object) continue;
    const phrase = `${object} ${vm.rule.inf}`;
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  }
  return null;
}

// ---------------------------------------------------------------------------
// the extractor
// ---------------------------------------------------------------------------

/**
 * Reported speech and self-corrections are not actions: "Ik heb gezegd dat ze
 * moesten bellen" and "we moeten nog iets regelen, ik weet niet precies wat"
 * must produce a coach question, never an invented action (§7.2 step 5).
 */
export const META_REPORTING = /\b(?:heb gezegd|gezegd dat|weet niet|niet precies|zou(?:den)? moeten|moest(?:en)?|zonder te weten)\b/i;

export function extract(noteText: string, householdRef: string, visitDate: string): ExtractionResult {
  void householdRef;
  const sentences = splitSentences(noteText);
  const actions: ExtractedAction[] = [];
  const barriers: ExtractedBarrier[] = [];
  const needs_input: NeedsInput[] = [];
  const restricted_hits: RestrictedHit[] = [];
  const restrictedSoFar: Record<string, string> = {};

  for (const sentence of sentences) {
    const kinds = classifyRestricted(sentence);

    // --- restricted storage: per field, never per household (§8.1) ---
    for (const kind of kinds) {
      const field = nextRestrictedField(kind, restrictedSoFar);
      restrictedSoFar[field] = sentence;
      restricted_hits.push({ field, kind, value: sentence });
      if (!barriers.some((b) => b.kind === restrictedBarrierKind(kind) && b.restricted)) {
        barriers.push({
          kind: restrictedBarrierKind(kind),
          note_nl: restrictedBarrierStub(kind),
          restricted: true,
          source_sentence: sentence,
        });
      }
    }

    // --- action ---
    const vm = META_REPORTING.test(sentence) ? null : findVerb(sentence);
    const what = vm ? buildWhatNl(sentence, vm) : null;

    if (!vm || !what) {
      if (kinds.length === 0 && splitClauses(sentence).some((c) => c.trim())) {
        // a sentence with a verb stem but no object is a question for the coach
        const hasStem = findVerb(sentence) !== null;
        if (hasStem) needs_input.push({ sentence, question_nl: NEEDS_INPUT_QUESTION, code: "E-ACTION-01" });
      }
      // --- non-restricted barriers (only from sentences that are not actions) ---
      addSharedBarriers(sentence, kinds, barriers, splitClauses);
      continue;
    }

    const who = findActor(sentence, vm.start, vm.groupEnd) ?? "anders";
    const primary: RestrictedKind | null = kinds[0] ?? null;
    actions.push({
      who,
      what_nl: primary ? neutralStub(primary) : what,
      by_when: extractByWhen(sentence, visitDate),
      restricted: primary !== null,
      source_sentence: sentence,
    });
  }

  const coachActions = actions.filter((a) => a.who === "coach" && !a.restricted);
  const next_step = coachActions.length ? coachActions[coachActions.length - 1].what_nl : "";

  return { actions, barriers, next_step, restricted_hits, needs_input };
}

function addSharedBarriers(
  sentence: string,
  kinds: RestrictedKind[],
  barriers: ExtractedBarrier[],
  clauseSplitter: (s: string) => string[],
): void {
  const owned = new Set(kinds.flatMap((k) => RESTRICTED_OWNED_KINDS[k]));
  const seen = new Set(barriers.map((b) => b.kind));
  for (const clause of clauseSplitter(sentence)) {
    if (classifyRestricted(clause).length > 0) continue; // never echo restricted text
    for (const { kind, re } of BARRIER_LEXICON) {
      if (owned.has(kind) || seen.has(kind)) continue;
      if (!re.test(clause)) continue;
      const note = clause.trim();
      barriers.push({
        kind,
        note_nl: note.charAt(0).toUpperCase() + note.slice(1),
        restricted: false,
        source_sentence: sentence,
      });
      seen.add(kind);
    }
  }
}

/** Deterministic serialisation used by T-14 (byte-for-byte equality). */
export function extractCanonical(noteText: string, householdRef: string, visitDate: string): string {
  return JSON.stringify(extract(noteText, householdRef, visitDate));
}

export const DEFAULT_STATUS: ActionStatus = "afgesproken";
