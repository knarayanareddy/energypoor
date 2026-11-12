// src/server/fixtures.ts — read-through access to data/*.json.
// Kept out of src/domain so the domain layer stays pure and testable, and out of
// src/test so a production page never imports a test module.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CaseRow, Household } from "../domain/types";

export interface NoteFixture {
  id: string;
  household_ref: string;
  date: string;
  kind: string;
  text: string;
  expected: { actions: number; barriers: string[]; restricted: number; needs_input: number };
}

const dataDir = path.join(process.cwd(), "data");

export function notes(): NoteFixture[] {
  return JSON.parse(readFileSync(path.join(dataDir, "notes.json"), "utf8")) as NoteFixture[];
}

export function households(): Household[] {
  return JSON.parse(readFileSync(path.join(dataDir, "households.json"), "utf8")) as Household[];
}

export function cases(): CaseRow[] {
  return JSON.parse(readFileSync(path.join(dataDir, "cases.json"), "utf8")) as CaseRow[];
}
