// GET /api/cases
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CaseRow } from "@/domain/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = JSON.parse(readFileSync(path.join(process.cwd(), "data", "cases.json"), "utf8")) as CaseRow[];
  return NextResponse.json({
    cases: rows,
    sortKeys: [
      { id: "staleness", label: "Langst niet gezien", field: "days_since_contact" },
      { id: "open_actions", label: "Openstaande afspraken", field: "open_actions" },
      { id: "never_followed_up", label: "Nooit nagevolgd", field: "never_followed_up" },
    ],
    disclaimer: "Sorteert op het dossier, niet op de persoon.",
  });
}
