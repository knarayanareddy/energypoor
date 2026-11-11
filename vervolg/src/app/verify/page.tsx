import { readLog, verifyLog } from "@/server/store";
import { AuditPanel } from "@/components/AuditPanel";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const v = verifyLog();
  const { rows } = readLog();
  return (
    <main className="main">
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <div className="mono small muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Audit · logs/audit.jsonl
          </div>
          <h1 style={{ marginTop: 4 }}>De keten liegt niet</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: "70ch" }}>
            Elk bezoek en elke correctie is een regel met een sha256 over de canonieke JSON, gekoppeld aan de hash
            van de vorige regel. Wijzig één regel in het bestand en de controleur wijst hem aan.
          </p>
        </div>

        <div className="grid g3">
          <div className="tile">
            <div className="k">Rijen</div>
            <div className="v">{v.total}</div>
            <div className="s">append-only, geen gaten</div>
          </div>
          <div className={`tile ${v.brokenAt === null ? "calm" : "warm"}`}>
            <div className="k">Geverifieerd</div>
            <div className="v">{v.verified}</div>
            <div className="s">sha256 opnieuw berekend</div>
          </div>
          <div className={`tile ${v.brokenAt === null ? "calm" : "warm"}`}>
            <div className="k">Eerste breuk</div>
            <div className="v">{v.brokenAt ?? "geen"}</div>
            <div className="s">{v.reason ?? "de keten is intact"}</div>
          </div>
        </div>

        <AuditPanel
          initial={v}
          rows={rows.slice(-40).reverse()}
        />

        <div className="card card-pad">
          <h2>Hoe dit werkt</h2>
          <div className="prose" style={{ marginTop: 8 }}>
            <pre
              className="mono"
              style={{
                background: "var(--paper-2)",
                padding: 12,
                borderRadius: 6,
                fontSize: 11.5,
                overflowX: "auto",
                lineHeight: 1.55,
              }}
            >{`// canonieke JSON: sleutels gesorteerd op elk niveau, dan sha256 over de exacte string
hash = sha256(canonicalJson({ seq, ts, actor, action, subject, payload, prev_hash }))`}</pre>
            <p className="small muted">
              De schrijver opent het bestand met <code>O_APPEND</code> en schrijft één regel per gebeurtenis, achter
              een promise-keten als mutex. De lezer sorteert op <code>seq</code>, herberekent elke hash, en meldt de
              eerste rij waar <code>prev_hash</code> of de hash zelf niet klopt.
            </p>
            <p className="small muted">
              <code>npx tsx scripts/verify-chain.ts</code> doet hetzelfde buiten de browser, en geeft exitcode 1 bij
              een breuk.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
