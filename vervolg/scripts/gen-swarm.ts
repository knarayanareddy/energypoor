// scripts/gen-swarm.ts — deterministic persona + ensemble generator
// Writes data/swarm/personas.json and data/swarm/runs.json (200 ensemble runs).
//
// The falsifiers in data/swarm/falsifiers.json were committed BEFORE this run.
// Nothing here may be tuned to make them pass; the script reports what it finds.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildPersonas } from "../src/domain/swarm/personas";
import { runSwarm, EVENTS } from "../src/domain/swarm/engine";
import { BASE_SEED, NAMED_TESTS, runEnsemble } from "../src/domain/swarm/ensemble";
import { ARCH, ARCH_ORDER, DIMS, N_AGENTS, quotas, type Dim } from "../src/domain/swarm/archetypes";
import { wilson } from "../src/domain/swarm/rng";

const RUNS = Number(process.env.SWARM_RUNS ?? 200);
const SEED = BASE_SEED;

const personas = buildPersonas(N_AGENTS, SEED);
writeFileSync("data/swarm/personas.json", JSON.stringify(personas, null, 1) + "\n");

const t0 = Date.now();
const ensemble = runEnsemble(personas, RUNS, { seed: SEED }, true);
const elapsed = Date.now() - t0;

// compact per-run record: what the report needs, nothing more
interface RunRecord {
  seed: number;
  support: Record<Dim, number>;
  final: Record<Dim, number>;
  fired: string[];
}
const runs: RunRecord[] = [];
for (let r = 0; r < RUNS; r++) {
  const seed = SEED + r * 7919;
  const res = runSwarm(personas, { seed });
  runs.push({ seed, support: res.support, final: res.final, fired: res.fired });
}
writeFileSync(
  "data/swarm/runs.json",
  JSON.stringify({ seed_base: SEED, runs: RUNS, rounds: 24, mixing: 0.18, pressure: 1, records: runs }) + "\n",
);

// --- falsifiers: evaluated, never adjusted ---
interface Falsifier {
  id: string;
  written_at: string;
  claim: string;
  test: string;
  expected: boolean;
  claim_holds_when: "frequency_gt_half" | "frequency_le_half";
  if_false?: string;
  if_false_but_expected_false?: string;
}

const falsifiers = JSON.parse(readFileSync("data/swarm/falsifiers.json", "utf8")) as Falsifier[];

const evaluated = falsifiers.map((f) => {
  const freq = ensemble.frequencies.find((x) => x.id === f.test);
  const p = freq?.p ?? 0;
  const holds = f.claim_holds_when === "frequency_gt_half" ? p > 0.5 : p <= 0.5;
  // would_break_pitch: the claim we bet on did NOT hold
  const wouldBreak = !holds;
  return {
    ...f,
    frequency_p: p,
    hits: freq?.hits ?? 0,
    n: freq?.n ?? 0,
    ci_lo: freq?.ci.lo ?? 0,
    ci_hi: freq?.ci.hi ?? 0,
    claim_holds: holds,
    would_break_pitch: wouldBreak,
    reading_en: holds ? "The claim holds." : (f.if_false ?? f.if_false_but_expected_false ?? "The claim does not hold."),
  };
});

const report = {
  generated_at: new Date().toISOString(),
  seed_base: SEED,
  runs: RUNS,
  rounds: 24,
  n_agents: personas.length,
  elapsed_ms: elapsed,
  quotas: quotas(),
  archetypes: ARCH_ORDER.map((k) => ({
    key: k,
    label_nl: ARCH[k].label_nl,
    n: quotas()[k],
    household: ARCH[k].household,
    who_nl: ARCH[k].who_nl,
    priors: ARCH[k].priors,
    behav: ARCH[k].behav,
  })),
  dims: ensemble.dims,
  dim_stats: ensemble.dim_stats,
  frequencies: ensemble.frequencies.map((f) => ({
    ...f,
    ci: wilson(f.p, f.n),
    line: `${f.id}  ${f.hits} / ${f.n} runs (p = ${f.p.toFixed(3)}, 95% CI ${f.ci.lo.toFixed(3)}–${f.ci.hi.toFixed(3)})`,
    question_nl: NAMED_TESTS.find((t) => t.id === f.id)!.question_nl,
    question_en: NAMED_TESTS.find((t) => t.id === f.id)!.question_en,
  })),
  events_seen: ensemble.events_seen,
  by_archetype: ensemble.by_archetype,
  abstention: ensemble.abstention,
  falsifiers: evaluated,
  event_catalogue: EVENTS.map((e) => ({ id: e.id, label_nl: e.label_nl, detail_nl: e.detail_nl, effect: e.effect })),
  tests: NAMED_TESTS,
  honesty: ["GEEN LLM", "SYNTHETISCH", "GEEN VOORSPELLING", "PRIOREN ZIJN AANNAMES"],
};

writeFileSync("data/swarm/report.json", JSON.stringify(report, null, 1) + "\n");

// --- console output, exactly as §11.7 wants it printed ---
console.log(`\n${N_AGENTS} personas · ${RUNS} runs · seed ${SEED} · ${elapsed} ms`);
for (const f of report.frequencies) console.log(f.line);
console.log("");
for (const d of report.dim_stats) {
  console.log(
    `${d.dim.padEnd(7)} mean=${d.mean.toFixed(3)} sd=${d.sd.toFixed(3)} p10=${d.p10.toFixed(2)} p50=${d.p50.toFixed(2)} p90=${d.p90.toFixed(2)} support=${d.support_mean.toFixed(3)}`,
  );
}
console.log("\nFalsifiers:");
for (const f of evaluated) {
  console.log(`  ${f.id} ${f.test.padEnd(9)} p=${f.frequency_p.toFixed(3)} holds=${f.claim_holds} would_break_pitch=${f.would_break_pitch}`);
}
const broken = evaluated.filter((f) => f.would_break_pitch);
console.log(`\n${broken.length} falsifier(s) break the pitch: ${broken.map((f) => f.id).join(", ") || "none"}`);
if (!existsSync("data/swarm/falsifiers.json")) throw new Error("falsifiers.json missing");
