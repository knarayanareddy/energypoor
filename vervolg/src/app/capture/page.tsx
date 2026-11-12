import { readFileSync } from "node:fs";
import path from "node:path";
import { CaptureClient } from "@/components/CaptureClient";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export interface NoteFixture {
  id: string;
  household_ref: string;
  date: string;
  kind: string;
  text: string;
  expected: { actions: number; barriers: string[]; restricted: number; needs_input: number };
}

export default async function CapturePage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { locale } = await getI18n(await searchParams);
  const notes = JSON.parse(readFileSync(path.join(process.cwd(), "data", "notes.json"), "utf8")) as NoteFixture[];
  // the capture screen offers the fixture transcripts; it never pretends to transcribe
  const offered = notes.filter((n) => ["N-001", "N-002", "N-010", "N-013", "N-004", "N-006"].includes(n.id));
  return (
    <main className="main narrow">
      <CaptureClient notes={offered} locale={locale} />
    </main>
  );
}
