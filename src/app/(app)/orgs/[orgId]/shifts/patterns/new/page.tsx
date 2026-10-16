import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { canManageScheduling } from "@/lib/roles";
import { listShiftTypes } from "@/server/services/shift-types";
import { loadOrg } from "../../../load-org";
import { RotationPatternEditor } from "../rotation-pattern-editor";

export const metadata: Metadata = { title: "Novo regime · SCALA" };

export default function NewPatternPage({
  params,
}: PageProps<"/orgs/[orgId]/shifts/patterns/new">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <NewPattern params={params} />
    </Suspense>
  );
}

async function NewPattern({ params }: { params: Promise<{ orgId: string }> }) {
  const { auth, orgId, organization, role } = await loadOrg(params);
  const backLink = (
    <Link
      href={`/orgs/${orgId}/shifts`}
      className="text-sm text-muted-foreground hover:underline"
    >
      ← Turnos e regimes
    </Link>
  );

  if (!canManageScheduling(role)) {
    return (
      <div className="grid gap-2">
        {backLink}
        <p className="text-sm">
          Apenas administradores e gestores podem criar regimes.
        </p>
      </div>
    );
  }

  const shiftTypes = await listShiftTypes(auth, orgId);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        {backLink}
        <h2 className="text-xl font-semibold">Novo regime</h2>
      </div>
      {shiftTypes.length === 0 ? (
        <p className="text-sm">
          Crie um tipo de turno antes de montar um regime.
        </p>
      ) : (
        <RotationPatternEditor
          orgId={orgId}
          shiftTypes={shiftTypes}
          minRestHours={organization.minRestHours}
        />
      )}
    </div>
  );
}
