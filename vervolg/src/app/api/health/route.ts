// GET /api/health
import { NextResponse } from "next/server";
import { readLog } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const { rows } = readLog();
  return NextResponse.json({ ok: true, rows: rows.length });
}
