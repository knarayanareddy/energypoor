// GET /api/swarm?runs=200&seed=20261111
// Returns the ensemble report, the archetype table, the dimensions and the
// synthetic personas — everything the lab needs, so the client never calls an
// external service. Deterministic: same seed → same JSON.
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildPersonas } from "@/domain/swarm/personas";
import { NAMED_TESTS, runEnsemble } from "@/domain/swarm/ensemble";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runs = Math.min(400, Math.max(10, Number(url.searchParams.get("runs") ?? 200)));
  const seed = Number(url.searchParams.get("seed") ?? 20261111);
  const t0 = Date.now();

  const report = JSON.parse(readFileSync(path.join(process.cwd(), "data", "swarm", "report.json"), "utf8")) as Record<
    string,
    unknown
  >;

  // if the caller asked for a non-default size or seed, compute it live
  const isDefault = runs === 200 && seed === 20261111;
  let payload: Record<string, unknown> = report;
  if (!isDefault) {
    const personas = buildPersonas(240, seed);
    const ens = runEnsemble(personas, runs, { seed }, true);
    payload = {
      ...report,
      seed_base: seed,
      runs,
      frequencies: ens.frequencies.map((f) => ({ ...f, line: fmt(f) })),
      dim_stats: ens.dim_stats,
      events_seen: ens.events_seen,
      by_archetype: ens.by_archetype,
      abstention: ens.abstention,
      live: true,
    };
  }

  const personas = buildPersonas(240, seed);
  return NextResponse.json({
    ...payload,
    personas: personas.map((p) => ({ ...p, priors: p.priors, behav: p.behav })),
    tests: NAMED_TESTS,
    computed_ms: Date.now() - t0,
  });
}

function fmt(f: { id: string; hits: number; n: number; p: number; ci: { lo: number; hi: number } }): string {
  return `${f.id}  ${f.hits} / ${f.n} runs (p = ${f.p.toFixed(3)}, 95% CI ${f.ci.lo.toFixed(3)}–${f.ci.hi.toFixed(3)})`;
}
