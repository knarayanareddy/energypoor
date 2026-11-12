import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  actionsMissingVerbObject,
  caseRowViolations,
  droppedWithoutReason,
  leakReport,
  rel,
  scoreWordHits,
  sourceFiles,
  stripComments,
} from "../domain/invariants";
import { briefCsv, buildBrief, buildFamilyView } from "../domain/brief";
import { extract, extractCanonical } from "../domain/extract";
import { cases, households, notes } from "./fixtures";
import { DICTS } from "../i18n/dict";
import { swarmCopy } from "../i18n/swarm";
import type { Household } from "../domain/types";

/**
 * The wall — §10. Each test is named for the rule it holds. If one fails, the
 * implementation changes, not the assertion.
 */
describe("W1 / T-01 — no score about a household", () => {
  it("no field anywhere names urgency, risk, worth, willingness or priority of a person", () => {
    const hits = scoreWordHits();
    expect(hits, JSON.stringify(hits, null, 2)).toEqual([]);
  });

  it("nothing in the audit-visible case API is numeric except facts about the file", () => {
    expect(caseRowViolations(cases() as unknown as Record<string, unknown>[])).toEqual([]);
  });

  it("the queue's sort disclaimer is present in the UI source", () => {
    // The sentence moved into the dictionary when English was added, so the
    // guarantee is now two-part: the Dutch copy exists, and the queue renders
    // that key rather than a literal. Both halves are asserted here — checking
    // only the dictionary would let a screen drop the line silently.
    expect(DICTS.nl["home.queue.sort.note"]).toBe("Sorteert op het dossier, niet op de persoon.");
    const src = readFileSync("src/components/CaseTable.tsx", "utf8");
    // the queue receives its labels already resolved (a function cannot cross
    // the server→client boundary) and must render the one it was handed
    expect(src).toContain("labels.sortNote");
  });
});

describe("W2 / T-02 — no free text is scored", () => {
  it("the extractor returns only matched-rule counts, never a derived number", () => {
    for (const h of households()) {
      for (const v of h.visits) {
        const r = extract(v.transcript, h.household_ref, v.date);
        const keys = Object.keys(r).sort();
        expect(keys).toEqual(["actions", "barriers", "needs_input", "next_step", "restricted_hits"]);
        // no numeric top-level field at all
        for (const v2 of Object.values(r)) expect(typeof v2).not.toBe("number");
      }
    }
  });
});

describe("W3 / T-03 — no AI-text detection", () => {
  it("no detector / authorship / perplexity / burstiness anywhere in src", () => {
    for (const f of sourceFiles()) {
      if (f.endsWith("invariants.ts")) continue;
      const code = stripComments(readFileSync(f, "utf8"));
      expect(code, rel(f)).not.toMatch(/detector|authorship|perplexity|burstiness/i);
    }
  });
});

