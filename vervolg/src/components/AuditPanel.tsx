"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AuditRow, ChainVerification } from "@/domain/types";
import { t as tr, type DictKey, type Locale } from "@/i18n/dict";

export function AuditPanel({
  initial,
  rows,
  locale,
}: {
  initial: ChainVerification;
  rows: AuditRow[];
  locale: Locale;
}) {
  const t = (k: DictKey, v?: Record<string, string | number>) => tr(locale, k, v);
  const [v, setV] = useState<ChainVerification & { bad?: number }>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function op(op: "tamper" | "reset") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op, seq: 7 }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        verification?: ChainVerification & { bad?: number };
        error?: string;
      };
      if (!res.ok) {
        setMsg(json.error ?? "mislukt");
        return;
      }
      if (json.verification) setV(json.verification);
      setMsg(json.message ?? null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>{t("ver.checker")}</h2>
        <span className={`pill ${v.brokenAt === null ? "done" : "dropped"}`}>
          {v.brokenAt === null ? t("ver.chain_ok") : t("ver.broken_at_row", { n: v.brokenAt })}
        </span>
      </div>
      <div className="card-pad stack">
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn sm warm" onClick={() => op("tamper")} disabled={busy || pending}>
            {t("ver.tamper")}
          </button>
          <button type="button" className="btn sm" onClick={() => op("reset")} disabled={busy || pending}>
            {t("ver.reset")}
          </button>
          <span className="small muted">
            {t("ver.same_bytes")}
          </span>
        </div>

        {msg && (
          <div className={`err`} style={v.brokenAt === null ? { borderLeftColor: "var(--calm)" } : undefined}>
            <span className="code">{v.brokenAt === null ? "OK" : `brokenAt ${v.brokenAt}`}</span>
            <div>{msg}</div>
          </div>
        )}

        <div className="row wrap small mono muted" style={{ gap: 14 }}>
          <span>total={v.total}</span>
          <span>verified={v.verified}</span>
          <span>brokenAt={v.brokenAt === null ? "null" : v.brokenAt}</span>
          {typeof v.bad === "number" && v.bad > 0 && <span style={{ color: "var(--warm)" }}>{t("ver.invalid_rows", { n: v.bad })}</span>}
        </div>

        <div className="scroll-x" style={{ maxHeight: 420, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 6 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="num">seq</th>
                <th>ts</th>
                <th>actor</th>
                <th>action</th>
                <th>subject</th>
                <th>hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.seq} className={v.brokenAt === r.seq ? "selected" : undefined}>
                  <td className="num mono">{r.seq}</td>
                  <td className="mono small">{r.ts.slice(0, 19).replace("T", " ")}</td>
                  <td className="mono small">{r.actor}</td>
                  <td className="mono small">{r.action}</td>
                  <td className="mono small">{r.subject}</td>
                  <td className="mono small" title={r.hash}>
                    {r.hash.slice(0, 10)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          {t("ver.colophon")}
        </p>
      </div>
    </div>
  );
}
