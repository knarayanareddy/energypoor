// GET /api/household/:ref/brief
import { NextResponse } from "next/server";
import { findHousehold } from "@/server/store";
import { briefCsv, buildBrief } from "@/domain/brief";
import { apiMessage, localeFromRequest } from "@/i18n/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const loc = localeFromRequest(req);
  const { ref } = await params;
  const url = new URL(req.url);
  const h = findHousehold(ref);
  if (!h) return NextResponse.json({ code: "E-HOUSEVIEW-01", error: apiMessage(loc, "unknownDossier") }, { status: 404 });

  if (url.searchParams.get("format") === "csv") {
    // exports are always non-restricted; there is no parameter that changes this
    return new NextResponse(briefCsv(h), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="vervolg-${h.household_ref}.csv"`,
      },
    });
  }
  if (url.searchParams.get("share") === "corporation") {
    return NextResponse.json({ code: "E-NOSHARE-01", error: apiMessage(loc, "neverSharedWithCorp") }, { status: 403 });
  }
  return NextResponse.json(buildBrief(h));
}
