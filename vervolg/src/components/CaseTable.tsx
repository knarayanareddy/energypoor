"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseRow, SortKey } from "@/domain/types";
const SORT_KEYS: { key: SortKey }[] = [
  { key: "staleness" },
  { key: "open_actions" },
  { key: "never_followed_up" },
];

/**
 * §7.4 — the sort control must say, next to the chosen key:
 * "Sorteert op het dossier, niet op de persoon."
 */
export interface CaseTableLabels {
  sortStale: string;
  sortOpen: string;
  sortNever: string;
  sortGroupAria: string;
  sortNote: string;
  dossier: string;
  hood: string;
  label: string;
  days: string;
  open: string;
  dropped: string;
  restricted: string;
  foot: string;
  rowTitle: string;
}

/** Labels arrive already resolved. A `t` function cannot cross the
 *  server→client boundary (Next refuses to serialise a function), and passing
 *  the dictionary object would ship 250 strings of every other screen's copy to
 *  the browser for a table with eight column headers. So the server sends the
 *  fourteen strings this table actually prints. */
export function CaseTable({ rows, labels }: { rows: CaseRow[]; labels: CaseTableLabels }) {
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
        <div className="seg" role="group" aria-label={labels.sortGroupAria}>
          {SORT_KEYS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={sort === s.key}
              onClick={() => setSort(s.key)}
              data-testid={`sort-${s.key}`}
            >
              {s.key === "staleness" ? labels.sortStale : s.key === "open_actions" ? labels.sortOpen : labels.sortNever}
            </button>
          ))}
        </div>
        <span className="small muted" data-testid="sort-disclaimer">
          {labels.sortNote}
        </span>
      </div>

      <div style={{ maxHeight: 460, overflow: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>{labels.dossier}</th>
              <th>{labels.hood}</th>
              <th className="num">{labels.label}</th>
              <th className="num">{labels.days}</th>
              <th className="num">{labels.open}</th>
              <th className="num">{labels.dropped}</th>
              <th>{labels.restricted}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.ref}
                data-clickable={hasHistory(r)}
                onClick={() => hasHistory(r) && router.push(`/household/${r.ref}`)}
                title={labels.rowTitle}
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
                    <span className="pill restricted">{labels.restricted.toLowerCase()}</span>
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
        {labels.foot}
      </div>
    </div>
  );
}
