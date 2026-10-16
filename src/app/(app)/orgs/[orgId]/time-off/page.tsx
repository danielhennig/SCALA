import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ApiActionButton } from "@/components/api-action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays } from "@/domain/scheduling/dates";
import { localDate } from "@/domain/scheduling/zoned";
import { formatDateRange } from "@/lib/format";
import { canManageScheduling } from "@/lib/roles";
import { TIME_OFF_KIND_LABELS } from "@/lib/time-off";
import { listMembers } from "@/server/services/members";
import {
  countTimeOffConflicts,
  listTimeOff,
  type TimeOff,
} from "@/server/services/time-off";
import { loadOrg } from "../load-org";
import { ReviewButtons } from "./review-buttons";
import { TimeOffForm } from "./time-off-form";
import { TimeOffStatusBadge } from "./time-off-status-badge";

export const metadata: Metadata = { title: "Afastamentos · SCALA" };

export default function TimeOffPage({
  params,
}: PageProps<"/orgs/[orgId]/time-off">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <TimeOffSection params={params} />
    </Suspense>
  );
}

async function TimeOffSection({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { auth, orgId, organization, role } = await loadOrg(params);
  const isManager = canManageScheduling(role);
  const today = localDate(new Date(), organization.timezone);

  const [entries, members] = await Promise.all([
    listTimeOff(auth, orgId, {
      from: addDays(today, -60),
      to: addDays(today, 366),
    }),
    isManager ? listMembers(auth, orgId) : Promise.resolve([]),
  ]);
  const conflicts = await countTimeOffConflicts(auth, orgId, entries);
  const pending = isManager
    ? entries.filter((e) => e.status === "pending")
    : [];
  const listed = isManager
    ? entries.filter((e) => e.status !== "pending")
    : entries;
  const apiBase = `/api/v1/orgs/${orgId}/time-off`;

  return (
    <div className="grid gap-8">
      {pending.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">
            Pedidos pendentes ({pending.length})
          </h2>
          <ul className="divide-y rounded-lg border">
            {pending.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <EntryText entry={entry} showName />
                <ReviewButtons path={`${apiBase}/${entry.id}`} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">
            {isManager ? "Afastamentos" : "Seus afastamentos"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? "Dias de afastamento aprovado não recebem plantões: o gerador pula esses dias e a grade bloqueia."
              : "Peça férias ou licença abaixo; um gestor aprova. Só você e os gestores veem seus afastamentos."}
          </p>
        </div>
        {listed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum afastamento.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {listed.map((entry) => {
              const conflictCount = conflicts.get(entry.id) ?? 0;
              const isOwnPending =
                entry.userId === auth.user.id && entry.status === "pending";
              return (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="grid gap-1">
                    <EntryText entry={entry} showName={isManager} />
                    {isManager && conflictCount > 0 && (
                      <p className="text-sm text-destructive">
                        {conflictCount}{" "}
                        {conflictCount === 1 ? "plantão cai" : "plantões caem"}{" "}
                        neste afastamento.{" "}
                        <Link
                          href={`/orgs/${orgId}/schedules`}
                          className="underline"
                        >
                          Ajuste a escala
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <TimeOffStatusBadge status={entry.status} />
                    {(isManager || isOwnPending) && (
                      <ApiActionButton
                        path={`${apiBase}/${entry.id}`}
                        confirmMessage={
                          isOwnPending && !isManager
                            ? "Cancelar este pedido?"
                            : `Excluir o afastamento de ${entry.fullName}?`
                        }
                      >
                        {isOwnPending && !isManager ? "Cancelar" : "Excluir"}
                      </ApiActionButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>
            {isManager ? "Registrar afastamento" : "Pedir afastamento"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimeOffForm
            orgId={orgId}
            members={
              isManager
                ? members.map(({ userId, fullName }) => ({ userId, fullName }))
                : null
            }
            defaultDate={today}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function EntryText({ entry, showName }: { entry: TimeOff; showName: boolean }) {
  return (
    <div className="min-w-0">
      <div className="font-medium">
        {showName
          ? `${entry.fullName} · ${TIME_OFF_KIND_LABELS[entry.kind]}`
          : TIME_OFF_KIND_LABELS[entry.kind]}
      </div>
      <div className="text-sm text-muted-foreground">
        {formatDateRange(entry.startDate, entry.endDate)}
      </div>
    </div>
  );
}
