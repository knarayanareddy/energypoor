import Link from "next/link";
import type { Action, CaseRow, Household } from "@/domain/types";
import { daysBetween, formatDateNl, todayIso } from "@/domain/brief";
import { CaseTable } from "@/components/CaseTable";
import { ARCH, DIMENSIONS, N_AGENTS } from "@/domain/swarm/archetypes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = (await import("@data/cases.json")).default as CaseRow[];
  const households = (await import("@data/households.json")).default as unknown as Household[];
  const today = todayIso();

  const allActions = households.flatMap((h) => h.actions);
  const dropped = allActions.filter((a) => a.status === "niet_gedaan");
  const open = allActions.filter((a) => a.status === "afgesproken");
  const done = allActions.filter((a) => a.status === "gedaan");
  const restricted = households.flatMap((h) => h.barriers.filter((b) => b.restricted)).length;
  const total = allActions.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  // Follow-through coverage, derived from this build's own fixtures — never asserted.
  // Definition: the share of actions that had a chance to be followed up (i.e. were
  // not agreed at the household's most recent visit) and carry a status today.
  // Actions agreed at the last visit have no later visit at which a status could
  // have been observed, so counting them against the product would be dishonest.
  const lastVisitByHousehold = new Map(households.map((h) => [h.household_ref, h.visits[h.visits.length - 1]?.visit_id]));
  const eligible = allActions.filter((a) => a.set_at_visit !== lastVisitByHousehold.get(a.household_ref));
  const covered = eligible.filter(
    (a) => a.status_at_visit !== null && a.status_at_visit !== a.set_at_visit,
  );
  const coverage = eligible.length ? Math.round((covered.length / eligible.length) * 100) : 0;

  const stale = households
    .filter((h) => h.last_visit)
    .map((h) => ({ h, days: daysBetween(h.last_visit!, today) }))
    .sort((a, b) => b.days - a.days);

  return (
    <main className="main">
      <div className="stack" style={{ gap: 18 }}>
        <div className="row between wrap" style={{ alignItems: "flex-end" }}>
          <div>
            <div className="mono muted small" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Caseload · coach C-07 · gemeente Groningen
            </div>
            <h1 style={{ marginTop: 4 }}>De afspraak die niemand onthoudt</h1>
            <p className="muted" style={{ marginTop: 6, maxWidth: "62ch" }}>
              Eén coach, {rows.length} dossiers. Wat vorige keer is afgesproken staat hieronder, en wat er
              daarna gebeurde. Niets op dit scherm zegt iets over een persoon.
            </p>
          </div>
          <div className="row wrap">
            <Link href="/capture" className="btn primary">
              Bezoek vastleggen
            </Link>
            <Link href="/swarm" className="btn">
              Swarm Lab
            </Link>
          </div>
        </div>

        <div className="grid g3">
          <div className="tile">
            <div className="k">Dossiers · 3 met historie</div>
            <div className="v">{rows.length}</div>
            <div className="s">synthetic households, 30 rows</div>
          </div>
          <div className="tile">
            <div className="k">Afspraken in de 3 dossiers</div>
            <div className="v">
              {done.length}
              <span className="muted" style={{ fontSize: 14 }}>
                {" "}
                / {total} gedaan
              </span>
            </div>
            <div className="s">
              {open.length} open · {dropped.length} niet gedaan ({pct(dropped.length)}%)
            </div>
          </div>
          <div className="tile warm">
            <div className="k">Follow-through coverage</div>
            <div className="v">{coverage}%</div>
            <div className="s">
              {covered.length}/{eligible.length} opgevolgde afspraken; {eligible.length - covered.length} nooit
              aangeraakt
            </div>
          </div>
        </div>

        <div className="grid split-2-1">
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-head">
              <h2>Wachtrij — sorteer op het dossier, niet op de persoon</h2>
              <span className="pill mono">{rows.length} rijen</span>
            </div>
            <CaseTable rows={rows} />
          </div>

          <div className="stack">
            <div className="card">
              <div className="card-head">
                <h2>Wat blijft liggen</h2>
              </div>
              <div className="card-pad stack tight">
                {stale.map(({ h, days }) => (
                  <Link key={h.household_ref} href={`/household/${h.household_ref}`} className="row between" style={{ gap: 10 }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13 }}>{h.display_nl}</span>
                      <span className="mono small muted">{h.household_ref}</span>
                    </span>
                    <span className={`pill ${days > 270 ? "dropped" : ""} mono`}>{days}d</span>
                  </Link>
                ))}
                <p className="small muted" style={{ marginTop: 6 }}>
                  Staleness is het enige signaal van "dit vraagt aandacht" in het product, en het gaat over het dossier.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Wat dit product niet doet</h2>
              </div>
              <div className="card-pad small" style={{ lineHeight: 1.65 }}>
                <p>Geen kWh-dashboard. Geen besparingscalculator. Geen CO₂-schatting.</p>
                <p style={{ marginTop: 6 }}>Geen cijfer over een huishouden — niet op risico, voorrang of geneigdheid.</p>
                <p style={{ marginTop: 6 }}>
                  Geen enkele integratie die een dossier aan een corporatie of leverancier laat zien.
                </p>
                <p style={{ marginTop: 6 }} className="muted">
                  {restricted} beperkte velden bestaan in de fixtures; ze staan in geen enkel overzicht.
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Swarm — {N_AGENTS} synthetische agenten</h2>
              </div>
              <div className="card-pad small stack tight">
                <p className="muted">
                  Zes dimensies, negen archetypes. De populatie is een aanname-tabel, geen onderzoek.
                </p>
                <div className="row wrap" style={{ gap: 4 }}>
                  {Object.values(ARCH).map((a) => (
                    <span key={a.key} className="pill mono" title={a.who_nl}>
                      {a.label_nl} {a.n}
                    </span>
                  ))}
                </div>
                <p className="mono small" style={{ color: "var(--muted)" }}>
                  {DIMENSIONS.length} dims · beslissingslijn 0.5
                </p>
                <Link href="/swarm" className="btn sm">
                  Open het lab
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Drie huishoudens, één jaar</h2>
            <span className="pill mono">4 bezoeken elk</span>
          </div>
          <div className="grid g3" style={{ padding: 16 }}>
            {households.map((h) => {
              const d = h.actions.filter((a) => a.status === "niet_gedaan");
              const o = h.actions.filter((a) => a.status === "afgesproken");
              return (
                <div key={h.household_ref} className="card" style={{ padding: 14 }}>
                  <div className="row between">
                    <span className="mono small muted">{h.household_ref}</span>
                    <span className="pill mono">label {h.label}</span>
                  </div>
                  <div style={{ fontWeight: 500, marginTop: 4 }}>{h.display_nl}</div>
                  <div className="small muted">{h.composition_nl}</div>
                  <div className="row wrap" style={{ gap: 4, marginTop: 10 }}>
                    <span className="pill done">{h.actions.filter((a) => a.status === "gedaan").length} gedaan</span>
                    <span className="pill">{o.length} open</span>
                    {d.length > 0 && <span className="pill dropped">{d.length} niet gedaan</span>}
                  </div>
                  <div className="small muted" style={{ marginTop: 8 }}>
                    Laatste bezoek {formatDateNl(h.last_visit)}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    <Link href={`/household/${h.household_ref}`} className="btn sm">
                      Dossier
                    </Link>
                    <Link href={`/household/${h.household_ref}/brief`} className="btn sm">
                      Brief
                    </Link>
                    <Link href={`/household/${h.household_ref}/family`} className="btn sm ghost">
                      Huishouden
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid g2">
          <div className="card card-pad">
            <h2>Waarom dit bestaat</h2>
            <p style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.62 }}>
              Ongeveer <strong>550.000</strong> Nederlandse huishoudens zitten in energiearmoede. Gemeenten
              draaien energiecoach-programma&apos;s; <strong>Dordrecht ging van 9,1% naar 5,1% in vier jaar</strong> —
              de interventie werkt.
            </p>
            <p style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.62 }}>
              Wat het model breekt is <strong>geheugen</strong>: een coach met 120 huishoudens kan niet terugvinden
              wat negen maanden geleden is afgesproken, dus elk bezoek begint opnieuw en de helft van de afspraken
              sterft stil.
            </p>
            <p className="small muted" style={{ marginTop: 10 }}>
              Bronnen: TNO/CBS Monitor Energiearmoede 2025; gemeente Dordrecht programmaresultaten. Zie{" "}
              <Link href="/review" className="linkish">
                de review
              </Link>{" "}
              voor elke afwijking van de spec.
            </p>
          </div>
          <div className="card card-pad">
            <h2>De zeven stadia</h2>
            <ol className="small" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>
                <strong>INPUT</strong> — spraak of tekst. Weigert een notitie zonder dossier.
              </li>
              <li>
                <strong>MODEL</strong> (optioneel) — weigert een actie zonder concreet werkwoord+object.
              </li>
              <li>
                <strong>GATE</strong> — weigert gezondheid/schuld in een gedeeld veld.
              </li>
              <li>
                <strong>MENS</strong> — weigert opslaan zonder bevestiging.
              </li>
              <li>
                <strong>OPSLAG</strong> — append-only; weigert geschiedenis te overschrijven.
              </li>
              <li>
                <strong>OUTPUT</strong> — de brief; weigert een beperkt veld.
              </li>
              <li>
                <strong>MENS</strong> — het huishouden ziet en corrigeert; weigert interne notities.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}

void ((_: Action) => _);
