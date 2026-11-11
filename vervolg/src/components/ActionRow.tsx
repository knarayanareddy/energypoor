import type { Action } from "@/domain/types";
import { formatDateNl } from "@/domain/brief";

const WHO_NL: Record<Action["who"], string> = {
  huishouden: "huishouden",
  coach: "coach",
  gemeente: "gemeente",
  corporatie: "corporatie",
  anders: "anders",
};

const STATE: Record<Action["status"], { class: string; label: string; glyph: string }> = {
  gedaan: { class: "done", label: "gedaan", glyph: "✓" },
  niet_gedaan: { class: "dropped", label: "NIET GEDAAN", glyph: "✗" },
  afgesproken: { class: "open", label: "afgesproken", glyph: "·" },
  onbekend: { class: "open", label: "onbekend", glyph: "·" },
};

export function ActionRow({ action, visitDate }: { action: Action; visitDate: string | null }) {
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
          <span style={{ fontSize: 14, fontWeight: 500 }}>{action.what_nl}</span>
        </span>
        <span className={`pill ${s.class}`}>{s.label}</span>
      </div>
      <div className="row wrap small muted" style={{ gap: 10, marginTop: 5 }}>
        <span>
          wie: <span className="mono">{WHO_NL[action.who]}</span>
        </span>
        <span>
          wanneer: <span className="mono">{action.by_when ? formatDateNl(action.by_when) : "geen datum"}</span>
        </span>
        <span>
          afgesproken: <span className="mono">{visitDate ? formatDateNl(visitDate) : action.set_at_visit}</span>
        </span>
        <span className="mono" style={{ fontSize: 10.5, opacity: 0.7 }}>
          {action.action_id}
        </span>
      </div>
      {action.status === "niet_gedaan" && action.evidence && (
        <div className="small" style={{ marginTop: 6, color: "var(--warm)" }}>
          → &ldquo;{action.evidence}&rdquo;
        </div>
      )}
      {action.status === "gedaan" && action.evidence && (
        <div className="small muted" style={{ marginTop: 6 }}>
          → {action.evidence}
        </div>
      )}
    </div>
  );
}
