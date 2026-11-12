// GET /api/audit — the chain's state. POST /api/audit {op:"tamper"|"reset"} — dev only.
import { NextResponse } from "next/server";
import { readLog, resetTamper, tamperRow, verifyLog } from "@/server/store";
import { apiMessage, localeFromRequest } from "@/i18n/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const v = verifyLog();
  const { rows } = readLog();
  return NextResponse.json({
    total: v.total,
    verified: v.verified,
    brokenAt: v.brokenAt,
    reason: v.reason ?? null,
    rows: rows.slice(-limit),
  });
}

export async function POST(req: Request) {
  const loc = localeFromRequest(req);
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TAMPER !== "1") {
    return NextResponse.json({ ok: false, error: apiMessage(loc, "demoOnly") }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: apiMessage(loc, "badBody") }, { status: 400 });
  }
  const { op, seq } = (body ?? {}) as { op?: string; seq?: number };
  if (op === "tamper") {
    const r = tamperRow(typeof seq === "number" ? seq : 7);
    return NextResponse.json({ ...r, verification: verifyLog() });
  }
  if (op === "reset") {
    const r = resetTamper();
    return NextResponse.json({ ...r, verification: verifyLog() });
  }
  return NextResponse.json({ ok: false, error: apiMessage(loc, "opMustBe") }, { status: 400 });
}
