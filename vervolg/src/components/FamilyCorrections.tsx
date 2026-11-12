"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { t as tr, type DictKey, type Locale } from "@/i18n/dict";
import { DossierText } from "@/components/DutchContent";

/**
 * W11 — the household can see and correct its own file. "dit klopt niet"
 * appends a Correction to the hash chain; the read model changes on reload and
 * the audit log grows by exactly one row.
 */
export function FamilyCorrections({
  displayNl,
  actions,
  locale,
}: {
  displayNl: string;
  actions: { id: string; what: string }[];
  locale: Locale;
}) {
  const t = (k: DictKey, v?: Record<string, string | number>) => tr(locale, k, v);
  const [open, setOpen] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [field, setField] = useState<"what_nl" | "by_when">("what_nl");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function submit(actionId: string) {
    setResult(null);
    const res = await fetch("/api/correct", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: "action",
        target_id: actionId,
        field,
        to: value,
        by: "huishouden",
        reason_nl: reason || null,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; seq?: number; hash?: string; error?: string; code?: string };
    if (!res.ok) {
      setResult({ ok: false, message: `${json.code ?? "fout"} — ${json.error ?? "mislukt"}` });
      return;
    }
    setResult({
      ok: true,
      message: t("fc.thanks", { seq: json.seq ?? "?" }),
    });
    setOpen(null);
    setValue("");
    setReason("");
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderTop: "1px solid #e7ded0",
          paddingTop: 16,
        }}
      >
        <h2 style={{ fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6d6659" }}>
          {t("fc.title")}
        </h2>
        <span className="small" style={{ color: "var(--muted)" }}>
          {t("fc.actions", { n: actions.length })}
        </span>
      </div>
      <p style={{ fontSize: 15, color: "#4b463c", marginTop: 4 }}>
        {t("fc.lede")}
      </p>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {actions.map((a) => (
          <div key={a.id} style={{ borderTop: "1px solid #eee6d8", paddingTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              {/* The label is translated; `a.what` itself is not, because
                  `setValue(a.what)` below seeds the editor that writes the
                  correction back to the case file. Showing English in the
                  label and saving Dutch in the value is the only combination
                  that does not corrupt the dossier. */}
              <span style={{ fontSize: 16 }}>
                <DossierText dutch={a.what} locale={locale} />
              </span>
              <button
                type="button"
                className="fix"
                onClick={() => {
                  setOpen(open === a.id ? null : a.id);
                  setValue(a.what);
                  setField("what_nl");
                  setResult(null);
                }}
              >
                {open === a.id ? t("fc.cancel") : t("fc.dispute")}
              </button>
            </div>

            {open === a.id && (
              <div style={{ marginTop: 8, display: "grid", gap: 8, background: "#fdfaf3", padding: 12, borderRadius: 8 }}>
                <label className="lbl" style={{ color: "#6d6659" }}>
                  {t("fc.what")}
                </label>
                <input className="field" value={value} onChange={(e) => setValue(e.target.value)} />
                <label className="lbl" style={{ color: "#6d6659" }}>
                  {t("fc.why")}
                </label>
                <input
                  className="field"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("fc.why.placeholder")}
                />
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="lbl" style={{ color: "#6d6659" }}>
                    {t("fc.field")}
                  </legend>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className={`chip ${field === "what_nl" ? "active" : ""}`}
                      onClick={() => setField("what_nl")}
                      aria-pressed={field === "what_nl"}
                    >
                      {t("fc.field.what")}
                    </button>
                    <button
                      type="button"
                      className={`chip ${field === "by_when" ? "active" : ""}`}
                      onClick={() => setField("by_when")}
                      aria-pressed={field === "by_when"}
                    >
                      {t("fc.field.date")}
                    </button>
                  </div>
                </fieldset>
                <button
                  type="button"
                  className="btn primary"
                  disabled={pending || value.trim().length === 0}
                  onClick={() => submit(a.id)}
                >
                  {t("fc.send")}
                </button>
                <span className="small" style={{ color: "var(--muted)" }}>
                  {t("fc.note")}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {result && (
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: result.ok ? "#2f6b5e" : "#8f3309",
          }}
          role="status"
        >
          {result.message}
        </p>
      )}
      <p className="small" style={{ color: "var(--muted)", marginTop: 8 }}>
        {t("fm.corrections_note", { name: displayNl })}
      </p>
    </div>
  );
}
