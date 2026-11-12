import type { Action } from "@/domain/types";
import { formatDateNl } from "@/domain/brief";
import { t as tr, type DictKey, type Locale } from "@/i18n/dict";

const WHO_KEY: Record<Action["who"], DictKey> = {
  huishouden: "hh.who.household",
  coach: "hh.who.coach",
  gemeente: "hh.who.municipality",
  corporatie: "hh.who.corp",
  anders: "hh.who.other",
};

const STATE: Record<Action["status"], { class: string; label: DictKey; glyph: string }> = {
  gedaan: { class: "done", label: "hh.state.done", glyph: "✓" },
  niet_gedaan: { class: "dropped", label: "hh.state.dropped", glyph: "✗" },
  afgesproken: { class: "open", label: "hh.state.open", glyph: "·" },
  onbekend: { class: "open", label: "hh.state.unknown", glyph: "·" },
};

export function ActionRow({
  action,
  visitDate,
  locale,
}: {
  action: Action;
  visitDate: string | null;
  locale: Locale;
}) {
  const t = (k: DictKey, v?: Record<string, string | number>) => tr(locale, k, v);
  const s = STATE[action.status];
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderLeft: `3px solid ${
          action.status === "niet_gedaan"
            ? "var(--warm)"
            : action.status === "gedaan"
              ? "var(--calm)"
              : "var(--line)"
        }`,
        borderRadius: 5,
        padding: "9px 12px",
        background: "#fffdf8",
      }}
    >
      <div className="row between wrap" style={{ gap: 8, alignItems: "baseline" }}>
        <span className="row" style={{ gap: 8, minWidth: 0 }}>
          <span
            className="mono"
            aria-hidden="true"
            style={{
              color:
                action.status === "niet_gedaan" ? "var(--warm)" : action.status === "gedaan" ? "var(--calm)" : "var(--muted)",
              fontSize: 13,
            }}
          >
            {s.glyph}
          </span>
          <span style={{ fontSize: 14, fontWeight: 500 }} lang="nl">
            {action.what_nl}
          </span>
        </span>
        <span className={`pill ${s.class}`}>{t(s.label)}</span>
      </div>
      <div className="row wrap small muted" style={{ gap: 10, marginTop: 5 }}>
        <span>
          {t("hh.action.who")} <span className="mono">{t(WHO_KEY[action.who])}</span>
        </span>
        <span>
          {t("hh.action.when")}{" "}
          <span className="mono">{action.by_when ? formatDateNl(action.by_when) : t("hh.action.no_date")}</span>
        </span>
        <span>
          {t("hh.action.set")}{" "}
          <span className="mono">{visitDate ? formatDateNl(visitDate) : action.set_at_visit}</span>
        </span>
        <span className="mono" style={{ fontSize: 10.5, opacity: 0.7 }}>
          {action.action_id}
        </span>
      </div>
      {action.status === "niet_gedaan" && action.evidence && (
        <div className="small" style={{ marginTop: 6, color: "var(--warm)" }} lang="nl">
          → &ldquo;{action.evidence}&rdquo;
        </div>
      )}
      {action.status === "gedaan" && action.evidence && (
        <div className="small muted" style={{ marginTop: 6 }} lang="nl">
          → {action.evidence}
        </div>
      )}
    </div>
  );
}
