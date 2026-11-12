/**
 * §6.1 row 1 — "an optional model path behind an env flag that is **off by
 * default**". These tests hold the three properties that make such a flag safe:
 * off is the default, a model result cannot widen the gate, and a failure is
 * visible rather than silent.
 */
import { describe, expect, it, vi } from "vitest";
import { mergeWithRules, modelPathEnabled, structure } from "../domain/structure";
import { extract } from "../domain/extract";
import { notes } from "../server/fixtures";

const NOTE = notes()[0] as any;
const TEXT = NOTE.text as string;
const VISIT = NOTE.date as string;

describe("the flag is off unless it is exactly on", () => {
  it("is off when unset, empty, or garbage", () => {
    expect(modelPathEnabled({} as any)).toBe(false);
    expect(modelPathEnabled({ ENERGYPOOR_MODEL: "" } as any)).toBe(false);
    expect(modelPathEnabled({ ENERGYPOOR_MODEL: "0" } as any)).toBe(false);
    expect(modelPathEnabled({ ENERGYPOOR_MODEL: "yes" } as any)).toBe(false);
    expect(modelPathEnabled({ ENERGYPOOR_MODEL: "ture" } as any)).toBe(false);
  });

  it("is on only for 1 or true", () => {
    expect(modelPathEnabled({ ENERGYPOOR_MODEL: "1" } as any)).toBe(true);
    expect(modelPathEnabled({ ENERGYPOOR_MODEL: "TRUE" } as any)).toBe(true);
  });
});

describe("with the flag off, the model path cannot make a network call", () => {
  it("returns the rules result, byte-identical, and never calls fetch", async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error("fetch must not be called when the flag is off");
    }) as unknown as typeof fetch;

    const out = await structure(TEXT, "HH-027", VISIT, { enabled: false, fetchImpl });
    const rules = extract(TEXT, "HH-027", VISIT);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(out.source).toBe("rules");
    expect(out.errors).toEqual([]);
    expect(JSON.stringify(out.actions)).toBe(JSON.stringify(rules.actions));
    expect(JSON.stringify(out.barriers)).toBe(JSON.stringify(rules.barriers));
    expect(JSON.stringify(out.restricted_hits)).toBe(JSON.stringify(rules.restricted_hits));
  });

  it("is the default: no options means no model", async () => {
    const out = await structure(TEXT, "HH-027", VISIT, { fetchImpl: (() => {
      throw new Error("no network");
    }) as any, enabled: undefined });
    // enabled defaults to modelPathEnabled(), which is false in the test env
    expect(out.source).toBe("rules");
  });
});

describe("when the flag is on but the model cannot be used, it says so", () => {
  const base = { enabled: true, apiKey: "k", model: "m" };

  it("reports missing configuration instead of pretending", async () => {
    const out = await structure(TEXT, "HH-027", VISIT, { enabled: true });
    expect(out.source).toBe("rules");
    expect(out.errors[0].code).toBe("E-MODEL-CONFIG");
  });

  it("falls back on an HTTP error", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 503 })) as any;
    const out = await structure(TEXT, "HH-027", VISIT, { ...base, fetchImpl });
    expect(out.source).toBe("rules");
    expect(out.errors[0].code).toBe("E-MODEL-HTTP");
    // and the rules actions are still all there
    expect(out.actions.length).toBeGreaterThan(0);
  });

  it("falls back when the endpoint throws", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as any;
    const out = await structure(TEXT, "HH-027", VISIT, { ...base, fetchImpl });
    expect(out.errors[0].code).toBe("E-MODEL-UNREACHABLE");
    expect(out.source).toBe("rules");
  });

  it("falls back on non-JSON content", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "not json {" } }] }), { status: 200 })) as any;
    const out = await structure(TEXT, "HH-027", VISIT, { ...base, fetchImpl });
    expect(out.errors[0].code).toBe("E-MODEL-INVALID");
    expect(out.source).toBe("rules");
  });
});

