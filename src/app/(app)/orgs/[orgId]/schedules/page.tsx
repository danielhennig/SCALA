import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays } from "@/domain/scheduling/dates";
import { localDate } from "@/domain/scheduling/zoned";
import { formatShortDate } from "@/lib/format";
import { canManageScheduling } from "@/lib/roles";
import { listSchedules } from "@/server/services/schedules";
import { listTeams } from "@/server/services/teams";
import { loadOrg } from "../load-org";
import { CreateScheduleForm } from "./create-schedule-form";
import { ScheduleStatusBadge } from "./schedule-status-badge";

export const metadata: Metadata = { title: "Escalas · SCALA" };

export default function SchedulesPage({
  params,
}: PageProps<"/orgs/[orgId]/schedules">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <SchedulesSection params={params} />
    </Suspense>
  );
}

async function SchedulesSection({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { auth, orgId, organization, role } = await loadOrg(params);
  const canManage = canManageScheduling(role);
  const [schedules, teams] = await Promise.all([
    listSchedules(auth, orgId),
    canManage ? listTeams(auth, orgId) : Promise.resolve([]),
  ]);

  // Suggest next month, in the organization's time zone.
  const today = localDate(new Date(), organization.timezone);
  const nextMonth = addDays(`${today.slice(0, 7)}-01`, 32).slice(0, 7);

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Escalas</h2>
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Nenhuma escala ainda. Crie a primeira abaixo."
              : "Nenhuma escala publicada para as suas equipes ainda."}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <Link
                  href={`/orgs/${orgId}/schedules/${schedule.id}`}
                  className="grid gap-1 rounded-lg border p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{schedule.name}</span>
                    <ScheduleStatusBadge status={schedule.status} />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {schedule.teamName} ·{" "}
                    {formatShortDate(schedule.periodStart)} a{" "}
                    {formatShortDate(schedule.periodEnd)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Nova escala</CardTitle>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Crie uma{" "}
                <Link href={`/orgs/${orgId}/teams`} className="underline">
                  equipe
                </Link>{" "}
                antes de montar uma escala.
              </p>
            ) : (
              <CreateScheduleForm
                orgId={orgId}
                teams={teams.map(({ id, name }) => ({ id, name }))}
                defaultMonth={nextMonth}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
