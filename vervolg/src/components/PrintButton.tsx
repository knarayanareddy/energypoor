"use client";

import { t, type Locale } from "@/i18n/dict";

export function PrintButton({ locale = "nl" }: { locale?: Locale }) {
  return (
    <button type="button" className="btn sm primary" onClick={() => window.print()}>
      {t(locale, "common.print")}
    </button>
  );
}
