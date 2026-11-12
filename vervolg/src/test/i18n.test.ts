import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DICTS,
  LOCALE_COOKIE,
  LOCALES,
  interpolate,
  parseLocale,
  t,
  type DictKey,
} from "../i18n/dict";
import { fill, swarmCopy } from "../i18n/swarm";
import { coverageRows } from "../i18n/survey";
import { apiMessage, localeFromRequest } from "../i18n/api";

/**
 * The bilingual surface.
 *
 * The brief was written in Dutch and the product lives in Groningen, so Dutch is
 * the default and English is a mirror. A mirror is only worth having if it is
 * *complete*: one untranslated paragraph and the English reader is reading a
 * different product. TypeScript already refuses a build where an English key is
 * missing; these tests cover what types cannot see — empty strings, keys that
 * kept the Dutch text in the English half, and placeholders that do not match.
 */
describe("B — the English mirror is complete", () => {
  it("every locale has the same key set", () => {
    const nlKeys = Object.keys(DICTS.nl).sort();
    const enKeys = Object.keys(DICTS.en).sort();
    expect(enKeys).toEqual(nlKeys);
    expect(nlKeys.length).toBeGreaterThan(150);
  });

  it("no value is empty in either language", () => {
    for (const loc of LOCALES) {
      for (const [k, v] of Object.entries(DICTS[loc])) {
        expect(v.trim(), `${loc}.${k}`).not.toBe("");
      }
    }
  });

  it("every {placeholder} in Dutch also exists in English", () => {
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(DICTS.nl) as DictKey[]) {
      expect(holes(DICTS.en[k]), k).toEqual(holes(DICTS.nl[k]));
    }
  });

  it("the Dutch and English halves are actually different strings", () => {
    // Some keys are identical on purpose, and the list is curated rather than
    // derived from whatever currently passes — otherwise this test would ratify
    // its own blind spots. Three kinds are allowed:
    //   * words that are the same in both languages: Instrument, Audit, Review,
    //     Caseload, Export, Item, Lab, Report, Label, Open, Seq, Ts, Actor,
    //     Subject, Hash, "demo transcript — no ASR called", "STOP"
    //   * language names in their own language: English, Nederlands
    //   * English copy that is deliberately the same string in both halves
    //     because it is an English quotation from the spec, or the product
    //     description
    // Anything else appearing here means a key was added to `en` by pasting the
    // Dutch line across — the exact failure this test exists to catch.
    const sameAllowed = new Set<string>([
      "brand.name",
      "meta.description",
      "nav.caseload",
      "nav.swarm",
      "nav.instrument",
      "nav.audit",
      "nav.review",
      "lang.to_en",
      "lang.to_nl",
      "lang.current_en",
      "honesty.demo",
      "home.cta.swarm",
      "home.tile.coverage",
      "home.cases.open",
      "home.cases.brief",
      "col.label",
      "col.open",
      "col.seq",
      "col.ts",
      "col.actor",
      "col.action",
      "col.subject",
      "col.hash",
      "hh.crumb",
      "hh.who.coach",
      "cap.demo.chip",
      "cap.rec.stop",
      "cap.confirmed.body3",
      "ver.eyebrow",
      "sw.tab.lab",
      "sw.tab.report",
      "sw.tab.instrument",
      "su.export",
      "su.export.v1",
      "su.item",
      "rv.eyebrow",
      "rv.spec_quote",
      "rv.tile.tests",
      "rv.tile.swarm",
      "common.none_short",
      "fm.demo",
    ]);
    const identical = (Object.keys(DICTS.nl) as DictKey[]).filter(
      (k) => DICTS.nl[k] === DICTS.en[k] && !sameAllowed.has(k),
    );
    expect(identical, `keys that never got translated: ${identical.join(", ")}`).toEqual([]);
  });

  it("Swarm Lab copy is complete in both languages", () => {
    const nl = swarmCopy("nl");
    const en = swarmCopy("en");
    expect(JSON.stringify(Object.keys(nl).sort())).toBe(JSON.stringify(Object.keys(en).sort()));
    expect(en.eyebrow).not.toBe(nl.eyebrow);
    expect(Object.keys(en.dims).sort()).toEqual(["adopt", "metric", "payer", "queue", "trust", "voice"]);
    // every event in the engine catalogue has a label in both languages
    for (const id of ["shutoff", "grant", "econobis", "leak", "success", "waitlist", "dutch", "coachcut"]) {
      expect(nl.events[id], `nl event ${id}`).toBeTruthy();
      expect(en.events[id], `en event ${id}`).toBeTruthy();
      expect(en.events[id]).not.toBe(nl.events[id]);
    }
  });

  it("the instrument coverage matrix has ten rows in both languages", () => {
    expect(coverageRows("nl")).toHaveLength(10);
    expect(coverageRows("en")).toHaveLength(10);
    expect(coverageRows("en")[0].need).not.toBe(coverageRows("nl")[0].need);
  });

  it("API refusals keep their E-code and change only their sentence", () => {
    // Same refusal, two readers. The code is the machine contract from §9.3 and
    // must never be translated; the sentence is read by a coach.
    expect(apiMessage("nl", "unknownDossier")).toBe("Onbekend dossier.");
    expect(apiMessage("en", "unknownDossier")).toBe("Unknown dossier.");
    expect(apiMessage("en", "unknownDossier")).not.toBe(apiMessage("nl", "unknownDossier"));
  });
});

