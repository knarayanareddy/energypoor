import Link from "next/link";
import { notFound } from "next/navigation";
import { correctionsFor, findHousehold } from "@/server/store";
import { buildFamilyView, formatDateLongNl } from "@/domain/brief";
import { FamilyCorrections } from "@/components/FamilyCorrections";
import { getI18n } from "@/i18n/server";
import { DossierText } from "@/components/DutchContent";

export const dynamic = "force-dynamic";


/**
 * §9.1 stage 7 — the same file, in plain Dutch, no ids, no internal notes, no
 * label. Visibly different from the coach view so a juror can tell at a glance
 * which one they are looking at (§4).
 */
export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getI18n(await searchParams);
  const h = findHousehold(id);
  if (!h) notFound();

  const corrections = correctionsFor(h.household_ref);
  const view = buildFamilyView(
    h,
    corrections.map((c) => ({ at: c.at, field: c.field, to: c.to ?? "" })),
    locale,
  );
  const shared = h.actions.filter((a) => !a.restricted);

  return (
    <main className="main narrow">
      <div className="no-print row between wrap" style={{ marginBottom: 14 }}>
        <div className="mono small muted">
          <Link href={`/household/${h.household_ref}`} className="linkish">
            {h.household_ref}
          </Link>{" "}
          / {t("fm.crumb")}
        </div>
        <Link href={`/household/${h.household_ref}/brief`} className="btn sm">
          {t("fm.coach_link")}
        </Link>
      </div>

      {locale === "en" && (
        <p className="no-print small muted" data-testid="artefact-note" style={{ marginBottom: 12 }}>
          {t("common.family_note")}
        </p>
      )}

      {/* The household's own page keeps its Dutch paper look (§6.1 B1). The
          words follow the reader's language; RTL-free, no ids, no internal
          notes. `lang` is set on the block only in Dutch, because the content
          inside is translated when English is active. */}
      <div className="familyview" lang={locale === "nl" ? "nl" : undefined}>
        <h1>{t("fm.title")}</h1>
        <p className="intro">{view.intro_nl}</p>

        <h2 style={{ fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
          {t("fm.agreed")}
        </h2>
        {shared.map((a, i) => (
          <div className="appt" key={a.action_id}>
            <div className="what">
              <DossierText dutch={a.what_nl} locale={locale} />
            </div>
            <div className="meta">
              {view.appointments[i]?.when_nl ?? t("fm.nodate")}
            </div>
            <span className={`state ${a.status}`}>
              {a.status === "gedaan"
                ? t("fm.done")
                : a.status === "niet_gedaan"
                  ? t("fm.notdone")
                  : t("fm.ongoing")}
            </span>
          </div>
        ))}
        {shared.length === 0 && <p className="meta">{t("fm.empty")}</p>}

        {view.barriers_nl.length > 0 && (
          <>
            <h2
              style={{
                fontSize: 15,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--muted)",
                margin: "26px 0 4px",
              }}
            >
              {t("fm.noted")}
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 16.5 }}>
              {view.barriers_nl.map((b, i) => (
                <li key={i}>
                  <DossierText dutch={b} locale={locale} />
                </li>
              ))}
            </ul>
          </>
        )}

        <h2
          style={{
            fontSize: 15,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--muted)",
            margin: "26px 0 4px",
          }}
        >
          {t("fm.visits")}
        </h2>
        {view.visits_nl.map((v, i) => (
          <div className="appt" key={i}>
            <div className="meta" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
              {v.date_nl}
            </div>
            <div style={{ fontSize: 15.5, marginTop: 2 }}>{v.preview_nl}</div>
          </div>
        ))}

        <div style={{ marginTop: 26 }}>
          <FamilyCorrections
            displayNl={h.display_nl}
            actions={shared.map((a) => ({ id: a.action_id, what: a.what_nl }))}
            locale={locale}
          />
        </div>

        <p style={{ marginTop: 24, fontSize: 14.5, color: "var(--muted)" }}>{view.footer_nl}</p>
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          {t("fm.demo")}
        </p>
      </div>
    </main>
  );
}
