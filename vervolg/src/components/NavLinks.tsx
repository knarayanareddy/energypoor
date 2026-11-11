"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Caseload", exact: true },
  { href: "/capture", label: "Vastleggen", exact: false },
  { href: "/swarm", label: "Swarm Lab", exact: false },
  { href: "/survey", label: "Instrument", exact: false },
  { href: "/verify", label: "Audit", exact: false },
  { href: "/review", label: "Review", exact: false },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Hoofdnavigatie">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
