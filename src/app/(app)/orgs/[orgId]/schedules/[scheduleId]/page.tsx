import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiActionButton } from "@/components/api-action-button";
import { eachDate } from "@/domain/scheduling/dates";
import { formatShortDate } from "@/lib/format";
import { canManageScheduling } from "@/lib/roles";
import { AppError } from "@/server/errors";
import { listRotationPatterns } from "@/server/services/rotation-patterns";
import { getScheduleDetail } from "@/server/services/schedules";
import { listShiftTypes } from "@/server/services/shift-types";
import { loadOrg } from "../../load-org";
import { ScheduleStatusBadge } from "../schedule-status-badge";
import { GeneratePanel } from "./generate-panel";
import { ScheduleGrid } from "./schedule-grid";

export const metadata: Metadata = { title: "Escala · SCALA" };

export default function SchedulePage({
  params,
}: PageProps<"/orgs/[orgId]/schedules/[scheduleId]">) {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}
    >
      <ScheduleSection params={params} />
    </Suspense>
  );
}

async function ScheduleSection({
  params,
}: {
  params: Promise<{ orgId: string; scheduleId: string }>;
}) {
  const { scheduleId } = await params;
  const { auth, orgId, organization, role } = await loadOrg(params);
  const canManage = canManageScheduling(role);

  let detail;
  try {
    detail = await getScheduleDetail(auth, orgId, scheduleId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { schedule, people, shifts } = detail;

  const [shiftTypes, patterns] = await Promise.all([
    listShiftTypes(auth, orgId),
    canManage ? listRotationPatterns(auth, orgId) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <Link
            href={`/orgs/${orgId}/schedules`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Escalas
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{schedule.name}</h2>
            <ScheduleStatusBadge status={schedule.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {schedule.teamName} · {formatShortDate(schedule.periodStart)} a{" "}
            {formatShortDate(schedule.periodEnd)} · {shifts.length} plantões
          </p>
        </div>
        {canManage && (
          <ApiActionButton
            path={`/api/v1/orgs/${orgId}/schedules/${schedule.id}`}
            confirmMessage={`Excluir a escala ${schedule.name} e todos os seus plantões?`}
            redirectTo={`/orgs/${orgId}/schedules`}
            variant="destructive"
          >
            Excluir escala
          </ApiActionButton>
        )}
      </div>

      {canManage && (
        <GeneratePanel
          orgId={orgId}
          scheduleId={schedule.id}
          patterns={patterns}
          shiftTypes={shiftTypes}
          people={people.filter((p) => p.inTeam)}
          hasShifts={shifts.length > 0}
        />
      )}

      <ScheduleGrid
        orgId={orgId}
        scheduleId={schedule.id}
        dates={eachDate(schedule.periodStart, schedule.periodEnd)}
        people={people}
        shifts={shifts}
        shiftTypes={shiftTypes}
        canEdit={canManage}
        minRestHours={organization.minRestHours}
        timeZone={organization.timezone}
      />
    </div>
  );
}
