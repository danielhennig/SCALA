import "server-only";
import { addDays, daysBetween } from "@/domain/scheduling/dates";
import { summarizeHours } from "@/domain/scheduling/hours";
import { localDayBounds } from "@/domain/scheduling/zoned";
import { toCsv } from "@/lib/csv";
import { canManageScheduling } from "@/lib/roles";
import type { HoursReportQuery } from "@/lib/validation/reports";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { listMembers } from "./members";
import { getMyOrganization, getMyRole } from "./organizations";
import { getTeam } from "./teams";
import { listApprovedTimeOff } from "./time-off";

export type HoursReportRow = {
  userId: string;
  fullName: string;
  shifts: number;
  totalMinutes: number;
  nightMinutes: number;
  weekendMinutes: number;
  /** Days of approved time off inside the period. */
  timeOffDays: number;
};

export type HoursReport = {
  from: string;
  to: string;
  teamId: string | null;
  timeZone: string;
  /** Length of the period, for weekly averages. */
  days: number;
  rows: HoursReportRow[];
};

// PostgREST caps responses (max_rows = 1000), so long periods are paged.
const PAGE_SIZE = 1000;

type ShiftRow = { user_id: string; starts_at: string; ends_at: string };

/**
 * Hours per person over [from, to] (local dates, organization time zone).
 * Only published schedules count, and each shift belongs to the day it
 * starts on, like the schedule grid. Admins and managers only.
 */
export async function getHoursReport(
  auth: AuthContext,
  orgId: string,
  { from, to, teamId }: HoursReportQuery,
): Promise<HoursReport> {
  if (!canManageScheduling(await getMyRole(auth, orgId))) {
    throw new AppError(
      "FORBIDDEN",
      "Apenas administradores e gestores veem o relatório de horas.",
    );
  }
  const [{ organization }, people, team] = await Promise.all([
    getMyOrganization(auth, orgId),
    listMembers(auth, orgId),
    teamId ? getTeam(auth, orgId, teamId) : Promise.resolve(null),
  ]);
  const timeZone = organization.timezone;
  const start = localDayBounds(from, timeZone).start.toISOString();
  const end = localDayBounds(to, timeZone).end.toISOString();

  const shifts: ShiftRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = auth.supabase
      .from("shifts")
      .select(
        "user_id, starts_at, ends_at, schedule:schedules!inner(status, team_id)",
      )
      .eq("org_id", orgId)
      .eq("schedule.status", "published")
      .gte("starts_at", start)
      .lt("starts_at", end);
    if (teamId) query = query.eq("schedule.team_id", teamId);
    const { data, error } = await query
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw fromPostgrestError(error);
    shifts.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  const summary = summarizeHours(
    shifts.map((s) => ({
      userId: s.user_id,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
    })),
    timeZone,
  );

  // Rows: the team (or every member), plus anyone else with shifts, e.g.
  // someone covering from another team or who has left the organization.
  const names = new Map(
    (team?.members ?? people).map((p) => [p.userId, p.fullName]),
  );
  const others = [...summary.keys()].filter((id) => !names.has(id));
  if (others.length > 0) {
    const { data, error } = await auth.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", others);
    if (error) throw fromPostgrestError(error);
    const found = new Map(data.map((p) => [p.id, p.full_name]));
    for (const id of others) names.set(id, found.get(id) ?? "Ex-membro");
  }

  const timeOffDays = new Map<string, number>();
  for (const range of await listApprovedTimeOff(auth, orgId, { from, to })) {
    // Clip to the period; ISO dates compare as strings.
    const first = range.startDate > from ? range.startDate : from;
    const last = range.endDate < to ? range.endDate : to;
    timeOffDays.set(
      range.userId,
      (timeOffDays.get(range.userId) ?? 0) + daysBetween(first, last) + 1,
    );
  }

  return {
    from,
    to,
    teamId: teamId ?? null,
    timeZone,
    days: daysBetween(from, addDays(to, 1)),
    rows: [...names]
      .map(([userId, fullName]) => ({
        userId,
        fullName,
        shifts: summary.get(userId)?.shifts ?? 0,
        totalMinutes: summary.get(userId)?.totalMinutes ?? 0,
        nightMinutes: summary.get(userId)?.nightMinutes ?? 0,
        weekendMinutes: summary.get(userId)?.weekendMinutes ?? 0,
        timeOffDays: timeOffDays.get(userId) ?? 0,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR")),
  };
}

const hours = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const toHours = (minutes: number) => hours.format(minutes / 60);

/** Average per week over the period (a 31-day month is 4.43 weeks). */
export function weeklyAverageMinutes(row: HoursReportRow, days: number) {
  return Math.round((row.totalMinutes / days) * 7);
}

/** The report as CSV, hours as decimals so spreadsheets can sum them. */
export function hoursReportCsv(report: HoursReport): {
  filename: string;
  csv: string;
} {
  return {
    filename: `horas-${report.from}-a-${report.to}.csv`,
    csv: toCsv([
      [
        "Pessoa",
        "Plantões",
        "Horas",
        "Horas noturnas (22h-5h)",
        "Horas em fim de semana",
        "Dias de afastamento",
        "Média semanal (h)",
      ],
      ...report.rows.map((row) => [
        row.fullName,
        String(row.shifts),
        toHours(row.totalMinutes),
        toHours(row.nightMinutes),
        toHours(row.weekendMinutes),
        String(row.timeOffDays),
        toHours(weeklyAverageMinutes(row, report.days)),
      ]),
    ]),
  };
}
