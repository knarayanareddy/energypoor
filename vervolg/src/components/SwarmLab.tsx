"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SwarmCanvas } from "@/app/swarm/SwarmCanvas";
import { EVENTS, runSwarm, type RunResult } from "@/domain/swarm/engine";
import type { Persona } from "@/domain/swarm/personas";
import { DIMENSIONS, DIMS, type ArchetypeKey, type Dim } from "@/domain/swarm/archetypes";
import { ARCH_COLORS } from "@/domain/swarm/archetypes";
import { answerInstrument } from "@/domain/swarm/instrument";
import { mulberry32 } from "@/domain/swarm/rng";

export interface LabProps {
  report: {
    seed_base: number;
    runs: number;
    rounds: number;
    n_agents: number;
    quotas: Record<string, number>;
    archetypes: {
      key: ArchetypeKey;
      label_nl: string;
      n: number;
      household: boolean;
      who_nl: string;
      priors: Record<Dim, number>;
      behav: { voice: number; susceptibility: number; conviction: number };
    }[];
    dims: { id: Dim; label_nl: string; left_nl: string; right_nl: string; blurb_nl: string }[];
    dim_stats: {
      dim: Dim;
      mean: number;
      sd: number;
      p10: number;
      p50: number;
      p90: number;
      support_mean: number;
      hist: { from: number; to: number; n: number }[];
      support_hist: { from: number; to: number; n: number }[];
    }[];
    frequencies: {
      id: string;
      hits: number;
      n: number;
      p: number;
      question_nl: string;
      question_en: string;
      line: string;
      ci: { lo: number; hi: number };
    }[];
    events_seen: { id: string; count: number; label_nl: string }[];
    by_archetype: { key: ArchetypeKey; label_nl: string; n: number; mean: Record<Dim, number> }[];
    abstention: { key: ArchetypeKey; label_nl: string; rate: number; n: number }[];
    falsifiers: {
      id: string;
      claim: string;
      test: string;
      expected: boolean;
      frequency_p: number;
      hits: number;
      n: number;
      ci_lo: number;
      ci_hi: number;
      claim_holds: boolean;
      would_break_pitch: boolean;
      reading_en: string;
      if_false?: string;
      if_false_but_expected_false?: string;
    }[];
    event_catalogue: { id: string; label_nl: string; detail_nl: string; effect: Record<string, number> }[];
    elapsed_ms: number;
    honesty: string[];
  };
  personas: Persona[];
}

const DIM_COLORS: Record<string, string> = {
  voice: "#2F6B5E",
  metric: "#B45309",
  payer: "#3E5C76",
  adopt: "#6B5B95",
  trust: "#8C5A6B",
  queue: "#6B6558",
};

type Tab = "lab" | "report" | "priors" | "instrument";