describe("B — locale resolution", () => {
  it("defaults to Dutch for anything unknown", () => {
    expect(parseLocale(undefined)).toBe("nl");
    expect(parseLocale(null)).toBe("nl");
    expect(parseLocale("")).toBe("nl");
    expect(parseLocale("fr")).toBe("nl");
    expect(parseLocale("EN")).toBe("nl"); // case-sensitive on purpose
    expect(parseLocale("nl")).toBe("nl");
    expect(parseLocale("en")).toBe("en");
  });

  it("reads the cookie and nothing else on the request", () => {
    const withCookie = (c: string) => localeFromRequest(new Request("http://x", { headers: { cookie: c } }));
    expect(withCookie(`${LOCALE_COOKIE}=en`)).toBe("en");
    expect(withCookie(`a=1; ${LOCALE_COOKIE}=en; b=2`)).toBe("en");
    expect(withCookie("a=1")).toBe("nl");
    expect(withCookie(`${LOCALE_COOKIE}=de`)).toBe("nl");
    // no prefix confusion: a cookie whose name merely ends in ours is not ours
    expect(withCookie(`x${LOCALE_COOKIE}=en`)).toBe("nl");
  });

  it("interpolates, and leaves an unknown placeholder visible", () => {
    expect(interpolate("{n} rows", { n: 30 })).toBe("30 rows");
    expect(interpolate("{n} rows")).toBe("{n} rows");
    expect(interpolate("{n} rows", { other: 1 })).toBe("{n} rows");
    expect(t("en", "home.queue.sort.note")).toBe("Sorts on the file, not on the person.");
    expect(fill("{a}-{b}", { a: 1, b: 2 })).toBe("1-2");
  });
});

/**
 * A source-level sweep for prose that never made it into the dictionary.
 *
 * This exists because the first pass at translating the home page missed two
 * whole cards — the "why this exists" explainer and the seven stages. Every
 * other test was green: the dictionary was complete, the pages compiled, and the
 * English screen simply rendered Dutch beneath the fold. Types cannot catch a
 * string that is still a literal, so this greps the JSX text nodes.
 *
 * Files allowed to hold Dutch prose are listed, with the reason. The brief and
 * the household view are Dutch by requirement; the Dutch review body *is* the
 * Dutch artefact; the domain layer generates Dutch copy on purpose.
 */
const DUTCH_IN_JSX_ALLOWED = [
  "app/household/[id]/brief/page.tsx",
  "app/household/[id]/family/page.tsx",
  "app/review/_nl.tsx",
  // the English review quotes Dutch sentences verbatim when explaining a
  // deviation (D-02 quotes the debt sentence, D-03 the COPD leak, D-13 the
  // templates §8.3 gets wrong). Quoting the Dutch IS the argument there.
  "app/review/_en.tsx",
  "app/swarm/SwarmCanvas.tsx",
];

