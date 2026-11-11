// scripts/gen-cases.ts
// 30 synthetic coach-caseload rows for the queue screen (§7.4).
// There is deliberately NO score field: every number here is a fact about the
// file, not about the person (W1).
import { writeFileSync, readFileSync } from "node:fs";
import type { CaseRow, Household } from "../src/domain/types";
import { daysBetween, todayIso } from "../src/domain/brief";

const HOODS = ["Korrewegwijk", "Paddepoel", "Vinkhuizen", "Oosterparkwijk", "Beijum", "Lewenborg", "Hoogkerk", "Selwerd"];
const NAMES = [
  "Familie Yılmaz", "Mevrouw de Boer", "Dhr. Osei", "Familie Kaya", "Mevrouw Visser", "Dhr. El Amrani",
  "Familie Dijkstra", "Mevrouw Smit", "Dhr. Nowak", "Familie Mulder", "Mevrouw Şahin", "Dhr. de Groot",
  "Familie Vos", "Mevrouw Bouazza", "Dhr. Peters", "Familie Hendriks", "Mevrouw Kowalski", "Dhr. van Leeuwen",
  "Familie Dekker", "Mevrouw Al-Ahmad", "Dhr. Brouwer", "Familie van Dijk", "Mevrouw Demir", "Dhr. Smits",
  "Familie de Graaf", "Mevrouw van den Berg", "Dhr. Çelik", "Familie Kuipers", "Mevrouw Post", "Dhr. Veenstra",
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const today = todayIso();
const rnd = rng(20261111);
const households = JSON.parse(readFileSync("data/households.json", "utf8")) as Household[];

const rows: CaseRow[] = [];
for (let i = 0; i < 30; i++) {
  const fixture = households.find((h) => h.display_nl.startsWith(NAMES[i]));
  if (fixture) {
    const open = fixture.actions.filter((a) => a.status === "afgesproken" || a.status === "onbekend").length;
    const dropped = fixture.actions.filter((a) => a.status === "niet_gedaan").length;
    rows.push({
      ref: fixture.household_ref,
      display_nl: fixture.display_nl,
      hood: HOODS[i % HOODS.length],
      label: fixture.label,
      days_since_contact: daysBetween(fixture.last_visit!, today),
      open_actions: open,
      dropped_actions: dropped,
      restricted_present: fixture.visits.some((v) => v.restricted_count > 0),
      never_followed_up: fixture.actions.filter((a) => a.status === "onbekend" && fixture.visits.length >= 2).length,
      visits: fixture.visits.length,
    });
    continue;
  }
  const ref = `HH-${String(50 + i * 3).padStart(3, "0")}`;
  const label = "ABCDEFG"[Math.floor(rnd() * 7)] as CaseRow["label"];
  rows.push({
    ref,
    display_nl: `${NAMES[i]} — ${HOODS[i % HOODS.length]}`,
    hood: HOODS[i % HOODS.length],
    label,
    days_since_contact: Math.round(8 + rnd() * 400),
    open_actions: Math.floor(rnd() * 6),
    dropped_actions: Math.floor(rnd() * 3),
    restricted_present: rnd() < 0.35,
    never_followed_up: Math.floor(rnd() * 3),
    visits: 1 + Math.floor(rnd() * 5),
  });
}

// the three fixture households must sort interestingly; keep them distinct
const idx = rows.findIndex((r) => r.ref === "HH-027");
if (idx >= 0) rows[idx].days_since_contact = 266;

writeFileSync("data/cases.json", JSON.stringify(rows, null, 2) + "\n");
console.log(`wrote ${rows.length} case rows`);
const numericKeys = new Set<string>();
for (const r of rows) for (const [k, v] of Object.entries(r)) if (typeof v === "number") numericKeys.add(k);
console.log("numeric fields:", [...numericKeys].join(", "));
const allowed = new Set(["days_since_contact", "open_actions", "dropped_actions", "never_followed_up", "visits"]);
for (const k of numericKeys) if (!allowed.has(k)) throw new Error(`unexpected numeric field ${k}`);
console.log("no score fields present ✓");
