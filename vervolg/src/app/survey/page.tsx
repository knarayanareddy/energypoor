import Link from "next/link";
import { ITEMS, V1_ITEMS } from "@/domain/swarm/instrument";
import { buildPersonas } from "@/domain/swarm/personas";
import { runSwarm } from "@/domain/swarm/engine";
import { answerInstrument } from "@/domain/swarm/instrument";
import { getI18n } from "@/i18n/server";
import { coverageRows } from "@/i18n/survey";
import { v1Items } from "@/i18n/instrument";

export const dynamic = "force-dynamic";

/**
 * Truncate at a word boundary. `slice(0, 60)` cut items mid-word
 * ("Hoe belangrijk is het dat de coach zich de vorige afspraak h"), which looks
 * like a typo in a table of verbatim questionnaire items. The full text stays
 * available in the title attribute.
 */
function clamp60(text: string, max = 60): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

export default async function SurveyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { t, locale } = await getI18n(await searchParams);
  const COVERAGE = coverageRows(locale);
  const V1 = v1Items(locale);
  const personas = buildPersonas(240, 20261111);
  const run = runSwarm(personas, { seed: 20261111 });
  const sample = personas.slice(0, 3).map((p, i) => ({
    persona: p,
    answers: answerInstrument(p, run.finalOpinions[i], i),
  }));

  const abstention = new Map<string, { n: number; abstain: number }>();
  personas.forEach((p, i) => {
    const cur = abstention.get(p.archetype) ?? { n: 0, abstain: 0 };
    cur.n++;
    if (answerInstrument(p, run.finalOpinions[i], i).some((a) => a.abstained)) cur.abstain++;
    abstention.set(p.archetype, cur);
  });

  return (
    <main className="main">
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <div className="mono small muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t("su.eyebrow")}
          </div>
          <h1 style={{ marginTop: 4 }}>{t("su.title")}</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: "74ch" }}>
            {t("su.lede")}
          </p>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>{t("su.matrix")}</h2>
            <span className="pill mono">{t("su.v1.dekking")}</span>
          </div>
          <div className="scroll-x" style={{ padding: 14 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("su.necessary")}</th>
                  <th>{t("su.why")}</th>
                  <th>v1</th>
                  <th>v2</th>
                </tr>
              </thead>
              <tbody>
                {COVERAGE.map((r) => (
                  <tr key={r.need}>
                    <td>{r.need}</td>
                    <td className="small muted">{r.why}</td>
                    <td className="mono small" style={{ color: r.v1.startsWith("✗") ? "var(--warm)" : undefined }}>
                      {r.v1}
                    </td>
                    <td className="mono small" style={{ color: "var(--calm)" }}>
                      {r.v2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid g2">
          <div className="card">
            <div className="card-head">
              <h2>{t("su.v1.head")}</h2>
              <span className="pill mono">{V1.length} items</span>
            </div>
            <div className="card-pad">
              <ol className="small" style={{ paddingLeft: 18, lineHeight: 1.75 }}>
                {V1.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
              <p className="small muted" style={{ marginTop: 10 }}>
                {t("su.v1.note")}
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>{t("su.v2.head")}</h2>
              <span className="pill mono">{ITEMS.length} items</span>
            </div>
            <div className="card-pad">
              {locale === "en" && (
                <p className="small muted" data-testid="artefact-note" style={{ marginBottom: 8 }}>
                  {t("su.items_note")}
                </p>
              )}
              <ol className="small" lang="nl" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
                {ITEMS.map((it) => (
                  <li key={it.id}>
                    <span className="mono" style={{ color: "var(--muted)" }}>
                      {it.block}
                      {it.no}
                    </span>{" "}
                    {it.text_nl}{" "}
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                      {it.id}
                      {it.kind === "matrix" ? " · matrix" : it.kind === "max3" ? " · max 3" : ""}
                      {it.personal ? " · opt-out" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>{t("su.sample")}</h2>
            <span className="pill synth">{t("common.synthetic")}</span>
          </div>
          <div className="scroll-x" style={{ padding: 14 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("su.item")}</th>
                  {sample.map((s) => (
                    <th key={s.persona.id} lang="nl">
                      {s.persona.name_nl}
                      <div className="mono small muted">{s.persona.archetype}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ITEMS.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <span className="mono small muted">{it.no}</span>{" "}
                      <span title={it.text_nl} lang="nl">
                        {clamp60(it.text_nl)}
                      </span>
                    </td>
                    {sample.map((s) => {
                      const a = s.answers.find((x) => x.item === it.id);
                      const v = a?.value;
                      const text =
                        typeof v === "object" && v !== null && !Array.isArray(v)
                          ? Object.entries(v as Record<string, number>)
                              .map(([k, n]) => `${n}`)
                              .join(" / ")
                          : Array.isArray(v)
                            ? v.map((x) => (typeof x === "object" ? x.label_nl : String(x))).join(", ")
                            : String(v ?? "—");
                      return (
                        <td
                          key={s.persona.id}
                          className="mono small"
                          lang="nl"
                          style={a?.abstained ? { color: "var(--warm)" } : undefined}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-pad small muted" style={{ borderTop: "1px solid var(--line)" }}>
            {t("su.sample.note", {
              likert: "likert5(o) = clamp(1 + round(o*4))",
              align: "align",
            })}
          </div>
        </div>

        <div className="grid g2">
          <div className="card card-pad">
            <h2>{t("su.abstain")}</h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              {t("su.abstain.note", { formula: "0.08 + 0.35 × (1 − trust)" })}
            </p>
            <table className="tbl" style={{ marginTop: 10 }}>
              <tbody>
                {[...abstention.entries()].map(([k, v]) => (
                  <tr key={k}>
                    <td className="mono">{k}</td>
                    <td className="num mono">{v.n}</td>
                    <td className="num mono">{((v.abstain / v.n) * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            <h2>{t("su.export")}</h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              {t("su.export.note")}
            </p>
            <div className="stack" style={{ marginTop: 12 }}>
              <a className="btn" href="/api/survey?version=v2" download>
                {t("su.export.v2")}
              </a>
              <a className="btn ghost" href="/api/survey?version=v1" download>
                {t("su.export.v1")}
              </a>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              {t("su.export.never")}
            </p>
            <Link href="/swarm" className="btn sm" style={{ marginTop: 8 }}>
              {t("su.back")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
