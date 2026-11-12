import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPersonas, labelShareFG } from "../domain/swarm/personas";
import { runSwarm, EVENTS } from "../domain/swarm/engine";
import { BASE_SEED, NAMED_TESTS, runEnsemble } from "../domain/swarm/ensemble";
import { ARCH, ARCH_ORDER, DIMS, N_AGENTS, quotas } from "../domain/swarm/archetypes";
import { mulberry32, quantile, shuffle, wilson } from "../domain/swarm/rng";
import { answerInstrument, likert5 } from "../domain/swarm/instrument";
import { rel, sourceFiles } from "../domain/invariants";

const personas = buildPersonas(N_AGENTS, BASE_SEED);

describe("rng", () => {
  it("mulberry32 is deterministic for a seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("shuffle is a permutation and never the identity for n>8 on this seed", () => {
    const arr = Array.from({ length: 40 }, (_, i) => i);
    const once = shuffle(arr, mulberry32(7));
    expect([...once].sort((x, y) => x - y)).toEqual(arr);
    expect(once).not.toEqual(arr);
  });

  it("wilson matches the published example", () => {
    // 137/200 → p = .685, CI ≈ .617–.746 (spec §11.7)
    const w = wilson(137 / 200, 200);
    expect(w.p).toBeCloseTo(0.685, 3);
    expect(w.lo).toBeCloseTo(0.617, 2);
    expect(w.hi).toBeCloseTo(0.746, 2);
  });

  it("quantile interpolates", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([5], 0.9)).toBe(5);
  });
});

describe("quotas and personas (§11.3, §11.4)", () => {
  it("N = 240 and the quotas are exact", () => {
    const q = quotas();
    const total = ARCH_ORDER.reduce((a, k) => a + q[k], 0);
    expect(total).toBe(N_AGENTS);
    expect(q.hh_nl).toBe(58);
    expect(q.hh_mig).toBe(34);
    expect(q.hh_elderly).toBe(26);
    expect(q.coach).toBe(38);
    expect(q.muni).toBe(22);
    expect(q.corp).toBe(20);
    expect(q.landlord).toBe(16);
    expect(q.supplier).toBe(14);
    expect(q.welfare).toBe(12);
  });

  it("builds exactly 240 personas, all synthetic, all with fixed-list names", () => {
    expect(personas.length).toBe(240);
    expect(personas.every((p) => p.synthetic === true)).toBe(true);
    expect(new Set(personas.map((p) => p.id)).size).toBe(240);
    for (const p of personas) expect(p.name_nl).toMatch(/ [A-Z]\.$/);
  });

  it("is deterministic: same seed → identical personas", () => {
    const again = buildPersonas(240, BASE_SEED);
    expect(JSON.stringify(again)).toBe(JSON.stringify(personas));
  });

  it("keeps priors within ±0.04 of the archetype and behav within ±0.05", () => {
    for (const p of personas) {
      const a = ARCH[p.archetype];
      for (const d of DIMS) expect(Math.abs(p.priors[d] - a.priors[d])).toBeLessThanOrEqual(0.0400001);
      expect(Math.abs(p.behav.voice - a.behav.voice)).toBeLessThanOrEqual(0.0500001);
      expect(Math.abs(p.behav.susceptibility - a.behav.susceptibility)).toBeLessThanOrEqual(0.0500001);
      expect(Math.abs(p.behav.conviction - a.behav.conviction)).toBeLessThanOrEqual(0.0500001);
    }
  });

  it("is 62% F/G among household agents", () => {
    const share = labelShareFG(personas);
    expect(share).toBeGreaterThanOrEqual(0.55);
    expect(share).toBeLessThanOrEqual(0.70);
  });
});

