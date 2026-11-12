import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { LocaleToggle } from "@/components/LocaleToggle";
import { getI18n } from "@/i18n/server";
import { DICTS, parseLocale, LOCALE_COOKIE } from "@/i18n/dict";
import { cookies } from "next/headers";

/**
 * The tab title is UI, not artefact, so it follows the language. Metadata is
 * static at module scope in Next, hence the cookie read here rather than in the
 * layout body — the same cookie the layout itself uses.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const labels = DICTS[locale];
  return { title: `${labels["brand.name"]} — ${labels["brand.tagline"]}`, description: labels["meta.description"] };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F3EA",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t, other } = await getI18n();
  const labels = DICTS[locale];

  return (
    <html lang={locale}>
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/" className="wordmark" aria-label={`Vervolg — ${labels["nav.caseload"]}`}>
              Vervol<span>g</span>
              <i aria-hidden="true" />
            </Link>
            <NavLinks labels={labels} ariaLabel={locale === "nl" ? "Hoofdnavigatie" : "Main navigation"} />
            <div style={{ marginLeft: "auto" }} className="row">
              <LocaleToggle current={locale} label={t("lang.toggle")} otherLabel={labels[`lang.to_${other}`]} />
              <span className="pill synth" title={t("common.synthetic")}>
                {t("honesty.synth_chip")}
              </span>
            </div>
          </header>
          {children}
          <footer className="site">
            <span>{t("honesty.demo")}</span>
            <span className="row" style={{ gap: 14 }}>
              <span className="mono" style={{ fontSize: 11 }}>
                {t("foot.version")}
              </span>
              <Link href="/review" className="linkish">
                {labels["nav.review"]}
              </Link>
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
