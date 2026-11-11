"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Draft, DraftAction, DraftBarrier } from "@/domain/types";

interface NoteFixture {
  id: string;
  household_ref: string;
  date: string;
  kind: string;
  text: string;
  expected: { actions: number; barriers: string[]; restricted: number; needs_input: number };
}

const HOUSEHOLDS = [
  { ref: "HH-014", label: "HH-014 · Familie Yılmaz" },
  { ref: "HH-027", label: "HH-027 · Mevrouw de Boer" },
  { ref: "HH-041", label: "HH-041 · Dhr. Osei" },
];

const KIND_NL: Record<string, string> = {
  clean: "schone notitie",
  vague: "vaag",
  adversarial: "adversarieel — privacy",
  "bilingual-tr": "NL/TR",
  "bilingual-en": "NL/EN",
  refusal: "weigering",
  "no-date": "geen datum",
  long: "lang",
};

export function CaptureClient({ notes }: { notes: NoteFixture[] }) {
  const [household, setHousehold] = useState("HH-027");
  const [visitDate, setVisitDate] = useState(() => new Date("2026-11-11").toISOString().slice(0, 10));
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 64 }, () => 0.06));
  const [transcriptChip, setTranscriptChip] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const [whatEdits, setWhatEdits] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<{ seq: number; hash: string; visit_id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      mediaRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
    setLevels((prev) => [...prev.slice(1), Math.min(1, Math.max(0.06, peak * 2.4))]);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  /**
   * §2: a fake-but-honest voice path. MediaRecorder really records (the user
   * grants permission and sees a real waveform), but no ASR is called. When the
   * coach stops, a pre-written fixture transcript is offered with a visible chip:
   * "demo transcript — no ASR called". We do not pretend to transcribe.
   */
  async function startRecording() {
    setError(null);
    setConfirmed(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      analyserRef.current = analyser;
      rafRef.current = requestAnimationFrame(tick);
      setRecording(true);
      setSeconds(0);
    } catch {
      setError(
        "Geen microfoon. De tekstinvoer hieronder werkt altijd — en de demo hoeft niet op te nemen om eerlijk te zijn.",
      );
      setRecording(false);
    }
  }

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  function stopRecording() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    mediaRef.current = null;
    analyserRef.current = null;
    setRecording(false);
    // offer the fixture transcript for this household, honestly labelled
    const match = notes.find((n) => n.household_ref === household) ?? notes[0];
    setTranscriptChip(`${match.id} · ${KIND_NL[match.kind] ?? match.kind}`);
    setText(match.text);
  }

  async function analyse() {
    setBusy(true);
    setError(null);
    setConfirmed(null);
    try {
      const res = await fetch("/api/note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ household_ref: household, text, visit_date: visitDate, coach_ref: "C-07" }),
      });
      const json = (await res.json()) as Draft & { error?: string; code?: string };
      if (!res.ok) {
        setError(`${json.code ?? "fout"} — ${json.error ?? "mislukt"}`);
        setDraft(null);
        return;
      }
      setDraft(json);
      setEdits(Object.fromEntries(json.actions.map((a) => [a.action_id, true])));
      setWhatEdits(Object.fromEntries(json.actions.map((a) => [a.action_id, a.what_nl])));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/note/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft_id: draft.draft_id,
          coach_ref: "C-07",
          household_ref: draft.household_ref,
          visit_date: draft.visit_date,
          transcript: draft.transcript,
          actions: draft.actions
            .filter((a) => edits[a.action_id])
            .map((a) => ({ ...a, what_nl: whatEdits[a.action_id] ?? a.what_nl })),
          barriers: draft.barriers.filter((b) => edits[b.barrier_id] !== false),
          restricted_hits: draft.restricted_hits,
          needs_input: draft.needs_input,
        }),
      });
      const json = (await res.json()) as { seq: number; hash: string; visit_id: string; error?: string; code?: string };
      if (!res.ok) {
        setError(`${json.code ?? "fout"} — ${json.error ?? "mislukt"}`);
        return;
      }
      setConfirmed({ seq: json.seq, hash: json.hash, visit_id: json.visit_id });
      setDraft(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const actionCount = useMemo(() => draft?.actions.length ?? 0, [draft]);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <div className="mono small muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Bezoek vastleggen · stap 1–4
        </div>
        <h1 style={{ marginTop: 4 }}>Eén minuut inspreken, drie afspraken eruit</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: "64ch" }}>
          Spreek in of typ. De extractor is een regelmachine over Nederlandse tekst — geen model, en het werkt
          met de stekker eruit. Je ziet de uitkomst eerst; pas als jij bevestigt, gaat er iets naar het dossier.
        </p>
      </div>

      <div className="grid split-capture">
        <div className="stack">
          <div className="card card-pad stack">
            <div>
              <label className="lbl" htmlFor="hh">
                Dossier
              </label>
              <select id="hh" className="field" value={household} onChange={(e) => setHousehold(e.target.value)}>
                {HOUSEHOLDS.map((h) => (
                  <option key={h.ref} value={h.ref}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="date">
                Bezoekdatum
              </label>
              <input
                id="date"
                className="field"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div className="small muted">
              Stap 1 weigert een notitie zonder dossier. Daarom is het dossier een verplicht veld en geen
              automatische invulling.
            </div>
          </div>

          <div className="recorder">
            <button
              type="button"
              className="recbtn"
              data-recording={recording}
              onClick={recording ? stopRecording : startRecording}
              aria-label={recording ? "Stop met opnemen" : "Start met opnemen"}
            >
              {recording ? (
                <span>
                  STOP
                  <br />
                  <span className="mono" style={{ fontSize: 13 }}>
                    {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                    {String(seconds % 60).padStart(2, "0")}
                  </span>
                </span>
              ) : (
                <span>
                  OPNAME
                  <br />
                  <span style={{ fontSize: 18 }}>●</span>
                </span>
              )}
            </button>
            <svg className="waveform" viewBox="0 0 320 56" preserveAspectRatio="none" aria-hidden="true">
              {levels.map((l, i) => {
                const h = Math.max(2, l * 52);
                return (
                  <rect
                    key={i}
                    x={i * 5 + 1}
                    y={(56 - h) / 2}
                    width={3}
                    height={h}
                    rx={1.5}
                    fill={recording ? "var(--warm)" : "var(--line)"}
                  />
                );
              })}
            </svg>
            <div className="small muted" style={{ textAlign: "center", maxWidth: "38ch" }}>
              De opname is echt (MediaRecorder). De transcriptie is dat niet — na het stoppen krijg je een
              vooraf geschreven fixture met een chip erbij.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Notitie</h2>
            <div className="row" style={{ gap: 6 }}>
              {transcriptChip && <span className="pill demo">demo transcript — no ASR called</span>}
              <span className="pill mono">{text.length} tekens</span>
            </div>
          </div>
          <div className="card-pad stack">
            {transcriptChip && (
              <div className="note-box small">
                <strong>Let op:</strong> dit is een vaste fixture (<span className="mono">{transcriptChip}</span>),
                geen spraakherkenning. Je kunt hem vrij aanpassen of helemaal weggooien.
              </div>
            )}
            <textarea
              className="note"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setTranscriptChip(null);
              }}
              placeholder="Bijvoorbeeld: Ik bel de corporatie over de isolatie. Mevrouw begrijpt het formulier niet."
              aria-label="Bezoeknotitie"
            />
            <div className="row between wrap" style={{ gap: 10 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                {notes.slice(0, 4).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setText(n.text);
                      setHousehold(n.household_ref);
                      setTranscriptChip(`${n.id} · ${KIND_NL[n.kind] ?? n.kind}`);
                    }}
                    title={n.text}
                  >
                    {n.id} · {KIND_NL[n.kind] ?? n.kind}
                  </button>
                ))}
              </div>
              <button type="button" className="btn primary" onClick={analyse} disabled={busy || text.trim().length < 3}>
                {busy ? "Bezig…" : "Structureer →"}
              </button>
            </div>
            {error && (
              <div className="err">
                <span className="code">{error.split(" — ")[0]}</span>
                <div>{error.split(" — ").slice(1).join(" — ")}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmed && (
        <div className="card card-pad" style={{ borderColor: "var(--calm)" }}>
          <div className="row between wrap">
            <div>
              <h2 style={{ color: "var(--calm)" }}>Bevestigd en weggeschreven</h2>
              <p className="small muted" style={{ marginTop: 4 }}>
                Bezoek <span className="mono">{confirmed.visit_id}</span> staat in de keten als rij{" "}
                <span className="mono">{confirmed.seq}</span>. Hash{" "}
                <span className="mono">{confirmed.hash.slice(0, 16)}…</span>
              </p>
            </div>
            <div className="row">
              <a className="btn sm" href={`/household/${household}`}>
                Open dossier
              </a>
              <a className="btn sm" href="/verify">
                Controleer de keten
              </a>
            </div>
          </div>
        </div>
      )}

      {draft && (
        <div className="card">
          <div className="card-head">
            <h2>Stap 4 — jij bevestigt, niet het systeem</h2>
            <div className="row" style={{ gap: 6 }}>
              <span className="pill mono">{actionCount} acties</span>
              <span className="pill mono">{draft.barriers.length} barrières</span>
              {draft.restricted_count > 0 && <span className="pill restricted">{draft.restricted_count} beperkt</span>}
            </div>
          </div>
          <div className="card-pad stack">
            {draft.errors.map((e) => (
              <div key={e.code} className="err">
                <span className="code">{e.code}</span>
                <div>{e.message_nl}</div>
              </div>
            ))}

            {draft.needs_input.length > 0 && (
              <div className="stack tight">
                {draft.needs_input.map((n, i) => (
                  <div key={i} className="ask-row">
                    <strong>Vraag de coach</strong> · {n.code} · {n.question_nl}
                    <div className="muted" style={{ marginTop: 2, fontSize: 12 }}>
                      &ldquo;{n.sentence}&rdquo; — hier is geen concrete actie uitgehaald. We verzinnen er geen.
                    </div>
                  </div>
                ))}
              </div>
            )}

            {draft.actions.length === 0 && draft.needs_input.length === 0 && (
              <p className="muted">Geen afspraken gevonden. Dat is een geldige uitkomst.</p>
            )}

            {draft.actions.map((a: DraftAction) => (
              <div className="action-edit" key={a.action_id}>
                <div className="row between wrap">
                  <span className="mono small muted">
                    {a.action_id} · wie: {a.who} · wanneer: {a.by_when ?? "geen datum"}
                  </span>
                  <div className="row" style={{ gap: 6 }}>
                    {a.restricted && <span className="pill restricted">beperkt veld</span>}
                    <button
                      type="button"
                      className={`chip ${edits[a.action_id] ? "active" : ""}`}
                      onClick={() => setEdits((p) => ({ ...p, [a.action_id]: !p[a.action_id] }))}
                      aria-pressed={!!edits[a.action_id]}
                    >
                      {edits[a.action_id] ? "opslaan" : "weglaten"}
                    </button>
                  </div>
                </div>
                <input
                  className="field"
                  value={whatEdits[a.action_id] ?? a.what_nl}
                  onChange={(e) => setWhatEdits((p) => ({ ...p, [a.action_id]: e.target.value }))}
                  aria-label={`Actie ${a.action_id}`}
                />
                {a.restricted && (
                  <span className="small" style={{ color: "var(--flag)" }}>
                    De volledige zin staat in een beperkt veld en komt niet in de brief.
                  </span>
                )}
              </div>
            ))}

            {draft.barriers.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <h3 className="small muted" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Barrières
                </h3>
                <div className="stack tight" style={{ marginTop: 6 }}>
                  {draft.barriers.map((b: DraftBarrier) => (
                    <div key={b.barrier_id} className="row between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 13 }}>
                        <span className="pill mono" style={{ marginRight: 6 }}>
                          {b.kind}
                        </span>
                        {b.note_nl}
                      </span>
                      {b.restricted ? <span className="pill restricted">beperkt</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="row between wrap" style={{ marginTop: 6 }}>
              <span className="small muted">
                Nog niets opgeslagen. Deze draft bestaat alleen in dit antwoord.
              </span>
              <div className="row">
                <button type="button" className="btn ghost" onClick={() => setDraft(null)}>
                  Wegwerpen
                </button>
                <button type="button" className="btn primary" onClick={confirm} disabled={busy}>
                  Bevestig als coach →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