describe("§11.5 engine shape", () => {
  it("fires exactly three distinct events, all inside the eligible window", () => {
    for (let s = 0; s < 25; s++) {
      const res = runSwarm(personas, { seed: BASE_SEED + s * 7919 });
      expect(res.events.length).toBe(3);
      expect(new Set(res.events.map((e) => e.id)).size).toBe(3);
      for (const e of res.events) {
        expect(e.round).toBeGreaterThanOrEqual(3);
        expect(e.round).toBeLessThanOrEqual(22);
      }
    }
  });

  it("every node has 6–7 neighbours and no self-loops", () => {
    const res = runSwarm(personas, { seed: BASE_SEED });
    for (let i = 0; i < personas.length; i++) {
      const n = res.neighbours[i];
      expect(n.length).toBeGreaterThanOrEqual(6);
      expect(n.length).toBeLessThanOrEqual(7);
      expect(n).not.toContain(i);
    }
  });

  it("mixing = 0 collapses to same-archetype ties only (nine rooms)", () => {
    const res = runSwarm(personas, { seed: BASE_SEED, mixing: 0 });
    for (let i = 0; i < personas.length; i++) {
      for (const j of res.neighbours[i]) expect(personas[j].archetype).toBe(personas[i].archetype);
    }
  });

  it("mixing = 1 makes the population almost fully mixed", () => {
    const res = runSwarm(personas, { seed: BASE_SEED, mixing: 1 });
    let cross = 0;
    let total = 0;
    for (let i = 0; i < personas.length; i++) {
      for (const j of res.neighbours[i]) {
        total++;
        if (personas[j].archetype !== personas[i].archetype) cross++;
      }
    }
    expect(cross / total).toBeGreaterThan(0.55);
  });

  it("A7 — at round 24 support is computed for all six dimensions with no NaN", () => {
    const res = runSwarm(personas, { seed: BASE_SEED });
    for (const d of DIMS) {
      expect(Number.isFinite(res.final[d])).toBe(true);
      expect(Number.isFinite(res.support[d])).toBe(true);
      expect(res.support[d]).toBeGreaterThanOrEqual(0);
      expect(res.support[d]).toBeLessThanOrEqual(1);
    }
    expect(res.snapshots.length).toBe(25);
  });

  it("is deterministic per seed, and different across seeds", () => {
    const a = runSwarm(personas, { seed: 123 });
    const b = runSwarm(personas, { seed: 123 });
    const c = runSwarm(personas, { seed: 124 });
    expect(JSON.stringify(a.final)).toBe(JSON.stringify(b.final));
    expect(JSON.stringify(a.final)).not.toBe(JSON.stringify(c.final));
  });

  it("injecting an event is reproducible and drops the duplicate story", () => {
    const a = runSwarm(personas, { seed: BASE_SEED, inject: { round: 12, id: "leak" } });
    const b = runSwarm(personas, { seed: BASE_SEED, inject: { round: 12, id: "leak" } });
    expect(JSON.stringify(a.final)).toBe(JSON.stringify(b.final));
    expect(a.events.filter((e) => e.id === "leak").length).toBe(1);
    expect(a.events.length).toBe(3);
    expect(a.fired).toContain("leak");
  });

  it("every event moves at least two dimensions, and at least three push the design back", () => {
    // §11.6's rule is about the SET, not each event: "a set of events that only
    // ever help the pitch is a rigged simulation". Individual all-positive
    // events are allowed and the spec's own table contains three of them.
    for (const e of EVENTS) expect(Object.keys(e.effect).length).toBeGreaterThanOrEqual(2);
    const backwards = EVENTS.filter((e) => Object.values(e.effect).some((v) => v < 0));
    expect(backwards.length).toBeGreaterThanOrEqual(3);
    // count and name them, so a regression shows which event stopped pushing back
    expect(backwards.map((e) => e.id)).toEqual([
      "shutoff",
      "econobis",
      "leak",
      "waitlist",
      "fraud",
      "coachcut",
    ]);
    // the effects must match §11.6 exactly — no invented dimension
    expect(EVENTS.find((e) => e.id === "grant")!.effect).toEqual({ payer: 0.12, adopt: 0.06 });
    expect(EVENTS.find((e) => e.id === "success")!.effect).toEqual({ metric: 0.1, payer: 0.08, trust: 0.05 });
    expect(EVENTS.find((e) => e.id === "dutch")!.effect).toEqual({ trust: 0.08, voice: 0.04 });
  });
});

describe("§11.7 ensemble", () => {
  const ens = runEnsemble(personas, 40, { seed: BASE_SEED }, true);

  it("reports every named frequency, each with n, p and a Wilson interval", () => {
    // §11.7 names six; §13.1 F6 requires a seventh (QSORT). All seven are kept.
    expect(ens.frequencies.length).toBe(7);
    for (const f of ens.frequencies) {
      expect(f.n).toBeGreaterThan(0);
      expect(f.p).toBeGreaterThanOrEqual(0);
      expect(f.p).toBeLessThanOrEqual(1);
      expect(f.ci.lo).toBeLessThanOrEqual(f.p);
      expect(f.ci.hi).toBeGreaterThanOrEqual(f.p);
    }
  });

  it("the line format matches the regex in A8", () => {
    const re = /\d+ \/ \d+ runs \(p = 0\.\d{3}, 95% CI 0\.\d{3}–0\.\d{3}\)/;
    for (const f of ens.frequencies) {
      const line = `${f.hits} / ${f.n} runs (p = ${f.p.toFixed(3)}, 95% CI ${f.ci.lo.toFixed(3)}–${f.ci.hi.toFixed(3)})`;
      expect(line).toMatch(re);
    }
  });

  it("QSCANDAL is conditioned on runs that fired the leak", () => {
    const q = ens.frequencies.find((f) => f.id === "QSCANDAL")!;
    expect(q.n).toBeLessThanOrEqual(40);
  });

  it("every dimension has a histogram that sums to the number of runs", () => {
    for (const d of ens.dim_stats) {
      expect(d.hist.reduce((a, b) => a + b.n, 0)).toBe(40);
      expect(d.support_hist.reduce((a, b) => a + b.n, 0)).toBe(40);
    }
  });

  it("every persona answers all 14 items", () => {
    const run = runSwarm(personas, { seed: BASE_SEED });
    for (let i = 0; i < 5; i++) {
      const answers = answerInstrument(personas[i], run.finalOpinions[i], i);
      expect(answers.length).toBe(14);
      expect(answers.map((a) => a.no)).toEqual(Array.from({ length: 14 }, (_, k) => k + 1));
    }
  });

  it("likert5 maps 0→1 and 1→5", () => {
    expect(likert5(0)).toBe(1);
    expect(likert5(1)).toBe(5);
    expect(likert5(0.5)).toBe(3);
  });

  it("abstention rises as trust falls", () => {
    const low = personas.map((p, i) => ({ p, i, trust: 0.1 }));
    const high = personas.map((p, i) => ({ p, i, trust: 0.9 }));
    const count = (rows: { p: typeof personas[0]; i: number; trust: number }[]) =>
      rows.filter(({ p, i, trust }) => {
        const o = { ...p.priors, trust };
        return answerInstrument(p, o, i).some((a) => a.abstained);
      }).length;
    expect(count(low)).toBeGreaterThan(count(high));
  });
});

