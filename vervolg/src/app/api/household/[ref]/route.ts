// GET /api/household/:ref — the coach view.
// GET /api/household/:ref?view=family — the household view: non-restricted only.
import { NextResponse } from "next/server";
import { correctionsFor, findHousehold } from "@/server/store";
import { buildFamilyView, buildBrief } from "@/domain/brief";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const url = new URL(req.url);
  const view = url.searchParams.get("view");

  const h = findHousehold(ref);
  if (!h) {
    return NextResponse.json({ code: "E-HOUSEVIEW-01", error: "Onbekend dossier." }, { status: 404 });
  }

  if (view === "family") {
    if (!h.consent.household_visible) {
      return NextResponse.json({ code: "E-HOUSEVIEW-01", error: "Het huishouden heeft dit niet gedeeld." }, { status: 403 });
    }
    const corrections = correctionsFor(h.household_ref);
    return NextResponse.json({
      household: buildFamilyView(
        h,
        corrections.map((c) => ({ at: c.at, field: c.field, to: c.to ?? "" })),
      ),
      actions: h.actions.filter((a) => !a.restricted),
      barriers: h.barriers.filter((b) => !b.restricted),
      visits: h.visits.map((v) => ({ visit_id: v.visit_id, date: v.date, restricted_count: v.restricted_count })),
    });
  }

  const corrections = correctionsFor(h.household_ref);
  return NextResponse.json({
    household: h,
    actions: h.actions,
    barriers: h.barriers,
    visits: h.visits,
    corrections,
    brief: buildBrief(h),
  });
}