describe("a model answer cannot widen what reaches the brief", () => {
  const rules = extract(TEXT, "HH-027", VISIT);

  it("keeps the rules actions and appends only valid, new ones", () => {
    const merged = mergeWithRules(
      rules,
      JSON.stringify({
        actions: [
          { who: "coach", what_nl: "De meterstanden doorgeven", by_when: "2026-12-01", source_sentence: "x" },
        ],
        barriers: [],
      }),
    );
    expect(merged.source).toBe("model");
    expect(merged.actions.length).toBe(rules.actions.length + 1);
    expect(merged.actions.at(-1)!.what_nl).toBe("De meterstanden doorgeven");
  });

  it("rejects an unknown actor and says which field was wrong", () => {
    const merged = mergeWithRules(
      rules,
      JSON.stringify({ actions: [{ who: "de buurman", what_nl: "De sleutel ophalen" }], barriers: [] }),
    );
    expect(merged.actions.length).toBe(rules.actions.length);
    expect(merged.errors[0].code).toBe("E-MODEL-FIELD");
  });

  it("rejects an action with no concrete verb+object", () => {
    const merged = mergeWithRules(
      rules,
      JSON.stringify({ actions: [{ who: "coach", what_nl: "ok" }], barriers: [] }),
    );
    expect(merged.actions.length).toBe(rules.actions.length);
    expect(merged.errors[0].detail).toMatch(/verb\+object/);
  });

  it("rejects a bad date rather than storing it", () => {
    const merged = mergeWithRules(
      rules,
      JSON.stringify({ actions: [{ who: "coach", what_nl: "De brief opsturen", by_when: "next week" }], barriers: [] }),
    );
    expect(merged.actions.length).toBe(rules.actions.length);
    expect(merged.errors[0].detail).toMatch(/bad date/);
  });

  it("keeps the restricted hit on a note the model also touches", () => {
    // N-010 is the health/debt note. The rules engine must flag it, and a model
    // answer that adds an action must not remove or launder that flag.
    const healthNote = notes().find((n) => n.id === "N-010")!;
    const r = extract(healthNote.text, healthNote.household_ref, healthNote.date);
    expect(r.restricted_hits.length).toBeGreaterThanOrEqual(2);
    expect(r.restricted_hits.some((h) => /COPD/i.test(h.value))).toBe(true);

    const merged = mergeWithRules(
      r,
      JSON.stringify({
        actions: [{ who: "coach", what_nl: "De zuurstofapparatuur laten nakijken", source_sentence: "Ze heeft COPD" }],
        barriers: [],
      }),
    );
    // the added action is present and its source sentence is preserved...
    expect(merged.actions.at(-1)!.source_sentence).toBe("Ze heeft COPD");
    // ...and every restricted hit the rules found is still there
    expect(JSON.stringify(merged.restricted_hits)).toBe(JSON.stringify(r.restricted_hits));
  });

  it("does not duplicate an action the rules engine already found", () => {
    const existing = rules.actions[0];
    const merged = mergeWithRules(
      rules,
      JSON.stringify({ actions: [{ who: existing.who, what_nl: existing.what_nl.toUpperCase() }], barriers: [] }),
    );
    expect(merged.actions.length).toBe(rules.actions.length);
  });

  it("does not merge barriers from the model at all", () => {
    const merged = mergeWithRules(
      rules,
      JSON.stringify({ actions: [], barriers: [{ kind: "gezondheid", note_nl: "COPD" }] }),
    );
    expect(JSON.stringify(merged.barriers)).toBe(JSON.stringify(rules.barriers));
  });

  it("flags an unknown barrier kind", () => {
    const merged = mergeWithRules(
      rules,
      JSON.stringify({ actions: [], barriers: [{ kind: "pech", note_nl: "x" }] }),
    );
    expect(merged.errors.some((e) => /unknown barrier kind/.test(e.detail))).toBe(true);
  });
});
