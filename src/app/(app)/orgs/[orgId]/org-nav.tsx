"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export function OrgNav({
  orgId,
  showAudit,
  pendingSwaps,
}: {
  orgId: string;
  /** Admin-only tab; the page and RLS enforce it too. */
  showAudit: boolean;
  /** Swap requests waiting on the viewer (badge on the tab). */
  pendingSwaps: number;
}) {
  const pathname = usePathname();
  const base = `/orgs/${orgId}`;
  const tabs = [
    { href: base, label: "Visão geral", exact: true },
    { href: `${base}/schedules`, label: "Escalas" },
    { href: `${base}/swaps`, label: "Trocas", badge: pendingSwaps },
    { href: `${base}/time-off`, label: "Afastamentos" },
    { href: `${base}/members`, label: "Membros" },
    { href: `${base}/teams`, label: "Equipes" },
    { href: `${base}/shifts`, label: "Turnos e regimes" },
    ...(showAudit ? [{ href: `${base}/audit`, label: "Auditoria" }] : []),
  ];

  return (
    <nav
      aria-label="Seções da organização"
      className="flex gap-1 overflow-x-auto border-b"
    >
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span
                className="rounded-full bg-foreground px-1.5 text-xs font-medium text-background"
                aria-label={`${tab.badge} pendente${tab.badge > 1 ? "s" : ""}`}
              >
                {tab.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
