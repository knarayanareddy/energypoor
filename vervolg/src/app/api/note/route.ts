// POST /api/note — §9.2
// MUST NOT persist anything. Returns a draft. Only /api/note/confirm writes.
// This is the "no save without confirmation" check (T-13) and it is testable:
// call this twice and assert the audit log is unchanged.
import { NextResponse } from "next/server";
import { structure, modelPathEnabled } from "@/domain/structure";
import { buildBrief } from "@/domain/brief";
import { findHousehold } from "@/server/store";
import type { Draft, DraftAction, DraftBarrier, Household } from "@/domain/types";

export const dynamic = "force-dynamic";

let draftCounter = 0;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "E-ACTION-01", error: "Ongeldige body." }, { status: 400 });
  }
  const { household_ref, text, visit_date, coach_ref } = (body ?? {}) as {
    household_ref?: string;
    text?: string;
    visit_date?: string;
    coach_ref?: string;
  };

  // stage 1 refuses a note with no household reference
  if (!household_ref || !household_ref.trim()) {
    return NextResponse.json(
      { code: "E-ACTION-01", error: "Kies eerst een dossier. Een notitie zonder dossier wordt niet opgeslagen." },
      { status: 422 },
    );
  }
  if (!text || text.trim().length < 3) {
    return NextResponse.json({ code: "E-ACTION-01", error: "Er staat geen notitie in." }, { status: 422 });
  }
  if (!coach_ref || !coach_ref.trim()) {
    return NextResponse.json({ code: "E-CONFIRM-01", error: "Bevestig als coach." }, { status: 422 });
  }

  const household = findHousehold(household_ref);
  if (!household) {
    return NextResponse.json({ code: "E-HOUSEVIEW-01", error: "Onbekend dossier." }, { status: 404 });
  }

  const visit_id = `V-${household.household_ref.toLowerCase()}-${visit_date ?? new Date().toISOString().slice(0, 10)}`;
  // §6.1: the model path is optional and off by default. When the flag is off
  // this is the rules engine and nothing else — no network, same bytes. When it
  // is on and the model fails, `structure` falls back and reports why in
  // `errors`, which is surfaced on the draft rather than hidden.
  const ex = await structure(text, household.household_ref, visit_date ?? new Date().toISOString().slice(0, 10));

  const actions: DraftAction[] = ex.actions.map((a, i) => ({
    action_id: `${visit_id}-D${i + 1}`,
    household_ref: household.household_ref,
    who: a.who,
    what_nl: a.what_nl,
    by_when: a.by_when,
    status: "afgesproken",
    evidence: null,
    restricted: a.restricted,
    set_at_visit: visit_id,
    status_at_visit: null,
    source_sentence: a.source_sentence,
    keep: true,
  }));

  const barriers: DraftBarrier[] = ex.barriers.map((b, i) => ({
    barrier_id: `${visit_id}-B${i + 1}`,
    household_ref: household.household_ref,
    kind: b.kind,
    note_nl: b.note_nl,
    restricted: b.restricted,
    visit_id,
    source_sentence: b.source_sentence,
    keep: true,
  }));

  const restricted_count = ex.restricted_hits.length;
  const errors: Draft["errors"] = [];
  if (restricted_count > 0) {
    errors.push({
      code: "E-RESTRICT-01",
      message_nl: `Dit is verplaatst naar een beperkt veld (${ex.restricted_hits.map((h) => h.field).join(", ")}).`,
    });
  }
  if (ex.needs_input.length > 0) {
    errors.push({ code: "E-ACTION-01", message_nl: "Wie doet wat, en wanneer?" });
  }
  for (const e of ex.errors) {
    errors.push({ code: e.code, message_nl: `De modelroute is niet gebruikt (${e.detail}); de regels zijn toegepast.` });
  }

  const previewHousehold: Household = {
    ...household,
    actions: [...household.actions, ...actions],
    barriers: [...household.barriers, ...barriers],
  };
  const preview_brief = buildBrief(previewHousehold);

  draftCounter++;
  const draft: Draft = {
    draft_id: `D-${Date.now().toString(36)}-${draftCounter}`,
    household_ref: household.household_ref,
    visit_date: visit_date ?? new Date().toISOString().slice(0, 10),
    coach_ref,
    transcript: text,
    actions,
    barriers,
    needs_input: ex.needs_input,
    restricted_hits: ex.restricted_hits,
    restricted_count,
    next_step: ex.next_step,
    errors,
    created_at: new Date().toISOString(),
    seq_hint: 0,
  };

  // No appendRow here, by design. POST /api/note is read-only.
  return NextResponse.json({
    draft,
    preview_brief,
    structure: { source: ex.source, model_enabled: modelPathEnabled() },
  });
}
