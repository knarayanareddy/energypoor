"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AuditRow, ChainVerification } from "@/domain/types";

export function AuditPanel({ initial, rows }: { initial: ChainVerification; rows: AuditRow[] }) {
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
        <h2>Controleur</h2>
        <span className={`pill ${v.brokenAt === null ? "done" : "dropped"}`}>
          {v.brokenAt === null ? "keten intact" : `gebroken bij rij ${v.brokenAt}`}
        </span>
      </div>
      <div className="card-pad stack">
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn sm warm" onClick={() => op("tamper")} disabled={busy || pending}>
            Wijzig rij 7 in het bestand
          </button>
          <button type="button" className="btn sm" onClick={() => op("reset")} disabled={busy || pending}>
            Herstel uit backup
          </button>
          <span className="small muted">
            Dit zijn dezelfde bytes die <span className="mono">scripts/verify-chain.ts</span> leest.
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
          {typeof v.bad === "number" && v.bad > 0 && <span style={{ color: "var(--warm)" }}>ongeldige regels={v.bad}</span>}
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
          Rij 7 is bewust een <span className="mono">brief.generated</span>-gebeurtenis: de minst alarmeerde regel in
          het bestand, en daarom de leerzaamste om mee te knoeien.
        </p>
      </div>
    </div>
  );
}
