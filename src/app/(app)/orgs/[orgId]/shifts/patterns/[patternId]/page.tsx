import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { canManageScheduling } from "@/lib/roles";
import { AppError } from "@/server/errors";
import { getRotationPattern } from "@/server/services/rotation-patterns";
import { listShiftTypes } from "@/server/services/shift-types";
import { loadOrg } from "../../../load-org";
import { RotationPatternEditor } from "../rotation-pattern-editor";

export const metadata: Metadata = { title: "Editar regime · SCALA" };

export default function EditPatternPage({
  params,
}: PageProps<"/orgs/[orgId]/shifts/patterns/[patternId]">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <EditPattern params={params} />
    </Suspense>
  );
}

async function EditPattern({
  params,
}: {
  params: Promise<{ orgId: string; patternId: string }>;
}) {
  const { patternId } = await params;
  const { auth, orgId, organization, role } = await loadOrg(params);

  let pattern;
  try {
    pattern = await getRotationPattern(auth, orgId, patternId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

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
          Apenas administradores e gestores podem editar regimes.
        </p>
      </div>
    );
  }

  const shiftTypes = await listShiftTypes(auth, orgId);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        {backLink}
        <h2 className="text-xl font-semibold">Editar regime</h2>
      </div>
      <RotationPatternEditor
        orgId={orgId}
        shiftTypes={shiftTypes}
        minRestHours={organization.minRestHours}
        initial={pattern}
      />
    </div>
  );
}