/** Words that are Dutch and are not English words. Deliberately narrow: a
 *  generous list would flag "is", "de", "van"-in-English-sentences and the test
 *  would be turned off within a week. Three of these in one text node is prose. */
const DUTCH_ONLY = new Set([
  "het", "een", "niet", "van", "voor", "wordt", "worden", "zijn", "deze", "geen",
  "ook", "maar", "kan", "heeft", "hebben", "door", "nog", "wel", "ons", "onze",
  "uw", "wij", "zij", "hun", "elke", "tussen", "zonder", "binnen", "vorige",
  "volgende", "nieuwe", "eerste", "laatste", "bij", "aan", "wat", "hoe", "waarom",
  "gebeurt", "staat", "komt", "maakt", "moet", "moeten", "zou", "zouden", "dit",
  "opgeslagen", "gedaan", "waarvoor", "daarom", "daarvan", "hiervan", "ermee",
  // "de" earns its place: it is not an English word, so two Dutch function
  // words plus "de" is prose, and "De zeven stadia" — a heading that was
  // genuinely missed — is caught by exactly this.
  "de",
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

describe("B — no untranslated prose is left as a literal", () => {
  it("every JSX text node outside the Dutch artefacts is in the dictionary", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const rel = file.replace(/^src\//, "").replace(/\\/g, "/");
      if (rel.startsWith("test")) continue;
      if (rel.startsWith("domain/")) continue;
      if (rel.startsWith("i18n/")) continue;
      if (DUTCH_IN_JSX_ALLOWED.includes(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/>\s*([^<>{}\n][^<>{}]*?)\s*</g)) {
        const text = m[1];
        if (text.trim().length < 12) continue;
        const words = new Set((text.toLowerCase().match(/[a-zA-Zà-ÿ]+/g) ?? []));
        const hits = [...words].filter((w) => DUTCH_ONLY.has(w));
        // One Dutch-only word is enough in a *sentence*; short labels ("de
        // datum") are rare enough that a length floor keeps the test loud
        // without flagging "De" in a product name.
        if (hits.length >= 1 && text.trim().length >= 14) offenders.push(`${rel}: "${text.trim().slice(0, 60)}" [${hits.join(", ")}]`);
      }
    }
    expect(offenders, `untranslated JSX prose:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("B — Dutch stays the primary artefact", () => {
  it("the default locale is Dutch", () => {
    expect(LOCALES[0]).toBe("nl");
  });

  it("the artefacts the spec requires in Dutch are still Dutch", () => {
    // §8.3: the brief is one A4 page, in Dutch. These headings are printed on
    // that page and are read aloud by the coach on the doorstep. They live in
    // the page, not in a translation file, and they must not drift into English
    // when someone tidies the copy — so they are asserted where they sit.
    const brief = readFileSync("src/app/household/[id]/brief/page.tsx", "utf8");
    for (const s of ["Vandaag vragen", "Wat is afgesproken", "Om over te dragen", "Niet opgenomen in dit overzicht"]) {
      expect(brief, `brief copy: ${s}`).toContain(s);
    }
    // §6.1: the household view is B1 Dutch, generated in the domain layer.
    const domain = readFileSync("src/domain/brief.ts", "utf8");
    expect(domain, "family copy: an appointment with no date").toContain("nog geen datum");
    const family = readFileSync("src/app/household/[id]/family/page.tsx", "utf8");
    for (const s of ["Uw dossier", "Wat is afgesproken", "Uw bezoeken"]) {
      expect(family, `family copy: ${s}`).toContain(s);
    }
  });

  it("the pages that render Dutch fixtures mark them as Dutch", () => {
    // `lang="nl"` on the article is what tells a screen reader to switch voice
    // on an otherwise English page. Without it the English shell would read
    // Dutch case notes with English phonetics.
    const brief = readFileSync("src/app/household/[id]/brief/page.tsx", "utf8");
    const family = readFileSync("src/app/household/[id]/family/page.tsx", "utf8");
    expect(brief).toContain('lang="nl"');
    expect(family).toContain('lang="nl"');
    // and an English reader is told, on screen, why the page is Dutch
    for (const src of [brief, family]) {
      expect(src).toContain('t("common.artefact_note")');
    }
  });
});
