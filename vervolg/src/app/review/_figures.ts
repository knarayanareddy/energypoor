import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { verifyLog } from "@/server/store";
import { households, notes } from "@/server/fixtures";
import { buildBrief } from "@/domain/brief";
import type { PreVisitBrief } from "@/domain/types";

export interface Report {
  runs: number;
  rounds: number;
  n_agents: number;
  frequencies: { id: string; hits: number; n: number; p: number; line: string; question_en: string }[];
  falsifiers: { id: string; test: string; frequency_p: number; claim_holds: boolean; would_break_pitch: boolean; claim: string; reading_en: string }[];
}

/**
 * Every number the review page prints, computed once. Both language bodies take
 * this object, so a figure can never drift between the Dutch and English copy —
 * if it changes, it changes in one place and both pages move together.
 */
export interface ReviewFigures {
  chain: ReturnType<typeof verifyLog>;
  report: Report | null;
  brief27: PreVisitBrief;
  restrictedFields: string[];
  dropped: { status: string }[];
  notes: number;
}

export function reviewFigures(): ReviewFigures {
  const chain = verifyLog();
  const houses = households();
  const allNotes = notes();
  const reportPath = path.join(process.cwd(), "data", "swarm", "report.json");
  const report: Report | null = existsSync(reportPath)
    ? (JSON.parse(readFileSync(reportPath, "utf8")) as Report)
    : null;

  const brief27 = buildBrief(houses.find((h) => h.household_ref === "HH-027")!, "2026-11-11");
  const actions = houses.flatMap((h) => h.actions);
  const dropped = actions.filter((a) => a.status === "niet_gedaan");
  const restrictedFields = houses.flatMap((h) => h.visits.flatMap((v) => Object.keys(v.restricted_fields ?? {})));

  return { chain, report, brief27, restrictedFields, dropped, notes: allNotes.length };
}
