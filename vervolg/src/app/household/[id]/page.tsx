import Link from "next/link";
import { notFound } from "next/navigation";
import type { Household } from "@/domain/types";
import { correctionsFor, findHousehold } from "@/server/store";
import { buildBrief, formatDateLongNl, formatDateNl, monthsAgoNl, restrictedFieldNames, STALE_DAYS } from "@/domain/brief";
import { ActionRow } from "@/components/ActionRow";
import { RestrictedMarker } from "@/components/RestrictedMarker";

export const dynamic = "force-dynamic";


export default async function HouseholdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = findHousehold(id);
  if (!h) notFound();

  const corrections = correctionsFor(h.household_ref);
  const brief = buildBrief(h);
  const fields = restrictedFieldNames(h);
  const shared = h.actions.filter((a) => !a.restricted);
  const byVisit = new Map(h.visits.map((v) => [v.visit_id, v]));

  return (
    <main className="main">
      <div className="stack" style={{ gap: 18 }}>
        <div className="row between wrap" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="mono small muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
              <Link href="/" className="linkish">
                Caseload
              </Link>{" "}
              / {h.household_ref}
            </div>
            <h1 style={{ marginTop: 4 }}>{h.display_nl}</h1>
            <div className="row wrap small muted" style={{ marginTop: 6, gap: 10 }}>
              <span>{h.composition_nl}</span>
              <span>·</span>
              <span>{h.tenure}</span>
              <span>·</span>
              <span className="mono">label {h.label}</span>
              <span>·</span>
              <span>{h.programme}</span>
            </div>
          </div>
          <div className="row wrap">
            <Link href={`/household/${h.household_ref}/brief`} className="btn primary">
              Bezoekvoorbereiding
            </Link>
            <Link href={`/household/${h.household_ref}/family`} className="btn">
              Zo ziet het huishouden het
            </Link>
          </div>
        </div>

        {brief.stale_days > STALE_DAYS && (
          <div className="note-box" style={{ borderLeftColor: "var(--warm)" }}>
            <strong className="stale">
              Laatste bezoek {monthsAgoNl(brief.stale_days)} geleden ({formatDateNl(h.last_visit)}).
            </strong>{" "}
            <span className="muted small">
              Staleness van het dossier — geen uitspraak over het huishouden. Drempel: {STALE_DAYS} dagen.
            </span>
          </div>
        )}

        <div className="grid g3">
          <div className="tile calm">
            <div className="k">Gedaan</div>
            <div className="v">{shared.filter((a) => a.status === "gedaan").length}</div>
            <div className="s">met bewijs in woorden</div>
          </div>
          <div className="tile warm">
            <div className="k">Niet gedaan</div>
            <div className="v">{shared.filter((a) => a.status === "niet_gedaan").length}</div>
            <div className="s">elke rij heeft een echte reden</div>
          </div>
          <div className="tile">
            <div className="k">Nog open</div>
            <div className="v">{shared.filter((a) => a.status === "afgesproken").length}</div>
            <div className="s">
              {shared.filter((a) => a.status === "afgesproken" && !a.by_when).length} zonder datum
            </div>
          </div>
        </div>

        <div className="grid split-3-2">
          <div className="card">
            <div className="card-head">
              <h2>Afspraken</h2>
              <span className="pill mono">{shared.length} gedeeld</span>
            </div>
            <div className="card-pad stack tight">
              {shared.map((a) => (
                <ActionRow key={a.action_id} action={a} visitDate={byVisit.get(a.set_at_visit)?.date ?? null} />
              ))}
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <div className="card-head">
                <h2>Beperkte velden</h2>
                <span className="pill restricted">{fields.length}</span>
              </div>
              <div className="card-pad stack tight small">
                {fields.length === 0 && <p className="muted">Geen.</p>}
                {fields.map((f) => (
                  <div key={f} className="row between">
                    <span className="mono">{f}</span>
                    <RestrictedMarker />
                  </div>
                ))}
                <p className="muted" style={{ marginTop: 8 }}>
                  De waarde staat in het dossier en is zichtbaar voor de coach — niet in de brief, niet in de
                  huishoudweergave, niet in een export.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Barrières</h2>
              </div>
              <div className="card-pad stack tight">
                {h.barriers.map((b) => (
                  <div key={b.barrier_id} className="row between" style={{ gap: 8, alignItems: "flex-start" }}>
                    <span style={{ minWidth: 0 }}>
                      <span className="pill mono" style={{ marginRight: 6 }}>
                        {b.kind}
                      </span>
                      <span className={b.restricted ? "muted" : ""} style={{ fontSize: 13 }}>
                        {b.note_nl}
                      </span>
                    </span>
                    {b.restricted && <RestrictedMarker />}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Correcties</h2>
                <span className="pill mono">{corrections.length}</span>
              </div>
              <div className="card-pad stack tight small">
                {corrections.length === 0 && <p className="muted">Nog geen correcties.</p>}
                {corrections.map((c) => (
                  <div key={c.correction_id}>
                    <div className="mono" style={{ fontSize: 11 }}>
                      {c.correction_id} · {c.by} · {formatDateNl(c.at)}
                    </div>
                    <div>
                      {c.target} <span className="mono">{c.target_id}</span> → <strong>{c.field}</strong>:{" "}
                      <span className="muted">{c.from ?? "—"}</span> → {c.to ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Tijdlijn — append-only</h2>
            <span className="pill mono">{h.visits.length} bezoeken</span>
          </div>
          <div className="card-pad">
            <ul className="tl">
              {[...h.visits].reverse().map((v, i) => (
                <li key={v.visit_id} className={i === 0 ? "now" : ""}>
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <span className="date">
                      {formatDateLongNl(v.date)} · {v.coach_ref} · <span className="mono">{v.visit_id}</span>
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="pill mono">{v.actions_added.length} afspraken</span>
                      {v.restricted_count > 0 && <span className="pill restricted">{v.restricted_count} beperkt</span>}
                    </span>
                  </div>
                  <p style={{ marginTop: 6, fontSize: 13.5 }}>{v.transcript}</p>
                  {v.corrections.length > 0 && (
                    <div className="small" style={{ marginTop: 6, color: "var(--warm)" }}>
                      {v.corrections.length} correctie(s) op dit bezoek
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="row between wrap small muted">
          <span>
            Dit dossier is van het huishouden. Zij kunnen het inzien en corrigeren. Niets hiervan is met de
            corporatie gedeeld.
          </span>
          <span className="mono">geen score · geen urgentie · geen risico</span>
        </div>
      </div>
    </main>
  );
}

void ((_: Household) => _);
