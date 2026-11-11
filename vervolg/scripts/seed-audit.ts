// scripts/seed-audit.ts
// Writes a deterministic, gap-free opening chain so the tamper demo always has
// a row 7 to break. Idempotent: refuses to touch a non-empty log unless --force.
//
// Row 7 is deliberately a brief.generated event: it is the least alarming row
// in the file and therefore the most instructive to tamper with.
import fs from "node:fs";
import path from "node:path";
import { GENESIS_HASH, sealRow } from "../src/domain/hashchain";
import type { AuditRow } from "../src/domain/types";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_PATH = path.join(LOG_DIR, "audit.jsonl");
const force = process.argv.includes("--force");

fs.mkdirSync(LOG_DIR, { recursive: true });
if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > 0 && !force) {
  console.log(`logs/audit.jsonl already has content (${fs.statSync(LOG_PATH).size} bytes) — use --force to reseed.`);
  process.exit(0);
}

const T0 = Date.parse("2026-11-11T08:00:00Z");
const at = (minutes: number) => new Date(T0 + minutes * 60000).toISOString();

const plan: { ts: string; actor: string; action: string; subject: string; payload: Record<string, unknown> }[] = [
  {
    ts: at(0),
    actor: "systeem",
    action: "chain.init",
    subject: "vervolg",
    payload: { product: "Vervolg", version: "0.1.0", seed_demo: true, note: "synthetic households only" },
  },
  {
    ts: at(1),
    actor: "systeem",
    action: "fixture.load",
    subject: "HH-014",
    payload: { household_ref: "HH-014", visits: 4, source: "data/households.json" },
  },
  {
    ts: at(2),
    actor: "systeem",
    action: "fixture.load",
    subject: "HH-027",
    payload: { household_ref: "HH-027", visits: 4, source: "data/households.json" },
  },
  {
    ts: at(3),
    actor: "systeem",
    action: "fixture.load",
    subject: "HH-041",
    payload: { household_ref: "HH-041", visits: 4, source: "data/households.json" },
  },
  {
    ts: at(4),
    actor: "C-07",
    action: "visit.confirm",
    subject: "V-hh-027-2026-02-19",
    payload: {
      household_ref: "HH-027",
      visit_id: "V-hh-027-2026-02-19",
      note: "bevestigd in de fixture; rij 5 bestaat zodat oude ketens leesbaar blijven",
      restricted_count: 1,
    },
  },
  {
    ts: at(5),
    actor: "C-11",
    action: "gate.restrict",
    subject: "V-hh-041-2026-01-15",
    payload: { household_ref: "HH-041", fields: ["legal_mention_1"], values_stored: "restricted only" },
  },
  {
    ts: at(6),
    actor: "C-07",
    action: "brief.generated",
    subject: "HH-014",
    payload: {
      household_ref: "HH-014",
      template: "brief.v1",
      model_calls: 0,
      restricted_fields_excluded: ["health_mention_1"],
      note: "voorbeeldrij voor de tamper-demo",
    },
  },
  {
    ts: at(7),
    actor: "C-07",
    action: "correction.append",
    subject: "A-HH-014-2",
    payload: {
      correction_id: "K-SEED-1",
      target: "action",
      target_id: "A-HH-014-2",
      field: "by_when",
      from: "2025-05-31",
      to: "2025-06-15",
      by: "huishouden",
      at: at(7),
      reason_nl: "De datum klopte niet, zei mevrouw.",
    },
  },
  {
    ts: at(8),
    actor: "systeem",
    action: "chain.ready",
    subject: "vervolg",
    payload: { rows: 9, verifier: "scripts/verify-chain.ts" },
  },
];

const rows: AuditRow[] = [];
let prev: AuditRow | null = null;
plan.forEach((p, i) => {
  const row = sealRow(prev, { seq: i + 1, ...p });
  rows.push(row);
  prev = row;
});

fs.writeFileSync(LOG_PATH, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`seeded ${rows.length} rows → ${LOG_PATH}`);
console.log(`genesis ${GENESIS_HASH.slice(0, 12)}…  head ${rows[rows.length - 1].hash.slice(0, 12)}…`);
