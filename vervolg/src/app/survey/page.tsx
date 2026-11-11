import Link from "next/link";
import { ITEMS, V1_ITEMS } from "@/domain/swarm/instrument";
import { buildPersonas } from "@/domain/swarm/personas";
import { runSwarm } from "@/domain/swarm/engine";
import { answerInstrument } from "@/domain/swarm/instrument";

export const dynamic = "force-dynamic";

const COVERAGE: { need: string; why: string; v1: string; v2: string }[] = [
  {
    need: "N1 · Accepteert het huishouden een zichtbaar dossier?",
    why: "het permissiemodel is het product",
    v1: "✗ nooit gevraagd",
    v2: "✓ voice, q_visible",
  },
  { need: "N2 · Is follow-through geaccepteerd als maatstaf?", why: "het meetargument", v1: "✗", v2: "✓ metric" },
  { need: "N3 · Wie betaalt volgens de populatie?", why: "bepaalt de verkooproute", v1: "deels (\"zorg\")", v2: "✓ payer" },
  { need: "N4 · Neemt een coach op met spraak?", why: "adoptie sterft hier", v1: "✗", v2: "✓ adopt, q_capture" },
  { need: "N5 · Vertrouwt het huishouden de gemeente?", why: "voorwaarde voor route 1", v1: "✗", v2: "✓ trust" },
  { need: "N6 · Is sorteren eerlijk?", why: "de enige eerlijkheidsvraag die het product maakt", v1: "✗", v2: "✓ queue" },
  {
    need: "N7 · Hoe groot is het geheugenprobleem, gemeten?",
    why: "de pitch zegt: de helft sterft",
    v1: "✗",
    v2: "✓ q_followthrough",
  },
  { need: "N8 · Welke barrière komt eerst?", why: "bepaalt de brief-template", v1: "deels", v2: "✓ q_barrier" },
  { need: "N9 · Accepteren ze een huisbezoek?", why: "het levermodel", v1: "✗", v2: "✓ q_visit" },
  { need: "N10 · Wat zou ze laten stoppen?", why: "churn, voordat het gebeurt", v1: "✗", v2: "✓ q_stop" },
];

export default function SurveyPage() {
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
            Instrument · v1 en v2
          </div>
          <h1 style={{ marginTop: 4 }}>Twee vragenlijsten, en het gat ertussen</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: "74ch" }}>
            v1 is wat een team standaard schrijft. v2 is de veertien items die dit product daadwerkelijk iets
            kunnen leren. De matrix hieronder is het argument — niet de antwoorden.
          </p>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Dekkingsmatrix</h2>
            <span className="pill mono">v1: 2,5 / 10 · v2: 9,5 / 10</span>
          </div>
          <div className="scroll-x" style={{ padding: 14 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Noodzaak</th>
                  <th>Waarom het telt</th>
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
              <h2>v1 — tien vragen</h2>
              <span className="pill mono">{V1_ITEMS.length} items</span>
            </div>
            <div className="card-pad">
              <ol className="small" style={{ paddingLeft: 18, lineHeight: 1.75 }}>
                {V1_ITEMS.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
              <p className="small muted" style={{ marginTop: 10 }}>
                Nul items over het geheugen, nul over het permissiemodel, één 1–5-schaal die niets voorspelt.
                Daarom dekt v1 N1, N2 en N5 niet: het onderwerp komt er niet in voor.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>v2 — veertien items</h2>
              <span className="pill mono">{ITEMS.length} items</span>
            </div>
            <div className="card-pad">
              <ol className="small" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
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
            <h2>Zo antwoordt een agent</h2>
            <span className="pill synth">SYNTHETISCH</span>
          </div>
          <div className="scroll-x" style={{ padding: 14 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  {sample.map((s) => (
                    <th key={s.persona.id}>
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
                      <span className="mono small muted">{it.no}</span> {it.text_nl.slice(0, 60)}
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
            Antwoorden komen uit een deterministische functie, niet uit een model:{" "}
            <code>likert5(o) = clamp(1 + round(o*4))</code>, en een optie wordt gekozen op zijn{" "}
            <code>align</code>-veld tegen de huidige mening. Onthouding is een treffer, geen datagat.
          </div>
        </div>

        <div className="grid g2">
          <div className="card card-pad">
            <h2>Onthouding per archetype</h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              <code>0.08 + 0.35 × (1 − trust)</code>. Hoog wantrouwen → vaker &ldquo;zeg ik liever niet&rdquo;. Dat
              is een bevinding.
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
            <h2>Export</h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              240 synthetische respondenten. Elke rij heeft <code>synthetic: SYNTHETISCH</code> en de archetype
              waar de prior vandaan komt.
            </p>
            <div className="stack" style={{ marginTop: 12 }}>
              <a className="btn" href="/api/survey?version=v2" download>
                v2 CSV — 14 items, incl. onthoudingen
              </a>
              <a className="btn ghost" href="/api/survey?version=v1" download>
                v1 CSV — 10 items
              </a>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              De export gaat nooit ergens heen. Geen enkele route in deze app post naar buiten.
            </p>
            <Link href="/swarm" className="btn sm" style={{ marginTop: 8 }}>
              Terug naar het lab
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
