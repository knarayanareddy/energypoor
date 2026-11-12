"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DictKey } from "@/i18n/dict";

/** Labels are dictionary keys, resolved on the server and passed down. */
const LINKS: { href: string; key: DictKey; exact: boolean }[] = [
  { href: "/", key: "nav.caseload", exact: true },
  { href: "/capture", key: "nav.capture", exact: false },
  { href: "/swarm", key: "nav.swarm", exact: false },
  { href: "/survey", key: "nav.instrument", exact: false },
  { href: "/verify", key: "nav.audit", exact: false },
  { href: "/review", key: "nav.review", exact: false },
];

export function NavLinks({ labels, ariaLabel }: { labels: Record<DictKey, string>; ariaLabel: string }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label={ariaLabel}>
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {labels[l.key]}
          </Link>
        );
      })}
    </nav>
  );
}
