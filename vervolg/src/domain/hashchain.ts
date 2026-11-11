// src/domain/hashchain.ts — §9.4
// canonical JSON: keys sorted at every level, then sha256 over the exact string.
import { createHash } from "node:crypto";
import type { AuditRow, ChainVerification } from "./types";

export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonicalJson(o[k]))
      .join(",") +
    "}"
  );
}

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export const GENESIS_HASH = "0".repeat(64);

export type AuditBody = Pick<AuditRow, "seq" | "ts" | "actor" | "action" | "subject" | "payload" | "prev_hash">;

export function rowHash(body: AuditBody): string {
  return sha256(canonicalJson(body));
}

export function sealRow(prev: AuditRow | null, input: Omit<AuditRow, "prev_hash" | "hash">): AuditRow {
  const prev_hash = prev ? prev.hash : GENESIS_HASH;
  const body: AuditBody = {
    seq: input.seq,
    ts: input.ts,
    actor: input.actor,
    action: input.action,
    subject: input.subject,
    payload: input.payload,
    prev_hash,
  };
  return { ...body, hash: rowHash(body) };
}

/**
 * Walks rows in seq order, recomputes every hash.
 * Returns the 1-based seq at which the chain first breaks, or null.
 */
export function verifyChain(rows: AuditRow[]): ChainVerification {
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  let verified = 0;
  let prevHash = GENESIS_HASH;
  let expectedSeq = 1;
  for (const row of sorted) {
    if (row.seq !== expectedSeq) {
      return { total: sorted.length, verified, brokenAt: row.seq, reason: `seq gap: expected ${expectedSeq}, got ${row.seq}` };
    }
    const body: AuditBody = {
      seq: row.seq,
      ts: row.ts,
      actor: row.actor,
      action: row.action,
      subject: row.subject,
      payload: row.payload,
      prev_hash: row.prev_hash,
    };
    const recomputed = rowHash(body);
    if (row.prev_hash !== prevHash) {
      return { total: sorted.length, verified, brokenAt: row.seq, reason: "prev_hash does not match the previous row" };
    }
    if (recomputed !== row.hash) {
      return { total: sorted.length, verified, brokenAt: row.seq, reason: "hash mismatch" };
    }
    prevHash = row.hash;
    verified++;
    expectedSeq++;
  }
  return { total: sorted.length, verified, brokenAt: null };
}
