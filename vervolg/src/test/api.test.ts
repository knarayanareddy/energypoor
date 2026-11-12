// Route-level tests. These import the route handlers directly (no server), so
// they prove the same code the browser hits.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { copyFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { POST as postNote } from "../app/api/note/route";
import { POST as postConfirm } from "../app/api/note/confirm/route";
import { POST as postCorrect } from "../app/api/correct/route";
import { GET as getAudit } from "../app/api/audit/route";
import { GET as getCases } from "../app/api/cases/route";
import { GET as getHousehold } from "../app/api/household/[ref]/route";
import { GET as getBrief } from "../app/api/household/[ref]/brief/route";
import { readLog, verifyLog, loadState } from "../server/store";
import { SENSITIVE_SUBSTRINGS } from "../domain/gate";

const LOG = path.join(process.cwd(), "logs", "audit.jsonl");
const SNAP = path.join(process.cwd(), "logs", ".api-snapshot.jsonl");
const BAK = path.join(process.cwd(), "logs", "audit.jsonl.bak");

const json = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// The audit log is shared, mutable, on-disk state. Snapshot it ONCE for the
// whole file, before any test writes; restore it ONCE at the end. Taking the
// snapshot in beforeEach would capture the rows a previous test appended, so
// the "restore" would quietly keep them — which is exactly what happened
// before this was hoisted here.
beforeAll(() => {
  if (existsSync(LOG)) copyFileSync(LOG, SNAP);
});
afterAll(() => {
  if (existsSync(SNAP)) copyFileSync(SNAP, LOG);
  if (existsSync(BAK)) unlinkSync(BAK);
  if (existsSync(SNAP)) unlinkSync(SNAP);
});

