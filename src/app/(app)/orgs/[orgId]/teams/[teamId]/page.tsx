import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiActionButton } from "@/components/api-action-button";
import { canManageTeams } from "@/lib/roles";
import { AppError } from "@/server/errors";
import { listMembers } from "@/server/services/members";
import { getTeam } from "@/server/services/teams";
import { loadOrg } from "../../load-org";
import { AddTeamMemberForm } from "./add-team-member-form";

export const metadata: Metadata = { title: "Equipe · SCALA" };

export default function TeamPage({
  params,
}: PageProps<"/orgs/[orgId]/teams/[teamId]">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <TeamSection params={params} />
    </Suspense>
  );
}

async function TeamSection({
  params,
}: {
  params: Promise<{ orgId: string; teamId: string }>;
}) {
  const { teamId } = await params;
  const { auth, orgId, role } = await loadOrg(params);
  const canManage = canManageTeams(role);

  let team;
  try {
    team = await getTeam(auth, orgId, teamId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const inTeam = new Set(team.members.map((member) => member.userId));
  const candidates = canManage
    ? (await listMembers(auth, orgId)).filter((m) => !inTeam.has(m.userId))
    : [];
  const apiBase = `/api/v1/orgs/${orgId}/teams/${team.id}`;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <Link
            href={`/orgs/${orgId}/teams`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Equipes
          </Link>
          <h2 className="text-xl font-semibold">{team.name}</h2>
        </div>
        {canManage && (
          <ApiActionButton
            path={apiBase}
            confirmMessage={`Excluir a equipe ${team.name}? As pessoas continuam na organização.`}
            redirectTo={`/orgs/${orgId}/teams`}
            variant="destructive"
          >
            Excluir equipe
          </ApiActionButton>
        )}
      </div>

      <section className="grid gap-3">
        <h3 className="font-medium">Integrantes ({team.members.length})</h3>
        {team.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma pessoa nesta equipe ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {team.members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 p-3"
              >
                <span className="truncate">{member.fullName}</span>
                {canManage && (
                  <ApiActionButton
                    path={`${apiBase}/members/${member.userId}`}
                    confirmMessage={`Tirar ${member.fullName} da equipe?`}
                  >
                    Remover
                  </ApiActionButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <section className="grid max-w-lg gap-3">
          <h3 className="font-medium">Adicionar à equipe</h3>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todos os membros da organização já estão nesta equipe. Convide
              mais pessoas em{" "}
              <Link href={`/orgs/${orgId}/members`} className="underline">
                Membros
              </Link>
              .
            </p>
          ) : (
            <AddTeamMemberForm
              path={`${apiBase}/members`}
              candidates={candidates.map(({ userId, fullName }) => ({
                userId,
                fullName,
              }))}
            />
          )}
        </section>
      )}
    </div>
  );
}
