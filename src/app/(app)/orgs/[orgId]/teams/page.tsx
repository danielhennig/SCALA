import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canManageTeams } from "@/lib/roles";
import { listTeams } from "@/server/services/teams";
import { loadOrg } from "../load-org";
import { CreateTeamForm } from "./create-team-form";

export const metadata: Metadata = { title: "Equipes · SCALA" };

export default function TeamsPage({
  params,
}: PageProps<"/orgs/[orgId]/teams">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <TeamsSection params={params} />
    </Suspense>
  );
}

async function TeamsSection({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { auth, orgId, role } = await loadOrg(params);
  const teams = await listTeams(auth, orgId);

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Equipes ({teams.length})</h2>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma equipe ainda. Equipes agrupam quem trabalha junto (ex.: UTI
            Adulto, 2º Pelotão) e são a base das escalas.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`/orgs/${orgId}/teams/${team.id}`}
                  className="block rounded-lg border p-4 transition-colors hover:bg-muted"
                >
                  <div className="font-medium">{team.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {team.memberCount}{" "}
                    {team.memberCount === 1 ? "pessoa" : "pessoas"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManageTeams(role) && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Nova equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateTeamForm orgId={orgId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
