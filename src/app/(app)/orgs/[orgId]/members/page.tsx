import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiActionButton } from "@/components/api-action-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  canInvite,
  canManageMembers,
  invitableRoles,
  ROLE_LABELS,
} from "@/lib/roles";
import { listPendingInvitations } from "@/server/services/invitations";
import { listMembers } from "@/server/services/members";
import { loadOrg } from "../load-org";
import { InviteForm } from "./invite-form";
import { MemberRoleSelect } from "./member-role-select";

export const metadata: Metadata = { title: "Membros · SCALA" };

export default function MembersPage({
  params,
}: PageProps<"/orgs/[orgId]/members">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <MembersSection params={params} />
    </Suspense>
  );
}

async function MembersSection({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { auth, orgId, organization, role } = await loadOrg(params);
  const isAdmin = canManageMembers(role);
  const mayInvite = canInvite(role);

  const [members, invitations] = await Promise.all([
    listMembers(auth, orgId),
    mayInvite ? listPendingInvitations(auth, orgId) : Promise.resolve([]),
  ]);

  const formatDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: organization.timezone,
  });
  const apiBase = `/api/v1/orgs/${orgId}`;

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Membros ({members.length})</h2>
        <ul className="divide-y rounded-lg border">
          {members.map((member) => {
            const isMe = member.userId === auth.user.id;
            return (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {member.fullName}
                    {isMe && (
                      <span className="text-muted-foreground"> (você)</span>
                    )}
                  </div>
                  {!isAdmin && (
                    <div className="text-sm text-muted-foreground">
                      {ROLE_LABELS[member.role]}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <MemberRoleSelect
                      orgId={orgId}
                      userId={member.userId}
                      role={member.role}
                      label={`Papel de ${member.fullName}`}
                    />
                  )}
                  {isMe ? (
                    <ApiActionButton
                      path={`${apiBase}/members/${member.userId}`}
                      confirmMessage={`Sair de ${organization.name}?`}
                      redirectTo="/orgs"
                    >
                      Sair
                    </ApiActionButton>
                  ) : (
                    isAdmin && (
                      <ApiActionButton
                        path={`${apiBase}/members/${member.userId}`}
                        confirmMessage={`Remover ${member.fullName} da organização?`}
                        variant="destructive"
                      >
                        Remover
                      </ApiActionButton>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {mayInvite && (
        <>
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Convidar pessoa</CardTitle>
              <CardDescription>
                Gera um link válido por 7 dias, que só funciona para o e-mail
                informado. Envie o link por onde preferir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteForm orgId={orgId} roles={invitableRoles(role)} />
            </CardContent>
          </Card>

          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Convites pendentes</h2>
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum convite pendente.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {invitation.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {ROLE_LABELS[invitation.role]} · expira em{" "}
                        {formatDate.format(new Date(invitation.expiresAt))}
                      </div>
                    </div>
                    {canInvite(role, invitation.role) && (
                      <ApiActionButton
                        path={`${apiBase}/invitations/${invitation.id}`}
                        confirmMessage={`Revogar o convite de ${invitation.email}?`}
                      >
                        Revogar
                      </ApiActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Perdeu o link? Convide o mesmo e-mail de novo: um link novo é
              gerado e o anterior deixa de valer.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
