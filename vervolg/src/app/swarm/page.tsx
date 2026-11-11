import { readFileSync } from "node:fs";
import path from "node:path";
import { buildPersonas } from "@/domain/swarm/personas";
import { SwarmLab, type LabProps } from "@/components/SwarmLab";

export const dynamic = "force-dynamic";

export default async function SwarmPage() {
  const report = JSON.parse(readFileSync(path.join(process.cwd(), "data", "swarm", "report.json"), "utf8")) as LabProps["report"];
  const personas = buildPersonas(240, report.seed_base);
  return (
    <main className="main">
      <SwarmLab report={report} personas={personas} />
    </main>
  );
}
