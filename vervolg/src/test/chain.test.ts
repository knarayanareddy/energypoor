import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { copyFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { canonicalJson, GENESIS_HASH, sealRow, sha256, verifyChain } from "../domain/hashchain";
import type { AuditRow } from "../domain/types";
import { appendRow, readLog, resetTamper, tamperRow, verifyLog } from "../server/store";

const LOG = path.join(process.cwd(), "logs", "audit.jsonl");
const SNAPSHOT = path.join(process.cwd(), "logs", ".test-snapshot.jsonl");

function snapshotLog() {
  if (existsSync(LOG)) copyFileSync(LOG, SNAPSHOT);
}
function restoreLog() {
  if (existsSync(SNAPSHOT)) copyFileSync(SNAPSHOT, LOG);
  if (existsSync(path.join(process.cwd(), "logs", "audit.jsonl.bak"))) {
    unlinkSync(path.join(process.cwd(), "logs", "audit.jsonl.bak"));
  }
}

describe("canonicalJson", () => {
  it("sorts keys at every level and is stable", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}',
    );
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it("hashes are sha256 hex", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("T-15 — the chain never has a gap", () => {
  beforeAll(snapshotLog);
  afterAll(restoreLog);

  it("seq values are 1..n with no repeats, after appends", async () => {
    const before = readLog().rows.length;
    await appendRow({ actor: "test", action: "test.append", subject: "T-15", payload: { i: 1 } });
    await appendRow({ actor: "test", action: "test.append", subject: "T-15", payload: { i: 2 } });
    const rows = readLog().rows;
    expect(rows.length).toBe(before + 2);
    const seqs = rows.map((r) => r.seq);
    expect(seqs).toEqual(Array.from({ length: rows.length }, (_, i) => i + 1));
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it("the chain verifies after concurrent appends (the mutex holds)", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => appendRow({ actor: "test", action: "test.race", subject: `R${i}`, payload: { i } })),
    );
    const v = verifyLog();
    expect(v.brokenAt).toBeNull();
    expect(v.verified).toBe(v.total);
  });
});

describe("T-16 — tamper row 7 → brokenAt === 7; reset → null", () => {
  beforeAll(snapshotLog);
  afterAll(restoreLog);

  it("detects the tamper at exactly row 7, then restores", () => {
    const clean = verifyLog();
    expect(clean.total).toBeGreaterThanOrEqual(7);
    expect(clean.brokenAt).toBeNull();

    const t = tamperRow(7);
    expect(t.ok).toBe(true);

    const broken = verifyLog();
    expect(broken.brokenAt).toBe(7);
    expect(broken.verified).toBe(6);

    const r = resetTamper();
    expect(r.ok).toBe(true);
    expect(verifyLog().brokenAt).toBeNull();
  });

  it("a gap in seq is reported, not silently accepted", () => {
    const rows: AuditRow[] = [];
    let prev: AuditRow | null = null;
    for (let i = 1; i <= 5; i++) {
      const row = sealRow(prev, { seq: i, ts: "2026-01-01T00:00:00Z", actor: "t", action: "a", subject: "s", payload: { i } });
      rows.push(row);
      prev = row;
    }
    const gapped = rows.filter((r) => r.seq !== 3);
    const v = verifyChain(gapped);
    expect(v.brokenAt).toBe(4);
  });

  it("a rewritten payload is caught even if prev_hash is kept", () => {
    const rows: AuditRow[] = [];
    let prev: AuditRow | null = null;
    for (let i = 1; i <= 3; i++) {
      const row = sealRow(prev, { seq: i, ts: "t", actor: "a", action: "b", subject: "c", payload: { i } });
      rows.push(row);
      prev = row;
    }
    rows[1] = { ...rows[1], payload: { i: 999 } };
    expect(verifyChain(rows).brokenAt).toBe(2);
  });
});

describe("genesis", () => {
  it("the first row's prev_hash is 64 zeros", () => {
    const { rows } = readLog();
    if (rows.length) expect(rows[0].prev_hash).toBe(GENESIS_HASH);
  });

  it("the log on disk parses line by line", () => {
    const text = readFileSync(LOG, "utf8").trim();
    for (const line of text.split("\n")) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

