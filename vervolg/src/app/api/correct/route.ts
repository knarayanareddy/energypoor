// POST /api/correct — W11
// Appends a Correction; never mutates a stored row.
import { NextResponse } from "next/server";
import { appendRow, loadState } from "@/server/store";
import type { Correction } from "@/domain/types";
import { apiMessage, localeFromRequest } from "@/i18n/api";

export const dynamic = "force-dynamic";

let counter = 0;

export async function POST(req: Request) {
  const loc = localeFromRequest(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: "E-ACTION-01", error: apiMessage(loc, "badBody") }, { status: 400 });
  }
  const b = (body ?? {}) as Partial<Correction> & { by?: "coach" | "huishouden" };

  if (!b.target || !b.target_id || !b.field) {
    return NextResponse.json({ code: "E-ACTION-01", error: apiMessage(loc, "incompleteCorrection") }, { status: 422 });
  }
  if (b.by !== "coach" && b.by !== "huishouden") {
    return NextResponse.json({ code: "E-CONFIRM-01", error: apiMessage(loc, "confirmAsCoach") }, { status: 422 });
  }
  // restricted fields are not correctable through the shared read model
  if (/^(health|debt|legal|family)_mention_/.test(b.field) || b.field === "restricted") {
    return NextResponse.json({ code: "E-RESTRICT-01", error: apiMessage(loc, "movedToRestricted") }, { status: 422 });
  }

  const state = loadState();
  const target =
    b.target === "action"
      ? state.households.flatMap((h) => h.actions).find((a) => a.action_id === b.target_id)
      : b.target === "barrier"
        ? state.households.flatMap((h) => h.barriers).find((x) => x.barrier_id === b.target_id)
        : state.households.flatMap((h) => h.visits).find((v) => v.visit_id === b.target_id);

  if (!target) {
    return NextResponse.json({ code: "E-ACTION-01", error: apiMessage(loc, "unknownTarget") }, { status: 404 });
  }
  if ((target as { restricted?: boolean }).restricted) {
    return NextResponse.json({ code: "E-RESTRICT-01", error: apiMessage(loc, "movedToRestricted") }, { status: 422 });
  }

  counter++;
  const from = (target as unknown as Record<string, unknown>)[b.field];
  const correction: Correction = {
    correction_id: `K-${Date.now().toString(36)}-${counter}`,
    target: b.target,
    target_id: b.target_id,
    field: b.field,
    from: from === undefined || from === null ? null : String(from),
    to: b.to ?? null,
    by: b.by,
    at: new Date().toISOString(),
    reason_nl: b.reason_nl ?? null,
  };

  const row = await appendRow({
    actor: b.by === "coach" ? "coach" : "huishouden",
    action: "correction.append",
    subject: b.target_id,
    payload: correction as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, correction_id: correction.correction_id, seq: row.seq, hash: row.hash });
}