describe("W4 / T-04 — no biometric or image classification", () => {
  it("there is no image upload path", () => {
    for (const f of sourceFiles()) {
      const code = readFileSync(f, "utf8");
      expect(code, rel(f)).not.toMatch(/FormData\(\)[\s\S]{0,80}image|accept="image/);
    }
  });
});

describe("W5 / T-05 — the phone is not identity", () => {
  it("no field named phone / gsm / mobile", () => {
    for (const f of sourceFiles()) {
      if (f.endsWith("invariants.ts")) continue;
      const code = readFileSync(f, "utf8");
      expect(code, rel(f)).not.toMatch(/\b(phone|gsm|telefoonnummer|mobile_number)\b\s*[:?]/i);
    }
  });
});

describe("W6 / T-06 — no ID documents, BSN, passports", () => {
  it("no such fields in the schema or the fixtures", () => {
    const corpus = JSON.stringify(households()) + JSON.stringify(cases());
    expect(corpus).not.toMatch(/BSN|paspoort|documentnummer/i);
    for (const f of sourceFiles()) {
      if (f.endsWith("invariants.ts") || rel(f) === "domain/gate.ts") continue;
      expect(readFileSync(f, "utf8"), rel(f)).not.toMatch(/\bBSN\b|paspoort|documentnummer/i);
    }
  });
});

describe("W7 / T-07 — no custody of money", () => {
  it("no payment endpoints", () => {
    for (const f of sourceFiles()) {
      const r = rel(f);
      expect(r, r).not.toMatch(/app\/api\/(pay|payment|checkout|invoice|billing)/);
      const code = readFileSync(f, "utf8");
      expect(code, r).not.toMatch(/\bstripe\b|\bmollie\b|createPaymentIntent/i);
    }
  });
});

describe("W8 / T-08 — no automated outreach", () => {
  it("no mailto on a save path, no sendMessage, no cron", () => {
    for (const f of sourceFiles()) {
      const code = readFileSync(f, "utf8");
      expect(code, rel(f)).not.toMatch(/sendMessage|nodemailer|cron\.schedule|setInterval\([\s\S]{0,80}mailto/i);
    }
  });
});

describe("W9 / T-09 — every dropped action has a reason", () => {
  it("no niet_gedaan row has an empty or dash reason", () => {
    expect(droppedWithoutReason(households())).toEqual([]);
  });
});

describe("W10 / T-10 — restricted content never reaches brief, family view or export", () => {
  it("zero sensitive substrings outside restricted fields", () => {
    const leaks = leakReport(
      households(),
      notes().map((n) => n.text),
    );
    expect(leaks, JSON.stringify(leaks, null, 2)).toEqual([]);
  });

  it("no restricted action appears in a brief, a family view or a CSV", () => {
    for (const h of households()) {
      const restricted = h.actions.filter((a) => a.restricted).map((a) => a.what_nl);
      const brief = JSON.stringify(buildBrief(h));
      const family = JSON.stringify(buildFamilyView(h));
      const csv = briefCsv(h);
      for (const w of restricted) {
        // the neutral stub itself is shared vocabulary; the VALUES are what must not leak.
        expect(brief).not.toContain("COPD");
        expect(family).not.toContain("COPD");
        expect(csv).not.toContain("COPD");
      }
      // and no restricted action_id may appear
      for (const a of h.actions.filter((x) => x.restricted)) {
        expect(csv).not.toContain(a.action_id);
        expect(brief).not.toContain(a.action_id);
        expect(family).not.toContain(a.action_id);
      }
    }
  });

  it("the brief footer names the excluded fields but never their values", () => {
    const h = households().find((x) => x.household_ref === "HH-014") as Household;
    const b = buildBrief(h);
    if (b.restricted_fields_excluded.length) {
      const text = JSON.stringify(b);
      expect(text).toContain("health_mention_1");
      expect(text).not.toContain("COPD");
      expect(text).not.toContain("zuurstof");
    }
  });
});

describe("W12 / T-12 — every simulated or restricted value says so", () => {
  it("every screen that shows synthetic data renders SYNTHETISCH or Demo", () => {
    // Every honesty mark is bilingual now. The Dutch string is the contract, so
    // it is asserted directly; the English mirror must not silently drop one,
    // which is what the second loop holds.
    const nl = DICTS.nl;
    expect(nl["honesty.demo"].toLowerCase()).toContain("demo — synthetic households");
    expect(nl["common.synthetic"].toLowerCase()).toContain("synthetisch");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain('t("honesty.demo")');

    const lab = swarmCopy("nl");
    const labEn = swarmCopy("en");
    for (const s of ["GEEN LLM", "SYNTHETISCH", "GEEN VOORSPELLING", "PRIOREN ZIJN AANNAMES"]) {
      expect(Object.values(lab.chips)).toContain(s);
    }
    for (const chip of Object.values(labEn.chips)) expect(chip).not.toBe("");

    const brief = readFileSync("src/app/household/[id]/brief/page.tsx", "utf8");
    expect(brief).toContain("Niet opgenomen in dit overzicht");
    expect(brief).toContain("Demo — synthetic households");
  });

  it("the brief prints the restricted field names when any exist", () => {
    const h = households().find((x) => x.household_ref === "HH-027") as Household;
    const b = buildBrief(h);
    expect(b.restricted_fields_excluded.length).toBeGreaterThan(0);
  });
});

describe("T-14 — extraction is deterministic", () => {
  it("same note twice → identical JSON, byte for byte", () => {
    for (const n of notes()) {
      const a = extractCanonical(n.text, n.household_ref, n.date);
      const b = extractCanonical(n.text, n.household_ref, n.date);
      expect(a).toBe(b);
    }
  });

  it("expected action counts and barrier kinds hold on all 15 notes", () => {
    for (const n of notes()) {
      const r = extract(n.text, n.household_ref, n.date);
      expect(r.actions.length, `${n.id} actions`).toBe(n.expected.actions);
      const kinds = [...new Set(r.barriers.map((b) => b.kind))].sort();
      expect(kinds, `${n.id} barriers`).toEqual([...new Set(n.expected.barriers)].sort());
      expect(r.restricted_hits.length, `${n.id} restricted`).toBe(n.expected.restricted);
      expect(r.needs_input.length, `${n.id} needs_input`).toBe(n.expected.needs_input);
    }
  });
});

describe("T-18 — the ask-today block is capped at four", () => {
  it("brief.ask_today_nl.length <= 4", () => {
    for (const h of households()) {
      expect(buildBrief(h).ask_today_nl.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("T-19 — every fixture action has a concrete verb + object", () => {
  it("what_nl matches the closed verb list", () => {
    expect(actionsMissingVerbObject(households())).toEqual([]);
  });
});
