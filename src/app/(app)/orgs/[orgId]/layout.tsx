import Link from "next/link";
import { Suspense } from "react";
import { canManageScheduling, ROLE_LABELS } from "@/lib/roles";
import { countActionableSwaps } from "@/server/services/swaps";
import { loadOrg } from "./load-org";
import { OrgNav } from "./org-nav";

export default function OrganizationLayout({
  children,
  params,
}: LayoutProps<"/orgs/[orgId]">) {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<div className="h-24 print:hidden" />}>
        <OrganizationHeader params={params} />
      </Suspense>
      {children}
    </div>
  );
}

async function OrganizationHeader({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { auth, orgId, organization, role } = await loadOrg(params);
  const isManager = canManageScheduling(role);
  const pendingSwaps = await countActionableSwaps(auth, orgId, isManager);

  return (
    <div className="grid gap-4 print:hidden">
      <div className="grid gap-1">
        <Link
          href="/orgs"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Organizações
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {organization.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Você é {ROLE_LABELS[role].toLowerCase()} · {organization.slug}
        </p>
      </div>
      <OrgNav
        orgId={orgId}
        showReports={isManager}
        showAudit={role === "admin"}
        pendingSwaps={pendingSwaps}
      />
    </div>
  );
}
