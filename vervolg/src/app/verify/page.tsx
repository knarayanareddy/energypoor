import { readLog, verifyLog } from "@/server/store";
import { AuditPanel } from "@/components/AuditPanel";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { locale, t } = await getI18n(await searchParams);
  const v = verifyLog();
  const { rows } = readLog();
  return (
    <main className="main">
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <div className="mono small muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t("ver.eyebrow")}
          </div>
          <h1 style={{ marginTop: 4 }}>{t("ver.title")}</h1>
          <p className="muted" style={{ marginTop: 6, maxWidth: "70ch" }}>
            {t("ver.lede")}
          </p>
        </div>

        <div className="grid g3">
          <div className="tile">
            <div className="k">{t("ver.rows")}</div>
            <div className="v">{v.total}</div>
            <div className="s">{t("ver.rows.sub")}</div>
          </div>
          <div className={`tile ${v.brokenAt === null ? "calm" : "warm"}`}>
            <div className="k">{t("ver.verified")}</div>
            <div className="v">{v.verified}</div>
            <div className="s">{t("ver.verified.sub")}</div>
          </div>
          <div className={`tile ${v.brokenAt === null ? "calm" : "warm"}`}>
            <div className="k">{t("ver.first_break")}</div>
            <div className="v">{v.brokenAt ?? t("ver.intact")}</div>
            <div className="s">{v.reason ?? t("ver.intact.sub")}</div>
          </div>
        </div>

        <AuditPanel initial={v} rows={rows.slice(-40).reverse()} locale={locale} />

        <div className="card card-pad">
          <h2>{t("ver.how")}</h2>
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
              {t("ver.how.body1", { open: "O_APPEND", seq: "seq", prev: "prev_hash" })}
            </p>
            <p className="small muted">
              <code>npx tsx scripts/verify-chain.ts</code> {t("ver.how.body2")}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
