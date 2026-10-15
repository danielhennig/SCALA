import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ROLE_LABELS } from "@/lib/roles";
import { requireUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { getMyOrganization } from "@/server/services/organizations";

export const metadata: Metadata = { title: "Organização · SCALA" };

export default function OrganizationPage({
  params,
}: PageProps<"/orgs/[orgId]">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <OrganizationOverview params={params} />
    </Suspense>
  );
}

async function OrganizationOverview({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const auth = await requireUser();

  let result;
  try {
    result = await getMyOrganization(auth, orgId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { organization, role } = result;

  return (
    <div className="grid gap-6">
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
          {ROLE_LABELS[role]} · {organization.slug}
        </p>
      </div>

      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Fuso horário</dt>
        <dd>{organization.timezone}</dd>
        <dt className="text-muted-foreground">Descanso mínimo</dt>
        <dd>{organization.minRestHours} h entre plantões</dd>
      </dl>

      <p className="text-sm text-muted-foreground">
        Equipes, membros e escalas chegam nas próximas etapas.
      </p>
    </div>
  );
}
