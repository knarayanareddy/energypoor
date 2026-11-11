import Link from "next/link";
import { notFound } from "next/navigation";
import { findHousehold } from "@/server/store";
import { buildBrief, formatDateLongNl, formatDateNl, monthsAgoNl, STALE_DAYS } from "@/domain/brief";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";


/**
 * §8.3 — one A4 page, in Dutch, in this order. Nothing else is allowed on the
 * page. The chrome lives outside `.brief` and is hidden by @media print.
 */
export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = findHousehold(id);
  if (!h) notFound();
  const b = buildBrief(h);
  const stale = b.stale_days > STALE_DAYS;

  return (
    <main className="main">
      <div className="no-print row between wrap" style={{ marginBottom: 16 }}>
        <div className="mono small muted">
          <Link href={`/household/${h.household_ref}`} className="linkish">
            {h.household_ref}
          </Link>{" "}
          / bezoekvoorbereiding · één A4
        </div>
        <div className="row">
          <Link href={`/household/${h.household_ref}/family`} className="btn sm">
            Huishoudweergave
          </Link>
          <PrintButton />
        </div>
      </div>

      <article className="brief" id="brief">
        <header className="bh">
          <div>
            <div className="kicker">Vervolg · Bezoekvoorbereiding</div>
            <div className="who">{b.display_nl}</div>
            <div className="sub">
              {b.last_visit && (
                <span className={stale ? "stale" : ""}>
                  laatste bezoek {monthsAgoNl(b.stale_days)} geleden ({formatDateNl(b.last_visit)})
                </span>
              )}
              {!b.last_visit && <span>geen eerder bezoek</span>}
              <span> · {h.composition_nl}</span>
            </div>
          </div>
          <div className="kicker" style={{ whiteSpace: "nowrap" }}>
            {formatDateLongNl(b.generated_at.slice(0, 10))}
          </div>
        </header>

        <section>
          <h3>Wat is afgesproken ({b.agreed.length + b.completed.length + b.dropped.length})</h3>
          {b.completed.map((a) => (
            <div className="item" key={a.action_id}>
              <span className="glyph ok">✓</span>
              <span>{a.what_nl}</span>
              <span className="when">gedaan {formatDateNl(a.by_when)}</span>
            </div>
          ))}
          {b.dropped.map((a) => (
            <div className="item" key={a.action_id}>
              <span className="glyph no">✗</span>
              <span>
                {a.what_nl} <span className="when">NIET GEDAAN</span>
              </span>
              <span className="when">{a.by_when ? formatDateNl(a.by_when) : ""}</span>
              <span className="reason">&ldquo;{a.evidence}&rdquo;</span>
            </div>
          ))}
          {b.agreed.map((a) => (
            <div className="item" key={a.action_id}>
              <span className="glyph">·</span>
              <span>{a.what_nl}</span>
              <span className="when">{a.by_when ? formatDateNl(a.by_when) : "geen datum"}</span>
            </div>
          ))}
          {b.agreed.length + b.completed.length + b.dropped.length === 0 && (
            <div className="item">
              <span className="glyph">·</span>
              <span>Geen afspraken vastgelegd.</span>
              <span className="when" />
            </div>
          )}
        </section>

        <section>
          <h3>Vandaag vragen</h3>
          <ol className="ask">
            {b.ask_today_nl.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
            {b.ask_today_nl.length === 0 && <li>Geen openstaande punten — vraag hoe het gaat.</li>}
          </ol>
        </section>

        <section>
          <h3>Om over te dragen</h3>
          <ul className="hand">
            {b.hand_over_nl.map((x, i) => (
              <li key={i}>
                {x.wat} <span className="cond">(voorwaarde: {x.voorwaarden})</span>
              </li>
            ))}
          </ul>
          <div className="cond" style={{ marginTop: 4 }}>
            Voorbeeldregelingen, geen automatische toekenning — de coach beslist nooit over een recht.
          </div>
        </section>

        <footer className="foot">
          {b.restricted_fields_excluded.length > 0 && (
            <div className="excluded">Niet opgenomen in dit overzicht: {b.restricted_fields_excluded.join(", ")}</div>
          )}
          <div style={{ marginTop: 6 }}>
            Dit dossier is van het huishouden. Zij kunnen het inzien en corrigeren. Niets hiervan is met de
            corporatie gedeeld.
          </div>
          <div style={{ marginTop: 4 }}>
            Demo — synthetic households. No real person&apos;s data is in this build.
          </div>
        </footer>
      </article>
    </main>
  );
}
