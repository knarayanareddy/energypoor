import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";

export const metadata: Metadata = {
  title: "Vervolg — De afspraak die niemand onthoudt",
  description:
    "Vervolg turns a spoken visit note into a structured case update and gives the coach one page before the next visit. Demo — synthetic households.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F3EA",
};

const HONESTY = "Demo — synthetic households. No real person's data is in this build.";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/" className="wordmark" aria-label="Vervolg — naar de caseload">
              Vervol<span>g</span>
              <i aria-hidden="true" />
            </Link>
            <NavLinks />
            <div style={{ marginLeft: "auto" }} className="row">
              <span className="pill synth" title="Synthetic population, no real people">
                SYNTHETISCH
              </span>
            </div>
          </header>
          {children}
          <footer className="site">
            <span>{HONESTY}</span>
            <span className="row" style={{ gap: 14 }}>
              <span className="mono" style={{ fontSize: 11 }}>
                Vervolg · v0.1 · geen LLM in de simulatie
              </span>
              <Link href="/review" className="linkish">
                Review
              </Link>
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
