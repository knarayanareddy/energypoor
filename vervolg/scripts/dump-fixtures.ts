// scripts/dump-fixtures.ts — emits expectations for the flow test.
// Prints one canonical JSON line per note (the extractor's exact output) so a
// regression is a diff, not an opinion.
import { readFileSync } from "node:fs";
import { extractCanonical } from "../src/domain/extract";
import type { NoteFixture } from "../src/server/fixtures";

const notes = JSON.parse(readFileSync("data/notes.json", "utf8")) as NoteFixture[];
const out = notes.map((n) => ({
  id: n.id,
  expected: n.expected,
  actual: JSON.parse(extractCanonical(n.text, n.household_ref, n.date)),
}));
console.log(JSON.stringify(out, null, 2));
