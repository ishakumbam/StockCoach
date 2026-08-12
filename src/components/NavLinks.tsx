"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Portfolio" },
  { href: "/learn", label: "Learn" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 rounded-full border border-line bg-surface/70 p-1 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/stock") : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-4 py-1.5 transition ${
              active
                ? "bg-accent/20 font-medium text-accent-soft"
                : "text-muted hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