describe("T-17 — the simulation cannot steer the allocation or file logic", () => {
  it("no file under src/domain/ outside swarm/ imports swarm", () => {
    const offenders: string[] = [];
    for (const f of sourceFiles()) {
      const r = rel(f);
      if (r.startsWith("domain/swarm/")) continue;
      if (r.startsWith("test/")) continue;
      const code = readFileSync(f, "utf8");
      if (/from\s+["'][^"']*domain\/swarm|from\s+["']\.\/swarm|from\s+["']\.\.\/swarm/.test(code)) {
        // Consumers of the simulation, all deliberately outside the file logic:
        // the lab UI itself, its canvas, its two API routes, and the survey
        // exporter (which reports what agents said, never what a household is).
        if (r.startsWith("app/swarm/")) continue;
        if (r.startsWith("app/api/swarm/")) continue;
        if (r === "components/SwarmLab.tsx") continue;
        // the lab's UI copy: it imports the `Dim` *type* to key six translated
        // labels, and must not import any behaviour.
        if (r === "i18n/swarm.ts") {
          expect(code).toMatch(/import\s+type\s+\{[^}]*\}\s+from\s+["']@\/domain\/swarm/);
          expect(code, "i18n/swarm.ts may only import types from the engine").not.toMatch(
            /import\s+(?!type)[^;]*domain\/swarm/,
          );
          continue;
        }
        // the survey page and route present the instrument; they never run a
        // simulation that could reach the file logic
        if (r === "app/api/survey/route.ts") continue;
        if (r === "app/survey/page.tsx") {
          expect(code).not.toMatch(/runEnsemble/);
          continue;
        }
        // the caseload home page prints the archetype table as *context*
        if (r === "app/page.tsx") {
          const onlyStats = !/runSwarm|runEnsemble|buildPersonas|answerInstrument/.test(code);
          expect(onlyStats, "app/page.tsx may show the prior table but must not run the sim").toBe(true);
          continue;
        }
        offenders.push(r);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no note / brief / correct route imports the swarm", () => {
    const routes = [
      "app/api/note/route.ts",
      "app/api/note/confirm/route.ts",
      "app/api/correct/route.ts",
      "app/api/household/[ref]/route.ts",
      "app/api/household/[ref]/brief/route.ts",
    ];
    for (const r of routes) {
      const code = readFileSync(path.join(process.cwd(), "src", r), "utf8");
      expect(code, r).not.toMatch(/swarm/);
    }
  });
});

describe("A10 — at least one falsifier breaks the pitch", () => {
  it("the committed report has ≥1 would_break_pitch row", () => {
    const report = JSON.parse(readFileSync(path.join(process.cwd(), "data", "swarm", "report.json"), "utf8"));
    const broken = report.falsifiers.filter((f: { would_break_pitch: boolean }) => f.would_break_pitch);
    expect(broken.length).toBeGreaterThanOrEqual(1);
    // and the falsifiers file was written before the run
    const fals = JSON.parse(readFileSync(path.join(process.cwd(), "data", "swarm", "falsifiers.json"), "utf8"));
    expect(fals.length).toBe(6);
    for (const f of fals) expect(f.written_at).toBeTruthy();
  });

  it("the six headline tests exist with the ids the report renders", () => {
    expect(NAMED_TESTS.map((t) => t.id).sort()).toEqual(
      ["QADOPT", "QMETRIC", "QPAYER", "QSCANDAL", "QSORT", "QTRUST", "QVOICE"].sort(),
    );
  });
});
