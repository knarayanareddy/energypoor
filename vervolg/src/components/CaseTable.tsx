"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseRow, SortKey } from "@/domain/types";

const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: "staleness", label: "Langst niet gezien" },
  { key: "open_actions", label: "Openstaande afspraken" },
  { key: "never_followed_up", label: "Nooit nagevolgd" },
];

/**
 * §7.4 — the sort control must say, next to the chosen key:
 * "Sorteert op het dossier, niet op de persoon."
 */
export function CaseTable({ rows }: { rows: CaseRow[] }) {
  const [sort, setSort] = useState<SortKey>("staleness");
  const router = useRouter();

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sort === "staleness") return b.days_since_contact - a.days_since_contact;
      if (sort === "open_actions") return b.open_actions - a.open_actions;
      return b.never_followed_up - a.never_followed_up;
    });
    return copy;
  }, [rows, sort]);

  const hasHistory = (r: CaseRow) => ["HH-014", "HH-027", "HH-041"].includes(r.ref);

  return (
    <div>
      <div
        className="row between wrap"
        style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", gap: 10 }}
      >
        <div className="seg" role="group" aria-label="Sorteersleutel">
          {SORT_LABELS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={sort === s.key}
              onClick={() => setSort(s.key)}
              data-testid={`sort-${s.key}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="small muted" data-testid="sort-disclaimer">
          Sorteert op het dossier, niet op de persoon.
        </span>
      </div>

      <div style={{ maxHeight: 460, overflow: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Dossier</th>
              <th>Wijk</th>
              <th className="num">Label</th>
              <th className="num">Dagen</th>
              <th className="num">Open</th>
              <th className="num">Vervallen</th>
              <th>Beperkt</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.ref}
                data-clickable={hasHistory(r)}
                onClick={() => hasHistory(r) && router.push(`/household/${r.ref}`)}
                title={hasHistory(r) ? "Open dossier" : "Synthetische rij zonder historie"}
              >
                <td>
                  <div style={{ fontWeight: hasHistory(r) ? 500 : 400 }}>
                    {hasHistory(r) ? (
                      <span className="linkish">{r.display_nl}</span>
                    ) : (
                      r.display_nl
                    )}
                  </div>
                  <div className="mono small muted">{r.ref}</div>
                </td>
                <td className="small">{r.hood}</td>
                <td className="num mono">{r.label}</td>
                <td className="num mono" style={r.days_since_contact > 270 ? { color: "var(--warm)" } : undefined}>
                  {r.days_since_contact}
                </td>
                <td className="num mono">{r.open_actions}</td>
                <td className="num mono">{r.dropped_actions}</td>
                <td>
                  {r.restricted_present ? (
                    <span className="pill restricted">beperkt</span>
                  ) : (
                    <span className="small muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small muted" style={{ padding: "8px 14px", borderTop: "1px solid var(--line)" }}>
        Elke kolom is een feit over het dossier. Er is geen kolom met een oordeel.
      </div>
    </div>
  );
}
