import type { Metadata } from "next";
import { Suspense } from "react";
import { loadOrg } from "./load-org";

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
  const { organization } = await loadOrg(params);

  return (
    <div className="grid gap-6">
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Fuso horário</dt>
        <dd>{organization.timezone}</dd>
        <dt className="text-muted-foreground">Descanso mínimo</dt>
        <dd>{organization.minRestHours} h entre plantões</dd>
      </dl>

      <p className="text-sm text-muted-foreground">
        A montagem das escalas chega na próxima etapa.
      </p>
    </div>
  );
}