describe("T-13 — POST /api/note does not persist anything", () => {

  it("returns a draft and leaves the audit log byte-identical", async () => {
    const before = readFileSync(LOG);
    const beforeRows = readLog().rows.length;

    const res = await postNote(
      json({
        household_ref: "HH-027",
        visit_date: "2026-03-02",
        coach_ref: "C-07",
        text: "Ik bel de corporatie over de isolatie. Mevrouw begrijpt het formulier niet.",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { draft: { actions: unknown[]; needs_input: unknown[] }; preview_brief: unknown };
    expect(body.draft.actions.length).toBeGreaterThan(0);
    expect(body.preview_brief).toBeTruthy();

    // twice, because a single call could pass by accident
    await postNote(
      json({
        household_ref: "HH-027",
        visit_date: "2026-03-02",
        coach_ref: "C-07",
        text: "Wij regelen een nieuwe cv-ketel.",
      }),
    );

    expect(readFileSync(LOG).equals(before)).toBe(true);
    expect(readLog().rows.length).toBe(beforeRows);
  });

  it("refuses a note with no household reference (stage 1)", async () => {
    const res = await postNote(json({ text: "Iets", visit_date: "2026-03-02", coach_ref: "C-07" }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("E-ACTION-01");
  });

  it("refuses a confirm with no coach id (stage 4, E-CONFIRM-01)", async () => {
    const res = await postConfirm(json({ household_ref: "HH-027", visit_date: "2026-03-02", actions: [] }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("E-CONFIRM-01");
  });
});

describe("W11 / T-11 — the household can see and correct its own file", () => {

  it("the family view returns only non-restricted fields", async () => {
    const res = await getHousehold(new Request("http://localhost/api/household/HH-027?view=family"), {
      params: Promise.resolve({ ref: "HH-027" }),
    });
    const body = (await res.json()) as {
      actions: { restricted: boolean }[];
      barriers: { restricted: boolean }[];
      household: unknown;
    };
    expect(body.actions.every((a) => !a.restricted)).toBe(true);
    expect(body.barriers.every((b) => !b.restricted)).toBe(true);
    const text = JSON.stringify(body);
    for (const s of ["COPD", "zuurstof", "verblijfsvergunning", "rollator"]) {
      expect(text).not.toContain(s);
    }
  });

  it("a correction appends one row, changes the read model, and grows the chain by exactly 1", async () => {
    const before = loadState();
    const beforeRows = readLog().rows.length;
    const target = before.households
      .find((h) => h.household_ref === "HH-014")!
      .actions.find((a) => a.action_id === "A-HH-014-1")!;
    const original = target.what_nl;
    // the read model is a replay of the chain, so a re-run of this test sees the
    // previous correction. Assert against a unique value, not a fixed one.
    const unique = `Isolatie van de voorgevel bellen (${Date.now()})`;

    const res = await postCorrect(
      json({
        target: "action",
        target_id: "A-HH-014-1",
        field: "what_nl",
        to: unique,
        by: "huishouden",
        reason_nl: "Het ging om de achtergevel.",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { seq: number; correction_id: string };
    expect(body.correction_id).toMatch(/^K-/);

    expect(readLog().rows.length).toBe(beforeRows + 1);
    const after = loadState();
    const changed = after.households
      .find((h) => h.household_ref === "HH-014")!
      .actions.find((a) => a.action_id === "A-HH-014-1")!;
    expect(changed.what_nl).toBe(unique);
    expect(changed.what_nl).not.toBe(original);
    // the stored fixture row is untouched — the correction is an append
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "data", "households.json"), "utf8"));
    const rawAction = raw[0].actions.find((a: { action_id: string }) => a.action_id === "A-HH-014-1");
    // the fixture on disk never changes: the correction lives in the chain only
    expect(rawAction.what_nl).toBe("Isolatie van de voorgevel bellen");
    expect(verifyLog().brokenAt).toBeNull();
  });

  it("refuses a correction against a restricted field", async () => {
    const res = await postCorrect(
      json({ target: "visit", target_id: "V-hh-027-2025-10-09", field: "health_mention_1", to: "x", by: "coach" }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("E-RESTRICT-01");
  });
});

describe("W10 at the API boundary", () => {
  it("the CSV export contains no restricted rows or sensitive substrings", async () => {
    for (const ref of ["HH-014", "HH-027", "HH-041"]) {
      const res = await getBrief(new Request(`http://localhost/api/household/${ref}/brief?format=csv`), {
        params: Promise.resolve({ ref }),
      });
      const csv = await res.text();
      for (const s of SENSITIVE_SUBSTRINGS) {
        expect(csv).not.toContain(s);
      }
      const h = loadState().households.find((x) => x.household_ref === ref)!;
      for (const a of h.actions.filter((x) => x.restricted)) {
        expect(csv).not.toContain(a.action_id);
      }
    }
  });

  it("an export to a landlord or corporation is refused with E-NOSHARE-01", async () => {
    const res = await getBrief(new Request("http://localhost/api/household/HH-027/brief?share=corporation"), {
      params: Promise.resolve({ ref: "HH-027" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("E-NOSHARE-01");
  });

  it("the brief JSON contains no restricted value", async () => {
    const res = await getBrief(new Request("http://localhost/api/household/HH-027/brief"), {
      params: Promise.resolve({ ref: "HH-027" }),
    });
    const text = await res.text();
    expect(text).not.toContain("COPD");
    expect(text).not.toContain("zuurstof");
    expect(text).toContain("health_mention_1");
  });
});

describe("queue API", () => {
  it("exposes the three sort keys and the disclaimer", async () => {
    const res = await getCases();
    const body = (await res.json()) as { cases: unknown[]; sortKeys: { id: string }[]; disclaimer: string };
    expect(body.cases.length).toBe(30);
    expect(body.sortKeys.map((s) => s.id)).toEqual(["staleness", "open_actions", "never_followed_up"]);
    expect(body.disclaimer).toBe("Sorteert op het dossier, niet op de persoon.");
  });

  it("no case row has a numeric field outside the allowlist", async () => {
    const res = await getCases();
    const body = (await res.json()) as { cases: Record<string, unknown>[] };
    const allowed = new Set(["days_since_contact", "open_actions", "dropped_actions", "never_followed_up", "visits"]);
    for (const row of body.cases) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "number") expect(allowed.has(k), `${String(row.ref)}.${k}`).toBe(true);
      }
    }
  });
});

describe("audit API", () => {
  it("reports total / verified / brokenAt", async () => {
    const res = await getAudit(new Request("http://localhost/api/audit?limit=5"));
    const body = (await res.json()) as { total: number; verified: number; brokenAt: number | null; rows: unknown[] };
    expect(body.total).toBeGreaterThan(0);
    expect(body.verified).toBe(body.total);
    expect(body.brokenAt).toBeNull();
    expect(body.rows.length).toBeLessThanOrEqual(5);
  });
});
