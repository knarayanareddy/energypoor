import Link from "next/link";
import type { Action, CaseRow, Household } from "@/domain/types";
import { daysBetween, formatDate, todayIso } from "@/domain/brief";
import { CaseTable } from "@/components/CaseTable";
import { getI18n } from "@/i18n/server";
import type { DictKey } from "@/i18n/dict";
import { ARCH, DIMENSIONS, N_AGENTS } from "@/domain/swarm/archetypes";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { locale, t } = await getI18n(await searchParams);
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
              {t("home.eyebrow")}
            </div>
            <h1 style={{ marginTop: 4 }}>{t("home.title")}</h1>
            <p className="muted" style={{ marginTop: 6, maxWidth: "62ch" }}>
              {t("home.lede", { n: rows.length })}
            </p>
          </div>
          <div className="row wrap">
            <Link href="/capture" className="btn primary">
              {t("home.cta.capture")}
            </Link>
            <Link href="/swarm" className="btn">
              {t("home.cta.swarm")}
            </Link>
          </div>
        </div>

        <div className="grid g3">
          <div className="tile">
            <div className="k">{t("home.tile.households")}</div>
            <div className="v">{rows.length}</div>
            <div className="s">{t("home.tile.households.sub", { n: rows.length })}</div>
          </div>
          <div className="tile">
            <div className="k">{t("home.tile.actions")}</div>
            <div className="v">
              {done.length}
              <span className="muted" style={{ fontSize: 14 }}>
                {" "}
                {" "}
                / {total} {t("home.tile.done_label")}
              </span>
            </div>
            <div className="s">
              {t("home.tile.actions.sub", { done: done.length, open: open.length, dropped: dropped.length, pct: pct(dropped.length) })}
            </div>
          </div>
          <div className="tile warm">
            <div className="k">{t("home.tile.coverage")}</div>
            <div className="v">{coverage}%</div>
            <div className="s">
              {t("home.tile.coverage.sub", { covered: covered.length, eligible: eligible.length, missed: eligible.length - covered.length })}
            </div>
          </div>
        </div>

        <div className="grid split-2-1">
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-head">
              <h2>{t("home.queue.title")}</h2>
              <span className="pill mono">{t("home.queue.rows", { n: rows.length })}</span>
            </div>
            <CaseTable
              rows={rows}
              labels={{
                lang: locale,
                sortStale: t("home.queue.sort.stale"),
                sortOpen: t("home.queue.sort.open"),
                sortNever: t("home.queue.sort.never"),
                sortGroupAria: t("home.queue.sort.group"),
                sortNote: t("home.queue.sort.note"),
                dossier: t("col.dossier"),
                hood: t("col.hood"),
                label: t("col.label"),
                days: t("col.days"),
                open: t("col.open"),
                dropped: t("col.dropped"),
                restricted: t("col.restricted"),
                foot: t("home.queue.foot"),
                rowTitle: t("home.queue.row_title"),
              }}
            />
          </div>

          <div className="stack">
            <div className="card">
              <div className="card-head">
                <h2>{t("home.aside.lie")}</h2>
              </div>
              <div className="card-pad stack tight">
                {stale.map(({ h, days }) => (
                  <Link key={h.household_ref} href={`/household/${h.household_ref}`} className="row between" style={{ gap: 10 }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13 }} lang={locale === "nl" ? undefined : "nl"}>
                        {h.display_nl}
                      </span>
                      <span className="mono small muted">{h.household_ref}</span>
                    </span>
                    <span className={`pill ${days > 270 ? "dropped" : ""} mono`}>{days}d</span>
                  </Link>
                ))}
                <p className="small muted" style={{ marginTop: 6 }}>
                  {t("home.aside.lie.foot")}
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>{t("home.aside.not")}</h2>
              </div>
              <div className="card-pad small" style={{ lineHeight: 1.65 }}>
                <p>{t("home.aside.not.1")}</p>
                <p style={{ marginTop: 6 }}>{t("home.aside.not.2")}</p>
                <p style={{ marginTop: 6 }}>{t("home.aside.not.3")}</p>
                <p style={{ marginTop: 6 }} className="muted">
                  {t("home.aside.not.4", { n: restricted })}
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>{t("home.aside.swarm")}</h2>
              </div>
              <div className="card-pad small stack tight">
                <p className="muted">
                  {t("home.aside.swarm.body")}
                </p>
                <div className="row wrap" style={{ gap: 4 }}>
                  {/* The nine archetype labels are fixture data (§11.3) and stay
                      Dutch; the wrapper is marked so this is visible, not implied. */}
                  {Object.values(ARCH).map((a) => (
                    <span key={a.key} className="pill mono" title={a.who_nl} lang="nl">
                      {a.label_nl} {a.n}
                    </span>
                  ))}
                </div>
                <p className="mono small" style={{ color: "var(--muted)" }}>
                  {t("home.dims", { n: DIMENSIONS.length })}
                </p>
                <Link href="/swarm" className="btn sm">
                  {t("home.open_lab")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>{t("home.cases.title")}</h2>
            <span className="pill mono">{t("home.cases.visits")}</span>
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
                  <div style={{ fontWeight: 500, marginTop: 4 }} lang={locale === "nl" ? undefined : "nl"}>
                    {h.display_nl}
                  </div>
                  <div className="small muted" lang={locale === "nl" ? undefined : "nl"}>
                    {h.composition_nl}
                  </div>
                  <div className="row wrap" style={{ gap: 4, marginTop: 10 }}>
                    <span className="pill done">{t("home.cases.done", { n: h.actions.filter((a) => a.status === "gedaan").length })}</span>
                    <span className="pill">{t("home.cases.open", { n: o.length })}</span>
                    {d.length > 0 && <span className="pill dropped">{t("home.cases.dropped", { n: d.length })}</span>}
                  </div>
                  <div className="small muted" style={{ marginTop: 8 }}>
                    {t("home.cases.last", { date: formatDate(h.last_visit, locale) })}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    <Link href={`/household/${h.household_ref}`} className="btn sm">
                      {t("home.cases.dossier")}
                    </Link>
                    <Link href={`/household/${h.household_ref}/brief`} className="btn sm">
                      {t("home.cases.brief")}
                    </Link>
                    <Link href={`/household/${h.household_ref}/family`} className="btn sm ghost">
                      {t("home.cases.household")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid g2">
          <div className="card card-pad">
            <h2>{t("home.why.title")}</h2>
            <p style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.62 }}>
              {t("home.why.p1a")} <strong>550.000</strong> {t("home.why.p1b")}{" "}
              <strong>{t("home.why.p1c")}</strong>
            </p>
            <p style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.62 }}>
              {t("home.why.p2a")} <strong>{t("home.why.p2strong")}</strong>
              {t("home.why.p2b")}
            </p>
            <p className="small muted" style={{ marginTop: 10 }}>
              {t("home.why.foot")}{" "}
              <Link href="/review" className="linkish">
                {t("home.why.link")}
              </Link>{" "}
              {t("home.why.foot2")}
            </p>
          </div>
          <div className="card card-pad">
            <h2>{t("home.stages.title")}</h2>
            <ol className="small" style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
              {([
                ["INPUT", "home.stages.1"],
                ["MODEL", "home.stages.2"],
                ["GATE", "home.stages.3"],
                ["home.stage.human", "home.stages.4"],
                ["home.stage.storage", "home.stages.5"],
                ["OUTPUT", "home.stages.6"],
                ["home.stage.human", "home.stages.7"],
              ] as [DictKey | string, DictKey][]).map(([name, key]) => (
                <li key={key}>
                  {/* The stage names are UI, not data: MENS/OPSLAG are the Dutch
                      words and read as untranslated leftovers on an English
                      page, which is exactly how they were found. */}
                  <strong>{name.includes(".") ? t(name as DictKey) : name}</strong> {t(key)}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}

void ((_: Action) => _);
