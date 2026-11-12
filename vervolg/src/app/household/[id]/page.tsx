import Link from "next/link";
import { notFound } from "next/navigation";
import type { Household } from "@/domain/types";
import { correctionsFor, findHousehold } from "@/server/store";
import { buildBrief, formatDate, formatDateLong, monthsAgo, restrictedFieldNames, STALE_DAYS } from "@/domain/brief";
import { ActionRow } from "@/components/ActionRow";
import { RestrictedMarker } from "@/components/RestrictedMarker";
import { getI18n } from "@/i18n/server";
import type { DictKey } from "@/i18n/dict";
import { DossierText, Nl } from "@/components/DutchContent";

export const dynamic = "force-dynamic";

const TENURE_KEY = { "huur-corporatie": "tenure.corp", "huur-prive": "tenure.private", koop: "tenure.own" } as const;

/**
 * A correction names a field, and a field name is interface: `by_when` is a
 * database column, not Dutch. Known fields get a translation; an unknown one is
 * shown verbatim rather than hidden, because a correction you cannot read is
 * worse than one with a technical name.
 */
const FIELD_KEYS: Record<string, DictKey> = { by_when: "corr.by_when", target: "corr.field", status: "corr.field" };


export default async function HouseholdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getI18n(await searchParams);
  const fieldLabel = (field: string) => (FIELD_KEYS[field] ? t(FIELD_KEYS[field]) : field);
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
                {t("hh.crumb")}
              </Link>{" "}
              / {h.household_ref}
            </div>
            <h1 style={{ marginTop: 4 }}>
              <Nl locale={locale}>{h.display_nl}</Nl>
            </h1>
            <div className="row wrap small muted" style={{ marginTop: 6, gap: 10 }}>
              <DossierText dutch={h.composition_nl} locale={locale} />
              <span>·</span>
              <span>{t(TENURE_KEY[h.tenure])}</span>
              <span>·</span>
              <span className="mono">
                {t("label.field")} {h.label}
              </span>
              <span>·</span>
              <span>{h.programme}</span>
            </div>
          </div>
          <div className="row wrap">
            <Link href={`/household/${h.household_ref}/brief`} className="btn primary">
              {t("hh.prep")}
            </Link>
            <Link href={`/household/${h.household_ref}/family`} className="btn">
              {t("hh.family_cta")}
            </Link>
          </div>
        </div>

        {locale === "en" && (
          <p className="small muted" data-testid="artefact-note" style={{ marginTop: -4 }}>
            {t("common.dossier_note")}
          </p>
        )}

        {brief.stale_days > STALE_DAYS && (
          <div className="note-box" style={{ borderLeftColor: "var(--warm)" }}>
            <strong className="stale">
              {t("hh.stale", {
                ago: monthsAgo(brief.stale_days, locale),
                date: formatDate(h.last_visit, locale),
              })}
            </strong>{" "}
            <span className="muted small">
              {t("hh.stale.note", { days: STALE_DAYS })}
            </span>
          </div>
        )}

        <div className="grid g3">
          <div className="tile calm">
            <div className="k">{t("hh.done")}</div>
            <div className="v">{shared.filter((a) => a.status === "gedaan").length}</div>
            <div className="s">{t("hh.done.sub")}</div>
          </div>
          <div className="tile warm">
            <div className="k">{t("hh.dropped")}</div>
            <div className="v">{shared.filter((a) => a.status === "niet_gedaan").length}</div>
            <div className="s">{t("hh.dropped.sub")}</div>
          </div>
          <div className="tile">
            <div className="k">{t("hh.open")}</div>
            <div className="v">{shared.filter((a) => a.status === "afgesproken").length}</div>
            <div className="s">
              {t("hh.open.sub", { n: shared.filter((a) => a.status === "afgesproken" && !a.by_when).length })}
            </div>
          </div>
        </div>

        <div className="grid split-3-2">
          <div className="card">
            <div className="card-head">
              <h2>{t("hh.actions.head")}</h2>
              <span className="pill mono">{t("hh.shared", { n: shared.length })}</span>
            </div>
            <div className="card-pad stack tight">
              {shared.map((a) => (
                <ActionRow
                  key={a.action_id}
                  action={a}
                  visitDate={byVisit.get(a.set_at_visit)?.date ?? null}
                  locale={locale}
                />
              ))}
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <div className="card-head">
                <h2>{t("hh.restricted.head")}</h2>
                <span className="pill restricted">{fields.length}</span>
              </div>
              <div className="card-pad stack tight small">
                {fields.length === 0 && <p className="muted">{t("hh.restricted.none")}</p>}
                {fields.map((f) => (
                  <div key={f} className="row between">
                    <span className="mono">{f}</span>
                    <RestrictedMarker locale={locale} />
                  </div>
                ))}
                <p className="muted" style={{ marginTop: 8 }}>
                  {t("hh.restricted.note")}
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>{t("hh.barriers.head")}</h2>
              </div>
              <div className="card-pad stack tight">
                {h.barriers.map((b) => (
                  <div key={b.barrier_id} className="row between" style={{ gap: 8, alignItems: "flex-start" }}>
                    <span style={{ minWidth: 0 }}>
                      <span className="pill mono" style={{ marginRight: 6 }}>
                        {t(`barrier.${b.kind}` as DictKey)}
                      </span>
                      <span className={b.restricted ? "muted" : ""} style={{ fontSize: 13 }}>
                        <DossierText dutch={b.note_nl} locale={locale} />
                      </span>
                    </span>
                    {b.restricted && <RestrictedMarker locale={locale} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>{t("hh.corrections.head")}</h2>
                <span className="pill mono">{corrections.length}</span>
              </div>
              <div className="card-pad stack tight small">
                {corrections.length === 0 && <p className="muted">{t("hh.corrections.none")}</p>}
                {corrections.map((c) => (
                  <div key={c.correction_id}>
                    <div className="mono" style={{ fontSize: 11 }}>
                      {c.correction_id} · {t(c.by === "coach" ? "hh.who.coach" : "hh.who.household")} ·{" "}
                      {formatDate(c.at, locale)}
                    </div>
                    <div>
                      {t(`corr.${c.target}` as DictKey)} <span className="mono">{c.target_id}</span> →{" "}
                      <strong>{fieldLabel(c.field)}</strong>:{" "}
                      <span className="muted">{c.from ? formatDate(c.from, locale) : "—"}</span> →{" "}
                      <span>{c.to ? formatDate(c.to, locale) : "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>{t("hh.timeline.head")}</h2>
            <span className="pill mono">{t("hh.visits", { n: h.visits.length })}</span>
          </div>
          <div className="card-pad">
            <ul className="tl">
              {[...h.visits].reverse().map((v, i) => (
                <li key={v.visit_id} className={i === 0 ? "now" : ""}>
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <span className="date">
                      {formatDateLong(v.date, locale)} · {v.coach_ref} · <span className="mono">{v.visit_id}</span>
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="pill mono">{t("hh.visit.actions", { n: v.actions_added.length })}</span>
                      {v.restricted_count > 0 && (
                        <span className="pill restricted">
                          {t("hh.visit.restricted", { n: v.restricted_count })}
                        </span>
                      )}
                    </span>
                  </div>
                  <p style={{ marginTop: 6, fontSize: 13.5 }}>
                    <DossierText dutch={v.transcript} locale={locale} />
                  </p>
                  {v.corrections.length > 0 && (
                    <div className="small" style={{ marginTop: 6, color: "var(--warm)" }}>
                      {t("hh.visit.corrections", { n: v.corrections.length })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="row between wrap small muted">
          <span>
            {t("hh.foot")}
          </span>
          <span className="mono">{t("hh.foot.noscores")}</span>
        </div>
      </div>
    </main>
  );
}

void ((_: Household) => _);
