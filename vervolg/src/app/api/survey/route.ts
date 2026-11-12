// GET /api/survey?version=v1|v2 — CSV export of the synthetic responses.
// v1 is the ten-question instrument a team would actually write; its column set
// is shown so the coverage gap is visible without a slide.
import { NextResponse } from "next/server";
import { buildPersonas } from "@/domain/swarm/personas";
import { runSwarm } from "@/domain/swarm/engine";
import { answerInstrument, toCsv, ITEMS, V1_ITEMS } from "@/domain/swarm/instrument";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const version = url.searchParams.get("version") === "v1" ? "v1" : "v2";
  const personas = buildPersonas(240, 20261111);
  const run = runSwarm(personas, { seed: 20261111 });

  if (version === "v1") {
    const rows = personas.map((p, i) => ({
      respondent_id: p.id,
      synthetic: "SYNTHETISCH",
      biggest_difficulty: ITEMS.find((x) => x.id === "q_barrier") ? answerInstrument(p, run.finalOpinions[i], i).find((a) => a.item === "q_barrier")?.value : "",
      likelihood_use_1_5: answerInstrument(p, run.finalOpinions[i], i).find((a) => a.item === "intent")?.value,
      most_valuable_feature: "dossier_visible",
      would_convince_free_text: "",
      satisfaction_1_5: 3,
      postcode: "",
      years_here: "",
      has_label: p.label,
      age: p.age,
      contact_frequency: "",
    }));
    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="instrument-v1.csv"',
        "x-items": String(V1_ITEMS.length),
      },
    });
  }

  const rows = personas.map((p, i) => {
    const answers = answerInstrument(p, run.finalOpinions[i], i);
    const flat: Record<string, unknown> = {
      respondent_id: p.id,
      synthetic: "SYNTHETISCH",
      archetype: p.archetype,
      archetype_nl: p.archetype_nl,
      age: p.age,
      hood: p.hood,
      synthetic_note: "geen echt persoon; prior-tabel uit §11.3",
    };
    for (const a of answers) {
      flat[`q${String(a.no).padStart(2, "0")}_${a.item}`] =
        typeof a.value === "object" ? JSON.stringify(a.value) : a.value;
      if (a.abstained) flat[`q${String(a.no).padStart(2, "0")}_abstained`] = "ja";
    }
    return flat;
  });

  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="instrument-v2.csv"',
      "x-items": String(ITEMS.length),
    },
  });
}