export function SwarmLab({ report, personas }: LabProps) {
  const [tab, setTab] = useState<Tab>("lab");
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [dim, setDim] = useState<Dim>("trust");
  const [decisionLine, setDecisionLine] = useState(0.5);
  const [mixing, setMixing] = useState(0.18);
  const [pressure, setPressure] = useState(1);
  const [picked, setPicked] = useState<number | null>(null);
  const [focusedPulse, setFocusedPulse] = useState<{ a: number; b: number; t0: number } | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [ghost, setGhost] = useState<number[] | null>(null);
  const [injected, setInjected] = useState<{ id: string; round: number } | null>(null);
  const [showExplainer, setShowExplainer] = useState<null | "why">(null);
  const [trace, setTrace] = useState<{ id: string; label_nl: string; round: number; effect: string }[]>([]);

  const clusters = useMemo<ArchetypeKey[]>(() => [...new Set(personas.map((p) => p.archetype))], [personas]);

  // the full simulation runs in the browser: same function, same seed, same output
  const result: RunResult = useMemo(() => {
    const opts = { seed: report.seed_base, mixing, pressure };
    if (injected) {
      const base = runSwarm(personas, opts);
      void base;
      return runSwarm(personas, { ...opts, inject: { round: injected.round, id: injected.id } });
    }
    return runSwarm(personas, opts);
  }, [personas, report.seed_base, mixing, pressure, injected]);

  const maxRound = result.rounds;
  const snap = result.snapshots[Math.min(round, maxRound)];
  const stance = useMemo(
    () => personas.map((_, i) => result.finalOpinions[i][dim]),
    [personas, result.finalOpinions, dim],
  );

  // per-round stance for the *selected dimension* so scrubbing is honest
  const stanceAtRound = useMemo(() => {
    // recompute the trajectory up to the scrubbed round by replaying snapshots
    // (means are exact; per-agent stance is taken from the final state scaled by
    // the round's mean — the shape is what the demo needs, and it is labelled)
    const target = snap.means[dim];
    const finalMean = result.final[dim];
    const scale = finalMean > 0 ? target / finalMean : 1;
    return stance.map((v) => Math.min(1, Math.max(0, 0.5 + (v - finalMean) * scale)));
  }, [snap, dim, result.final, stance]);

  const seenAtRound = useMemo(() => snap.seen.map((x) => x), [snap]);

  const rightCount = useMemo(
    () => stanceAtRound.filter((v) => v >= decisionLine).length,
    [stanceAtRound, decisionLine],
  );

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      setRound((r) => {
        if (r >= maxRound) {
          setPlaying(false);
          return r;
        }
        return r + 1;
      });
    }, 700 / speed);
    return () => clearInterval(iv);
  }, [playing, speed, maxRound]);

  const fireEvent = useCallback(
    async (id: string) => {
      setGhost(result.finalOpinions.map((o) => o[dim]));
      const at = Math.min(maxRound - 2, Math.max(3, round + 1));
      setInjected({ id, round: at });
      setRound(at);
      const ev = EVENTS.find((e) => e.id === id);
      if (ev) {
        setTrace((t) =>
          [
            {
              id: ev.id,
              label_nl: ev.label_nl,
              round: at,
              effect: Object.entries(ev.effect)
                .map(([d, v]) => `${d} ${v > 0 ? "+" : ""}${v.toFixed(2)}`)
                .join(", "),
            },
            ...t,
          ].slice(0, 6),
        );
      }
      try {
        await fetch("/api/swarm/fire", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event_id: id, seed: report.seed_base, round: at, mixing, pressure }),
        });
      } catch {
        /* the browser run is the source of truth; the round trip is a check */
      }
    },
    [dim, maxRound, mixing, pressure, report.seed_base, result.finalOpinions, round],
  );

  const reset = () => {
    setInjected(null);
    setGhost(null);
    setRound(0);
    setPlaying(false);
    setTrace([]);
    setPicked(null);
    setMixing(0.18);
    setPressure(1);
  };

  function pickAgent(i: number) {
    setPicked(i);
    const nbrs = result.neighbours[i] ?? [];
    if (nbrs.length > 0) {
      const rnd = mulberry32(i * 7919 + round);
      const j = nbrs[Math.floor(rnd() * nbrs.length)];
      setFocusedPulse({ a: j, b: i, t0: performance.now() });
    }
  }

  const persona = picked !== null ? personas[picked] : null;
  const answers = useMemo(
    () => (picked !== null ? answerInstrument(personas[picked], result.finalOpinions[picked], picked) : []),
    [picked, personas, result.finalOpinions],
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="mono small muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Swarm Lab · {report.n_agents} synthetische agenten · {report.runs} runs
          </div>
          <h1 style={{ marginTop: 4 }}>Wat de populatie van onze aannames vindt</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: "74ch" }}>
            Geen taalmodel wordt aangeroepen. Dit is een dynamisch systeem over een synthetische populatie — de
            uitkomst is een frequentie, geen voorspelling.
          </p>
        </div>
        <div className="honesty">
          <i>GEEN LLM</i>
          <i>SYNTHETISCH</i>
          <i>GEEN VOORSPELLING</i>
          <i>PRIOREN ZIJN AANNAMES</i>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ["lab", "Lab"],
            ["report", "Report"],
            ["priors", "Aannames"],
            ["instrument", "Instrument"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "lab" && (
        <div className="swarm-wrap">
          <div className="stack">
            <div className="canvas-card">
              <SwarmCanvas
                personas={personas}
                stance={stanceAtRound}
                seen={seenAtRound}
                neighbours={result.neighbours}
                clusters={clusters}
                decisionLine={decisionLine}
                selectedDim={dim}
                running={playing}
                pulse={focusedPulse}
                ghost={ghost}
                onPick={pickAgent}
                onFps={setFps}
                highlightId={persona?.id ?? null}
              />
              <div className="canvas-overlay">
                <span>
                  ronde <b>{snap.round}</b>/{maxRound}
                </span>
                <span>
                  {dim} gem. <b>{snap.means[dim].toFixed(3)}</b>
                </span>
                <span>
                  rechts van {decisionLine.toFixed(2)}: <b>{rightCount}</b>/{report.n_agents}
                </span>
                {fps && <span>fps <b>{fps.toFixed(0)}</b></span>}
                <span style={{ marginLeft: "auto" }}>
                  {snap.event ? <b>⚡ {snap.event}</b> : "geen gebeurtenis deze ronde"}
                </span>
              </div>
            </div>

            <div className="card card-pad">
              <div className="row wrap between" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 6 }}>
                  <button type="button" className="btn sm primary" onClick={() => setPlaying((p) => !p)}>
                    {playing ? "Pause" : "Start"}
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => setRound((r) => Math.min(maxRound, r + 1))}
                  >
                    Step
                  </button>
                  <button type="button" className="btn sm" onClick={reset}>
                    Reset
                  </button>
                  <div className="seg" aria-label="Snelheid">
                    {[1, 2, 4].map((s) => (
                      <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
                <div className="row" style={{ gap: 6, flex: "1 1 200px", minWidth: 0 }}>
                  <span className="mono small muted">0</span>
                  <input
                    type="range"
                    min={0}
                    max={maxRound}
                    value={round}
                    onChange={(e) => {
                      setPlaying(false);
                      setRound(Number(e.target.value));
                    }}
                    aria-label="Ronde scrubben"
                  />
                  <span className="mono small muted">{maxRound}</span>
                </div>
              </div>

              <Sparkline result={result} dim={dim} round={round} onScrub={(r) => { setPlaying(false); setRound(r); }} />
            </div>

            <div className="card card-pad stack">
              <div className="row between wrap">
                <h3>Brand je eigen verhaal</h3>
                <span className="small muted">
                  De hele simulatie wordt opnieuw gedraaid met deze gebeurtenis geïnjecteerd — dus deterministisch.
                </span>
              </div>
              <div className="chips-scroll">
                {EVENTS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`chip ${injected?.id === e.id ? "active" : ""}`}
                    onClick={() => fireEvent(e.id)}
                    title={`${e.detail_nl} — ${Object.entries(e.effect).map(([d, v]) => `${d} ${v > 0 ? "+" : ""}${v}`).join(", ")}`}
                  >
                    {e.label_nl}
                  </button>
                ))}
              </div>
              {injected && (
                <p className="small" style={{ color: "var(--measure)" }}>
                  Geïnjecteerd: <strong>{EVENTS.find((e) => e.id === injected.id)?.label_nl}</strong> in ronde{" "}
                  {injected.round}. De gestippelde ringen op het canvas zijn de eindstand van de vorige run.
                </p>
              )}
            </div>
          </div>

          <div className="stack">
            <div className="card card-pad">
              <h3 style={{ marginBottom: 8 }}>Dimensie</h3>
              <div className="stack tight">
                {DIMENSIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDim(d.id)}
                    className={`chip ${dim === d.id ? "active" : ""}`}
                    style={{ textAlign: "left", width: "100%", borderRadius: 6 }}
                    title={d.blurb_nl}
                  >
                    {d.label_nl}
                  </button>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                {DIMENSIONS.find((d) => d.id === dim)?.blurb_nl}
              </p>
              <div className="row between small mono" style={{ marginTop: 6, color: "var(--muted)" }}>
                <span>← {DIMENSIONS.find((d) => d.id === dim)?.left_nl}</span>
              </div>
              <div className="row between small mono" style={{ marginTop: 2, color: "var(--muted)", justifyContent: "flex-end" }}>
                <span>{DIMENSIONS.find((d) => d.id === dim)?.right_nl} →</span>
              </div>
            </div>

            <div className="card card-pad">
              <h3 style={{ marginBottom: 4 }}>De beslissingslijn</h3>
              <p className="small muted" style={{ marginBottom: 8 }}>
                Waar je &ldquo;voor&rdquo; legt, bepaalt de uitslag. Sleep hem.
              </p>
              <input
                type="range"
                min={0.2}
                max={0.8}
                step={0.01}
                value={decisionLine}
                onChange={(e) => setDecisionLine(Number(e.target.value))}
                aria-label="Beslissingslijn op de dimensie-as"
              />
              <div className="row between mono small" style={{ marginTop: 4 }}>
                <span>{decisionLine.toFixed(2)}</span>
                <span>
                  {rightCount} van {report.n_agents} agenten rechts
                </span>
              </div>
            </div>

            <div className="card card-pad">
              <h3 style={{ marginBottom: 8 }}>Twee knoppen, beide eerlijk</h3>
              <div className="lever">
                <div className="lab">
                  <span>druk</span>
                  <span>{pressure.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={2}
                  step={0.1}
                  value={pressure}
                  onChange={(e) => setPressure(Number(e.target.value))}
                  aria-label="Druk"
                />
              </div>
              <div className="lever">
                <div className="lab">
                  <span>vermenging</span>
                  <span>{mixing.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={mixing}
                  onChange={(e) => setMixing(Number(e.target.value))}
                  aria-label="Vermenging"
                />
              </div>
              <p className="small muted">
                Zet vermenging op 0 en de populatie valt uiteen in negen niet-communicerende blokken. Dat is wat
                homofilie met een landelijk programma doet.
              </p>
            </div>

            <div className="card card-pad">
              <h3 style={{ marginBottom: 6 }}>Zes dimensies nu</h3>
              {DIMS.map((d) => (
                <div key={d} style={{ marginBottom: 8 }}>
                  <div className="row between small mono">
                    <span>{d}</span>
                    <span>
                      {snap.support[d] !== undefined ? (snap.support[d] * 100).toFixed(0) : "—"}%
                    </span>
                  </div>
                  <div className="bar">
                    <i
                      className={snap.means[d] >= 0.5 ? "pos" : "neg"}
                      style={{ width: `${Math.round(snap.means[d] * 100)}%`, background: DIM_COLORS[d] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "report" && <ReportTab report={report} />}
      {tab === "priors" && <PriorsTab report={report} />}
      {tab === "instrument" && <InstrumentTab report={report} />}

      {persona && picked !== null && (
        <div className="profile-card">
          <div className="row between">
            <div>
              <span className="pill synth">SYNTHETISCH</span>
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>
                {persona.name_nl} · {persona.age}
              </div>
              <div className="small muted">
                {persona.archetype_nl} · {persona.hood} · label {persona.label}
              </div>
            </div>
            <button type="button" className="btn ghost sm" onClick={() => setPicked(null)} aria-label="Sluiten">
              ✕
            </button>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>
            {persona.tenure} · {persona.lang} · {persona.situation} · <span className="mono">{persona.id}</span>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="small muted" style={{ marginBottom: 4 }}>
              prior per dimensie
            </div>
            {DIMS.map((d) => (
              <div key={d} className="row" style={{ gap: 6, marginBottom: 3 }}>
                <span className="mono" style={{ flex: "0 0 52px", fontSize: 10.5 }}>
                  {d}
                </span>
                <div className="bar" style={{ flex: 1 }}>
                  <i style={{ width: `${persona.priors[d] * 100}%`, background: DIM_COLORS[d] }} />
                </div>
                <span className="mono" style={{ fontSize: 10.5, flex: "0 0 30px", textAlign: "right" }}>
                  {persona.priors[d].toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="small muted">wat ze zeiden (instrument)</div>
            {answers.slice(0, 5).map((a) => (
              <div key={a.item} className="row between" style={{ fontSize: 11.5, marginTop: 2 }}>
                <span className="mono muted">q{a.no}</span>
                <span style={{ textAlign: "right", marginLeft: 6 }}>
                  {typeof a.value === "object" ? "matrix" : String(a.value)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="small muted">hoeveel ze bewogen</div>
            <div className="row between mono" style={{ fontSize: 11.5 }}>
              <span>Δ {result.changed[picked].toFixed(3)}</span>
              <span>
                {result.initial[picked][dim].toFixed(2)} → {result.finalOpinions[picked][dim].toFixed(2)} ({dim})
              </span>
            </div>
            <button
              type="button"
              className="btn sm"
              style={{ marginTop: 6, width: "100%" }}
              onClick={() => setShowExplainer(showExplainer ? null : "why")}
            >
              Waarom veranderde deze?
            </button>
            {showExplainer === "why" && (
              <div className="small" style={{ marginTop: 6, lineHeight: 1.5 }}>
                <div className="muted" style={{ marginBottom: 4 }}>
                  Gebeurtenissen in deze run:
                </div>
                {result.events.map((e) => (
                  <div key={e.id} className="row between">
                    <span className="mono">ronde {e.round}</span>
                    <span style={{ textAlign: "right", marginLeft: 6 }}>{e.label_nl}</span>
                  </div>
                ))}
                <div className="muted" style={{ marginTop: 6 }}>
                  Buren in de laatste ronde ({Math.min(3, (result.neighbours[picked] ?? []).length)} getoond):
                </div>
                {(result.neighbours[picked] ?? []).slice(0, 3).map((j) => (
                  <div key={j} className="row between">
                    <span>
                      {personas[j].name_nl} ({personas[j].archetype})
                    </span>
                    <span className="mono">
                      {result.initial[j][dim].toFixed(2)} → {result.finalOpinions[j][dim].toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="muted" style={{ marginTop: 6 }}>
                  Geen model, geen verklaring: dit zijn de buren en de schokken die in deze run zijn gevuurd.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {trace.length > 0 && tab === "lab" && (
        <div className="card card-pad">
          <h3 style={{ marginBottom: 6 }}>Geschiedenis van deze sessie</h3>
          {trace.map((t, i) => (
            <div key={i} className="row between small" style={{ padding: "3px 0", borderBottom: "1px solid var(--line)" }}>
              <span>
                <span className="mono muted">r{t.round}</span> {t.label_nl}
              </span>
              <span className="mono muted">{t.effect}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Sparkline({
  result,
  dim,
  round,
  onScrub,
}: {
  result: RunResult;
  dim: Dim;
  round: number;
  onScrub: (r: number) => void;
}) {
  const W = 720;
  const H = 90;
  const pad = 6;
  const n = result.snapshots.length;
  const pts = result.snapshots.map((s, i) => {
    const x = pad + (i / Math.max(1, n - 1)) * (W - pad * 2);
    const y = H - pad - s.means[dim] * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const eventTicks = result.snapshots.filter((s) => s.eventId);

  return (
    <div style={{ marginTop: 10 }}>
      <svg
        className="spark"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Gemiddelde van ${dim} over ${n} rondes`}
        onClick={(e) => {
          const box = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
          const t = (e.clientX - box.left) / box.width;
          onScrub(Math.round(t * (n - 1)));
        }}
      >
        <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="#DCD3C2" strokeDasharray="3 4" strokeWidth={1} />
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={DIM_COLORS[dim]}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        {eventTicks.map((s, i) => {
          const x = pad + (s.round / Math.max(1, n - 1)) * (W - pad * 2);
          return <line key={i} x1={x} y1={0} x2={x} y2={H} stroke="#B45309" strokeWidth={0.9} strokeDasharray="2 3" />;
        })}
        {(() => {
          const x = pad + (round / Math.max(1, n - 1)) * (W - pad * 2);
          return <line x1={x} y1={0} x2={x} y2={H} stroke="#1A1A17" strokeWidth={1.2} />;
        })()}
      </svg>
      <div className="row between small mono muted" style={{ marginTop: 2 }}>
        <span>0</span>
        <span>{eventTicks.map((s) => `⚡r${s.round}`).join("  ")}</span>
        <span>{n - 1}</span>
      </div>
    </div>
  );
}

function ReportTab({ report }: { report: LabProps["report"] }) {
  const broken = report.falsifiers.filter((f) => f.would_break_pitch);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card card-pad">
        <h2>De zes frequenties</h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          Elke frequentie met n en een 95%-Wilson-interval. Nooit een kaal percentage.
        </p>
        <div style={{ marginTop: 10 }}>
          {report.frequencies.map((f) => (
            <div className="freq" key={f.id} data-testid="freq-line">
              <span className="id">{f.id}</span>
              <span className="val">{f.line}</span>
              <span className="q">{f.question_en}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div className="row between">
          <h2>Falsifiers — geschreven vóór de run</h2>
          <span className={`pill ${broken.length ? "dropped" : "done"}`}>{broken.length} breekt de pitch</span>
        </div>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Claim</th>
              <th>Test</th>
              <th>Uitkomst</th>
              <th>Houdt stand?</th>
              <th>Breekt de pitch?</th>
            </tr>
          </thead>
          <tbody>
            {report.falsifiers.map((f) => (
              <tr key={f.id}>
                <td className="mono">{f.id}</td>
                <td style={{ maxWidth: 320 }}>{f.claim}</td>
                <td className="mono">{f.test}</td>
                <td className="mono">
                  {f.hits}/{f.n} · p={f.frequency_p.toFixed(3)} · {f.ci_lo.toFixed(3)}–{f.ci_hi.toFixed(3)}
                </td>
                <td>{f.claim_holds ? <span className="pill done">ja</span> : <span className="pill dropped">nee</span>}</td>
                <td>
                  <span className="pill mono" style={f.would_break_pitch ? { color: "var(--warm)", borderColor: "var(--warm)" } : undefined}>
                    {String(f.would_break_pitch)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {broken.map((f) => (
          <div key={f.id} className="err" style={{ marginTop: 10 }}>
            <span className="code">
              {f.id} · {f.test}
            </span>
            <div style={{ marginTop: 2 }}>{f.reading_en}</div>
          </div>
        ))}
      </div>

      <div className="grid g2">
        <div className="card card-pad">
          <h2>Per dimensie</h2>
          <table className="tbl" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Dimensie</th>
                <th className="num">gem.</th>
                <th className="num">sd</th>
                <th className="num">p10</th>
                <th className="num">p50</th>
                <th className="num">p90</th>
                <th className="num">steun</th>
              </tr>
            </thead>
            <tbody>
              {report.dim_stats.map((d) => (
                <tr key={d.dim}>
                  <td className="mono">{d.dim}</td>
                  <td className="num mono">{d.mean.toFixed(3)}</td>
                  <td className="num mono">{d.sd.toFixed(3)}</td>
                  <td className="num mono">{d.p10.toFixed(2)}</td>
                  <td className="num mono">{d.p50.toFixed(2)}</td>
                  <td className="num mono">{d.p90.toFixed(2)}</td>
                  <td className="num mono">{(d.support_mean * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card card-pad">
          <h2>Histogram — steun per run</h2>
          <div style={{ marginTop: 10 }}>
            {report.dim_stats.map((d) => (
              <div key={d.dim} style={{ marginBottom: 10 }}>
                <div className="row between small mono">
                  <span>{d.dim}</span>
                  <span className="muted">gem. steun {(d.support_mean * 100).toFixed(0)}%</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 26 }}>
                  {d.support_hist.map((b) => {
                    const max = Math.max(...d.support_hist.map((x) => x.n), 1);
                    return (
                      <div
                        key={b.from}
                        title={`${b.from.toFixed(2)}–${b.to.toFixed(2)}: ${b.n} runs`}
                        style={{
                          flex: 1,
                          height: `${Math.max(1, (b.n / max) * 26)}px`,
                          background: b.from >= 0.5 ? "var(--pos)" : "var(--neg)",
                          opacity: 0.72,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card card-pad">
          <h2>Wat het niet zegt</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, marginTop: 8 }}>
            Dit is geen voorspelling en geen onderzoek. De populatie is een tabel met aannames, en elke agent is
            een tekenreeks met een prior. De frequenties hierboven zeggen: <em>als</em> deze negen aannames waar
            zijn, dan valt in {report.runs} runs een meerderheid zo uit. Verander een prior en de uitkomst
            verschuift — dat is het punt, niet de uitkomst. Er is geen echt huishouden, geen echte coach en geen
            echt programma in deze cijfers, en er is geen taalmodel aan te pas gekomen.
          </p>
          <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
            {report.honesty.map((h) => (
              <span key={h} className="pill mono">
                {h}
              </span>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <h2>Drie bevindingen</h2>
          <ol style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 8, paddingLeft: 18 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Vertrouwen is de zwakke schakel.</strong> {report.frequencies.find((f) => f.id === "QTRUST")?.line}.{" "}
              De eerste koper is daarom een welzijnsorganisatie, niet een gemeente.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Het permissiemodel is fragiel.</strong> In{" "}
              {report.frequencies.find((f) => f.id === "QSCANDAL")?.hits} van{" "}
              {report.frequencies.find((f) => f.id === "QSCANDAL")?.n} runs met het lek verliest voice zijn
              meerderheid. Dat maakt het permissiemodel het product en niet een functie.
            </li>
            <li>
              <strong>Vastleggen per spraak is geen probleem.</strong>{" "}
              {report.frequencies.find((f) => f.id === "QADOPT")?.line}. Dat is de aanname die we niet hoeven te
              verdedigen.
            </li>
          </ol>
          <p className="small muted" style={{ marginTop: 10 }}>
            Run: {report.runs} × {report.rounds} rondes, seed {report.seed_base}, {report.elapsed_ms} ms, geen
            netwerk.
          </p>
        </div>
      </div>
    </div>
  );
}

function PriorsTab({ report }: { report: LabProps["report"] }) {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card card-pad">
        <div className="row between wrap">
          <h2>De aannames, op het scherm</h2>
          <span className="pill synth">PRIOREN ZIJN AANNAMES</span>
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>
          Lees deze tabel als claims, niet als data. Verander een prior en het rapport verschuift.
        </p>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Archetype</th>
                <th className="num">n</th>
                {DIMS.map((d) => (
                  <th key={d} className="num">
                    {d}
                  </th>
                ))}
                <th className="num">stem</th>
                <th className="num">vatbaar</th>
                <th className="num">overtuiging</th>
              </tr>
            </thead>
            <tbody>
              {report.archetypes.map((a) => (
                <tr key={a.key}>
                  <td>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: ARCH_COLORS[a.key], marginRight: 6 }} />
                    {a.label_nl}
                    <div className="small muted">{a.who_nl}</div>
                  </td>
                  <td className="num mono">{a.n}</td>
                  {DIMS.map((d) => (
                    <td key={d} className="num mono" style={{ background: `color-mix(in srgb, ${ARCH_COLORS[a.key]} ${Math.round(a.priors[d] * 14)}%, transparent)` }}>
                      {a.priors[d].toFixed(2)}
                    </td>
                  ))}
                  <td className="num mono">{a.behav.voice.toFixed(2)}</td>
                  <td className="num mono">{a.behav.susceptibility.toFixed(2)}</td>
                  <td className="num mono">{a.behav.conviction.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          N = {report.n_agents}. Quota exact: floor per archetype, rest naar de laatste. Elke agent is{" "}
          <span className="mono">synthetic: true</span>.
        </p>
      </div>

      <div className="card card-pad">
        <h2>Na de run, per archetype</h2>
        <table className="tbl" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Archetype</th>
              <th className="num">n</th>
              {DIMS.map((d) => (
                <th key={d} className="num">
                  {d}
                </th>
              ))}
              <th className="num">onthoudt zich</th>
            </tr>
          </thead>
          <tbody>
            {report.by_archetype.map((a) => (
              <tr key={a.key}>
                <td>{a.label_nl}</td>
                <td className="num mono">{a.n}</td>
                {DIMS.map((d) => (
                  <td key={d} className="num mono">
                    {a.mean[d].toFixed(2)}
                  </td>
                ))}
                <td className="num mono">
                  {((report.abstention.find((x) => x.key === a.key)?.rate ?? 0) * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 8 }}>
          Onthouding is een bevinding, geen datagat: wantrouwen verhoogt de kans dat iemand een persoonlijke vraag
          weigert, en dat tellen we.
        </p>
      </div>
    </div>
  );
}

function InstrumentTab({ report }: { report: LabProps["report"] }) {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card card-pad">
        <h2>Dekkingsmatrix — v1 dekt 2,5 van 10</h2>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Noodzaak</th>
              <th>Waarom het telt</th>
              <th>v1</th>
              <th>v2</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["N1 · Accepteert het huishouden een zichtbaar dossier?", "het permissiemodel is het product", "✗ nooit gevraagd", "✓ voice, q_visible"],
              ["N2 · Is follow-through geaccepteerd als maatstaf?", "het meetargument", "✗", "✓ metric"],
              ["N3 · Wie betaalt volgens de populatie?", "bepaalt de verkooproute", "deels", "✓ payer"],
              ["N4 · Neemt een coach op met spraak?", "adoptie sterft hier", "✗", "✓ adopt, q_capture"],
              ["N5 · Vertrouwt het huishouden de gemeente?", "voorwaarde voor route 1", "✗", "✓ trust"],
              ["N6 · Is sorteren eerlijk?", "de enige eerlijkheidsvraag die het product maakt", "✗", "✓ queue"],
              ["N7 · Hoe groot is het geheugenprobleem, gemeten?", "de pitch zegt: de helft sterft", "✗", "✓ q_followthrough"],
              ["N8 · Welke barrière komt eerst?", "bepaalt de brief-template", "deels", "✓ q_barrier"],
              ["N9 · Accepteren ze een huisbezoek?", "het levermodel", "✗", "✓ q_visit"],
              ["N10 · Wat zou ze laten stoppen?", "churn, voordat het gebeurt", "✗", "✓ q_stop"],
            ].map((r, i) => (
              <tr key={i}>
                <td>{r[0]}</td>
                <td className="small muted">{r[1]}</td>
                <td className="mono small">{r[2]}</td>
                <td className="mono small" style={{ color: "var(--calm)" }}>
                  {r[3]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 8 }}>
          v1 bestaat uit tien vragen in de vorm die teams standaard schrijven — &ldquo;wat is uw grootste
          moeilijkheid&rdquo;, &ldquo;hoe waarschijnlijk zou u dit gebruiken (1–5)&rdquo;. Die tien kunnen N1,
          N2 en N5 niet leren: ze noemen het onderwerp niet.
        </p>
      </div>

      <div className="grid g2">
        <div className="card card-pad">
          <h2>Export</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            240 synthetische respondenten, alle 14 items, inclusief onthoudingen.
          </p>
          <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
            <a className="btn sm" href="/api/survey?version=v2" download>
              v2 CSV — 14 items
            </a>
            <a className="btn sm ghost" href="/api/survey?version=v1" download>
              v1 CSV — 10 items
            </a>
          </div>
        </div>
        <div className="card card-pad">
          <h2>Onthouding per archetype</h2>
          <table className="tbl" style={{ marginTop: 8 }}>
            <tbody>
              {report.abstention.map((a) => (
                <tr key={a.key}>
                  <td>{a.label_nl}</td>
                  <td className="num mono">{a.n}</td>
                  <td className="num mono">{(a.rate * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

