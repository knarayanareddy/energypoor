// POST /api/swarm/fire { event_id, seed } → one run with that event injected.
// Deterministic: same seed + same event → byte-identical result.
import { NextResponse } from "next/server";
import { buildPersonas } from "@/domain/swarm/personas";
import { runSwarm, EVENTS } from "@/domain/swarm/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige body." }, { status: 400 });
  }
  const { event_id, seed, round, mixing, pressure } = (body ?? {}) as {
    event_id?: string;
    seed?: number;
    round?: number;
    mixing?: number;
    pressure?: number;
  };
  const ev = EVENTS.find((e) => e.id === event_id);
  if (!ev) {
    return NextResponse.json({ error: `Onbekende gebeurtenis: ${event_id}` }, { status: 400 });
  }
  const personas = buildPersonas(240, seed ?? 20261111);
  const opts = {
    seed: seed ?? 20261111,
    mixing: typeof mixing === "number" ? mixing : 0.18,
    pressure: typeof pressure === "number" ? pressure : 1,
  };
  const base = runSwarm(personas, opts);
  const injected = runSwarm(personas, {
    ...opts,
    inject: { round: Math.min(22, Math.max(3, round ?? 12)), id: ev.id },
  });

  return NextResponse.json({
    ok: true,
    event: ev,
    fired_at_round: Math.min(22, Math.max(3, round ?? 12)),
    base: summary(base),
    injected: summary(injected),
    delta: Object.fromEntries(
      (Object.keys(injected.final) as (keyof typeof injected.final)[]).map((d) => [
        d,
        injected.support[d] - base.support[d],
      ]),
    ),
    snapshots: injected.snapshots.map((s) => ({ round: s.round, means: s.means, support: s.support, event: s.event })),
  });
}

function summary(r: ReturnType<typeof runSwarm>) {
  return { support: r.support, final: r.final, events: r.events, fired: r.fired };
}
