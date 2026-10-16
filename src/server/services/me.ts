import "server-only";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";

export type MyShift = {
  id: string;
  startsAt: string;
  endsAt: string;
  shiftTypeName: string | null;
  color: string | null;
  orgId: string;
  orgName: string;
  /** Times are shown in the organization's own time zone. */
  timeZone: string;
  teamName: string;
  scheduleId: string;
  scheduleName: string;
};

const MAX_RANGE_DAYS = 93;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The caller's shifts in published schedules, across every organization,
 * starting in [from, to). Drafts are excluded even for admins/managers: this
 * is "my schedule", not the editing view.
 */
export async function listMyShifts(
  { supabase, user }: AuthContext,
  { from, to }: { from: Date; to: Date },
): Promise<MyShift[]> {
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    to <= from
  ) {
    throw new AppError("VALIDATION_ERROR", "Intervalo de datas inválido.");
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw new AppError(
      "VALIDATION_ERROR",
      `O intervalo pode ter no máximo ${MAX_RANGE_DAYS} dias.`,
    );
  }

  const { data, error } = await supabase
    .from("shifts")
    .select(
      "id, starts_at, ends_at, shift_type:shift_types(name, color), schedule:schedules!inner(id, name, status, team:teams!inner(name), organization:organizations!inner(id, name, timezone))",
    )
    .eq("user_id", user.id)
    .eq("schedule.status", "published")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");

  if (error) throw fromPostgrestError(error);
  return data.map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    shiftTypeName: row.shift_type?.name ?? null,
    color: row.shift_type?.color ?? null,
    orgId: row.schedule.organization.id,
    orgName: row.schedule.organization.name,
    timeZone: row.schedule.organization.timezone,
    teamName: row.schedule.team.name,
    scheduleId: row.schedule.id,
    scheduleName: row.schedule.name,
  }));
}
