// POST /api/note/confirm — the ONLY write path for a visit.
import { NextResponse } from "next/server";
import { appendRow, findHousehold } from "@/server/store";
import type { Action, Barrier, DraftAction, DraftBarrier, Visit } from "@/domain/types";
import { apiMessage, localeFromRequest } from "@/i18n/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const loc = localeFromRequest(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "E-ACTION-01", error: apiMessage(loc, "badBody") }, { status: 400 });
  }
  const b = (body ?? {}) as {
    household_ref?: string;
    visit_date?: string;
    transcript?: string;
    coach_ref?: string;
    actions?: (DraftAction | Action)[];
    barriers?: (DraftBarrier | Barrier)[];
    restricted_hits?: { field: string; kind: string; value: string }[];
    needs_input?: { sentence: string; question_nl: string }[];
  };

  // stage 4 refuses to save without a coach
  if (!b.coach_ref) {
    return NextResponse.json({ code: "E-CONFIRM-01", error: apiMessage(loc, "confirmAsCoach") }, { status: 422 });
  }
  if (!b.household_ref) {
    return NextResponse.json({ code: "E-ACTION-01", error: apiMessage(loc, "noDossierShort") }, { status: 422 });
  }
  const household = findHousehold(b.household_ref);
  if (!household) {
    return NextResponse.json({ code: "E-HOUSEVIEW-01", error: apiMessage(loc, "unknownDossier") }, { status: 404 });
  }

  const date = b.visit_date ?? new Date().toISOString().slice(0, 10);
  const visit_id = `V-${household.household_ref.toLowerCase()}-${date}`;
  const now = new Date().toISOString();

  const actions: Action[] = (b.actions ?? []).map((a, i) => ({
    action_id: `A-${household.household_ref}-${household.actions.length + i + 1}`,
    household_ref: household.household_ref,
    who: a.who,
    what_nl: a.what_nl,
    by_when: a.by_when,
    status: "afgesproken",
    evidence: null,
    restricted: a.restricted,
    set_at_visit: visit_id,
    status_at_visit: visit_id,
  }));

  const barriers: Barrier[] = (b.barriers ?? []).map((x, i) => ({
    barrier_id: `B-${household.household_ref}-${household.barriers.length + i + 1}-${Date.now().toString(36).slice(-3)}`,
    household_ref: household.household_ref,
    kind: x.kind,
    note_nl: x.note_nl,
    restricted: x.restricted,
    visit_id,
  }));

  const restricted_fields: Record<string, string> = {};
  for (const hit of b.restricted_hits ?? []) restricted_fields[hit.field] = hit.value;

  const visit: Visit = {
    visit_id,
    household_ref: household.household_ref,
    date,
    coach_ref: b.coach_ref,
    transcript: b.transcript ?? "",
    actions_added: actions.map((a) => a.action_id),
    barriers_added: barriers.map((x) => x.barrier_id),
    restricted_count: (b.restricted_hits ?? []).length,
    corrections: [],
    restricted_fields,
  };

  // stage 5: append-only. The restricted values are in the chain (it is the
  // audit record); every read model filters them at the boundary.
  const row = await appendRow({
    actor: b.coach_ref,
    action: "visit.confirm",
    subject: visit_id,
    payload: {
      household_ref: household.household_ref,
      visit,
      actions,
      barriers,
      restricted_fields,
      needs_input: b.needs_input ?? [],
      confirmed_at: now,
    },
  });

  return NextResponse.json({ ok: true, visit_id, seq: row.seq, hash: row.hash });
}
