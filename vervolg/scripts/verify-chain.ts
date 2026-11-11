// scripts/verify-chain.ts — walks logs/audit.jsonl, recomputes sha256, exits 1 on break.
// Usage: npx tsx scripts/verify-chain.ts [path]
import fs from "node:fs";
import path from "node:path";
import { verifyChain } from "../src/domain/hashchain";
import type { AuditRow } from "../src/domain/types";

const target = process.argv[2] ?? path.join(process.cwd(), "logs", "audit.jsonl");
if (!fs.existsSync(target)) {
  console.error(`no such file: ${target}`);
  process.exit(1);
}
const rows: AuditRow[] = [];
let bad = 0;
for (const line of fs.readFileSync(target, "utf8").split("\n")) {
  const t = line.trim();
  if (!t) continue;
  try {
    rows.push(JSON.parse(t) as AuditRow);
  } catch {
    bad++;
  }
}
const v = verifyChain(rows);
console.log(`total=${v.total} verified=${v.verified} brokenAt=${v.brokenAt}${bad ? ` invalid_lines=${bad}` : ""}`);
if (v.brokenAt !== null || bad > 0) {
  if (v.reason) console.error(`  reason: ${v.reason}`);
  process.exit(1);
}
