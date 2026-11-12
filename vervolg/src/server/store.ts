// src/server/store.ts — §9.4 writer
// Append-only JSONL under an exclusive lock: fs.openSync(path,'a') + a
// module-level promise chain for in-process serialisation (O_APPEND makes the
// line atomic against other processes on POSIX).
//
// The audit log is the ONLY persistence. data/*.json is a read-through cache
// held in memory: confirmed visits and corrections are replayed from the chain
// on read, which is what makes "the household corrected its own file" a
// provable event rather than a UI claim.
import fs from "node:fs";
import path from "node:path";
import { sealRow, verifyChain } from "../domain/hashchain";
import type { Action, AuditRow, Correction, Household, Visit } from "../domain/types";

export const LOG_DIR = path.join(process.cwd(), "logs");
export const LOG_PATH = path.join(LOG_DIR, "audit.jsonl");
export const BACKUP_PATH = path.join(LOG_DIR, "audit.jsonl.bak");

let writeChain: Promise<void> = Promise.resolve();

function ensureLog(): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(LOG_PATH)) fs.writeFileSync(LOG_PATH, "");
}

export function readLog(): { rows: AuditRow[]; bad: number } {
  ensureLog();
  const text = fs.readFileSync(LOG_PATH, "utf8");
  const rows: AuditRow[] = [];
  let bad = 0;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      rows.push(JSON.parse(t) as AuditRow);
    } catch {
      bad++;
    }
  }
  rows.sort((a, b) => a.seq - b.seq);
  return { rows, bad };
}

export function appendRow(input: {
  actor: string;
  action: string;
  subject: string;
  payload: Record<string, unknown> | null;
  ts?: string;
}): Promise<AuditRow> {
  const job = writeChain.then(() => {
    ensureLog();
    const { rows } = readLog();
    const prev = rows.length ? rows[rows.length - 1] : null;
    const row = sealRow(prev, {
      seq: (prev?.seq ?? 0) + 1,
      ts: input.ts ?? new Date().toISOString(),
      actor: input.actor,
      action: input.action,
      subject: input.subject,
      payload: input.payload,
    });
    const fd = fs.openSync(LOG_PATH, "a");
    try {
      fs.writeSync(fd, JSON.stringify(row) + "\n");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return row;
  });
  writeChain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export function verifyLog(): {
  total: number;
  verified: number;
  brokenAt: number | null;
  bad: number;
  reason?: string;
} {
  const { rows, bad } = readLog();
  return { ...verifyChain(rows), bad };
}

// ---------------------------------------------------------------------------
// replay: fixtures + the chain
// ---------------------------------------------------------------------------

const dataDir = path.join(process.cwd(), "data");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8")) as T;
}

export interface ReplayedState {
  households: Household[];
  corrections: Correction[];
  confirmedVisits: (Visit & { actions?: Action[] })[];
  fromChain: number;
}

/**
 * Rebuilds the read model from the fixtures, then replays every correction and
 * confirmed visit in seq order. Stored rows are never mutated: a correction
 * changes what the read model answers.
 */
export function loadState(): ReplayedState {
  const households = readJson<Household[]>("households.json");
  const { rows } = readLog();
  const corrections: Correction[] = [];
  const confirmedVisits: (Visit & { actions?: Action[] })[] = [];

  for (const row of rows) {
    if (row.action === "correction.append" && row.payload) corrections.push(row.payload as unknown as Correction);
    if (row.action === "visit.confirm" && row.payload) {
      const p = row.payload as unknown as { household_ref: string; visit: Visit; actions?: Action[] };
      if (p?.household_ref && p?.visit) confirmedVisits.push({ ...p.visit, actions: p.actions });
    }
  }

  for (const c of corrections) {
    for (const h of households) {
      const target =
        c.target === "action"
          ? h.actions.find((a) => a.action_id === c.target_id)
          : c.target === "barrier"
            ? h.barriers.find((b) => b.barrier_id === c.target_id)
            : h.visits.find((v) => v.visit_id === c.target_id);
      if (!target) continue;
      (target as unknown as Record<string, unknown>)[c.field] = c.to;
      if (c.target === "visit") {
        const v = target as Visit;
        v.corrections = [...(v.corrections ?? []), c];
      }
    }
  }

  for (const v of confirmedVisits) {
    const h = households.find((x) => x.household_ref === v.household_ref);
    if (!h) continue;
    if (h.visits.some((x) => x.visit_id === v.visit_id)) continue;
    const { actions, ...visit } = v;
    h.visits.push(visit as Visit);
    for (const a of actions ?? []) if (!h.actions.some((x) => x.action_id === a.action_id)) h.actions.push(a);
  }

  for (const h of households) {
    h.visits.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    h.last_visit = h.visits.length ? h.visits[h.visits.length - 1].date : h.last_visit;
  }

  return { households, corrections, confirmedVisits, fromChain: rows.length };
}

export function findHousehold(ref: string): Household | undefined {
  return loadState().households.find((h) => h.household_ref.toLowerCase() === ref.toLowerCase());
}

export function correctionsFor(ref: string): Correction[] {
  const { households, corrections } = loadState();
  const h = households.find((x) => x.household_ref === ref);
  if (!h) return [];
  return corrections.filter(
    (c) =>
      h.actions.some((a) => a.action_id === c.target_id) ||
      h.barriers.some((b) => b.barrier_id === c.target_id) ||
      h.visits.some((v) => v.visit_id === c.target_id),
  );
}

// ---------------------------------------------------------------------------
// tamper demo (§9.4)
// ---------------------------------------------------------------------------

/**
 * Mutates the payload of row `seq` IN THE FILE and keeps a byte-for-byte backup
 * so `reset` can restore it. The verifier reports brokenAt === seq.
 */
export function tamperRow(seq = 7): { ok: boolean; seq: number; message: string; backup: boolean } {
  ensureLog();
  const text = fs.readFileSync(LOG_PATH, "utf8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    let row: AuditRow;
    try {
      row = JSON.parse(t) as AuditRow;
    } catch {
      continue;
    }
    if (row.seq !== seq) continue;
    if (!fs.existsSync(BACKUP_PATH)) fs.writeFileSync(BACKUP_PATH, text);
    const payload = { ...((row.payload ?? {}) as Record<string, unknown>) };
    payload["__tampered"] = new Date().toISOString();
    if (typeof payload["note"] === "string") payload["note"] = "gewijzigd in het bestand";
    lines[i] = JSON.stringify({ ...row, payload });
    fs.writeFileSync(LOG_PATH, lines.join("\n"));
    return { ok: true, seq, message: `Rij ${seq} is rechtstreeks in het bestand gewijzigd.`, backup: true };
  }
  return { ok: false, seq, message: `Rij ${seq} bestaat niet.`, backup: false };
}

export function resetTamper(): { ok: boolean; message: string } {
  if (!fs.existsSync(BACKUP_PATH)) {
    return { ok: false, message: "Geen backup gevonden; de keten is niet gewijzigd." };
  }
  fs.copyFileSync(BACKUP_PATH, LOG_PATH);
  fs.unlinkSync(BACKUP_PATH);
  const v = verifyLog();
  return { ok: v.brokenAt === null, message: `Hersteld uit backup. total=${v.total} verified=${v.verified} brokenAt=${v.brokenAt}` };
}

/** Prints the chain for scripts/verify-chain.ts. */
export function chainSummary(): string {
  const v = verifyLog();
  return `total=${v.total} verified=${v.verified} brokenAt=${v.brokenAt}`;
}
