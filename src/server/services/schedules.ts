import "server-only";
import { findRestViolations } from "@/domain/scheduling/analysis";
import { daysBetween } from "@/domain/scheduling/dates";
import { generateShifts } from "@/domain/scheduling/generate";
import {
  localDate,
  localDayBounds,
  zonedDateTimeToUtc,
} from "@/domain/scheduling/zoned";
import { canManageScheduling } from "@/lib/roles";
import type {
  CreateScheduleData,
  GenerateScheduleData,
  SetScheduleCellData,
} from "@/lib/validation/schedules";
import type { Database } from "@/types/database";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { assertUuid } from "../params";
import { getMyOrganization, getMyRole } from "./organizations";
import { getRotationPattern } from "./rotation-patterns";
import { listShiftTypes } from "./shift-types";

export type ScheduleStatus = Database["public"]["Enums"]["schedule_status"];

export type ScheduleSummary = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  periodStart: string;
  periodEnd: string;
  status: ScheduleStatus;
};

export type ScheduleShift = {
  id: string;
  userId: string;
  shiftTypeId: string | null;
  startsAt: string;
  endsAt: string;
  /** Local date (org time zone) the shift starts on: its grid column. */
  date: string;
};

export type SchedulePerson = {
  userId: string;
  fullName: string;
  /** False for people covering from outside the team (or no longer members). */
  inTeam: boolean;
};

export type ScheduleDetail = {
  schedule: ScheduleSummary;
  people: SchedulePerson[];
  shifts: ScheduleShift[];
};

const SUMMARY_COLUMNS =
  "id, name, team_id, period_start, period_end, status, team:teams!inner(name)";

type SummaryRow = {
  id: string;
  name: string;
  team_id: string;
  period_start: string;
  period_end: string;
  status: ScheduleStatus;
  team: { name: string };
};

function toSummary(row: SummaryRow): ScheduleSummary {
  return {
    id: row.id,
    name: row.name,
    teamId: row.team_id,
    teamName: row.team.name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
  };
}

const OVERLAP_MESSAGE =
  "Conflito de horário: a pessoa já tem um plantão nesse período (talvez em outra escala).";

async function requireSchedulingManager(auth: AuthContext, orgId: string) {
  if (!canManageScheduling(await getMyRole(auth, orgId))) {
    throw new AppError(
      "FORBIDDEN",
      "Apenas administradores e gestores podem montar escalas.",
    );
  }
}

export async function listSchedules(
  auth: AuthContext,
  orgId: string,
): Promise<ScheduleSummary[]> {
  await getMyRole(auth, orgId);

  // RLS already hides drafts (and other teams' schedules) from members.
  const { data, error } = await auth.supabase
    .from("schedules")
    .select(SUMMARY_COLUMNS)
    .eq("org_id", orgId)
    .order("period_start", { ascending: false })
    .order("name");

  if (error) throw fromPostgrestError(error);
  return data.map(toSummary);
}

export async function getSchedule(
  auth: AuthContext,
  orgId: string,
  scheduleId: string,
): Promise<ScheduleSummary> {
  await getMyRole(auth, orgId);
  assertUuid(scheduleId, "Escala não encontrada.");

  const { data, error } = await auth.supabase
    .from("schedules")
    .select(SUMMARY_COLUMNS)
    .eq("id", scheduleId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Escala não encontrada.");
  return toSummary(data);
}

export async function createSchedule(
  auth: AuthContext,
  orgId: string,
  { teamId, name, periodStart, periodEnd }: CreateScheduleData,
): Promise<ScheduleSummary> {
  await requireSchedulingManager(auth, orgId);

  const { data, error } = await auth.supabase
    .from("schedules")
    .insert({
      org_id: orgId,
      team_id: teamId,
      name,
      period_start: periodStart,
      period_end: periodEnd,
    })
    .select(SUMMARY_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23P01") {
      throw new AppError(
        "CONFLICT",
        "Essa equipe já tem uma escala que se sobrepõe a esse período.",
      );
    }
    if (error.code === "23503") {
      throw new AppError("VALIDATION_ERROR", "Equipe inválida.");
    }
    throw fromPostgrestError(error);
  }
  return toSummary(data);
}

export async function renameSchedule(
  auth: AuthContext,
  orgId: string,
  scheduleId: string,
  name: string,
): Promise<ScheduleSummary> {
  await requireSchedulingManager(auth, orgId);
  assertUuid(scheduleId, "Escala não encontrada.");

  const { data, error } = await auth.supabase
    .from("schedules")
    .update({ name })
    .eq("id", scheduleId)
    .eq("org_id", orgId)
    .select(SUMMARY_COLUMNS)
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Escala não encontrada.");
  return toSummary(data);
}

export async function deleteSchedule(
  auth: AuthContext,
  orgId: string,
  scheduleId: string,
): Promise<void> {
  await requireSchedulingManager(auth, orgId);
  assertUuid(scheduleId, "Escala não encontrada.");

  const { data, error } = await auth.supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Escala não encontrada.");
}

/** Schedule + its shifts + the people to show as grid rows. */
export async function getScheduleDetail(
  auth: AuthContext,
  orgId: string,
  scheduleId: string,
): Promise<ScheduleDetail> {
  const [schedule, { organization }] = await Promise.all([
    getSchedule(auth, orgId, scheduleId),
    getMyOrganization(auth, orgId),
  ]);

  const [shiftsResult, teamResult] = await Promise.all([
    auth.supabase
      .from("shifts")
      .select("id, user_id, shift_type_id, starts_at, ends_at")
      .eq("schedule_id", scheduleId)
      .order("starts_at"),
    auth.supabase
      .from("team_members")
      .select(
        "user_id, membership:memberships!inner(profile:profiles!inner(full_name))",
      )
      .eq("team_id", schedule.teamId),
  ]);
  if (shiftsResult.error) throw fromPostgrestError(shiftsResult.error);
  if (teamResult.error) throw fromPostgrestError(teamResult.error);

  const shifts: ScheduleShift[] = shiftsResult.data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    shiftTypeId: row.shift_type_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    date: localDate(row.starts_at, organization.timezone),
  }));

  const people = new Map<string, SchedulePerson>();
  for (const row of teamResult.data) {
    people.set(row.user_id, {
      userId: row.user_id,
      fullName: row.membership.profile.full_name,
      inTeam: true,
    });
  }

  // People with shifts who aren't on the team (covering, or since removed).
  const outsiders = [...new Set(shifts.map((s) => s.userId))].filter(
    (id) => !people.has(id),
  );
  if (outsiders.length > 0) {
    const { data, error } = await auth.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", outsiders);
    if (error) throw fromPostgrestError(error);
    const names = new Map(data.map((p) => [p.id, p.full_name]));
    for (const id of outsiders) {
      people.set(id, {
        userId: id,
        fullName: names.get(id) ?? "Ex-membro",
        inTeam: false,
      });
    }
  }

  return {
    schedule,
    people: [...people.values()].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "pt-BR"),
    ),
    shifts,
  };
}

type ShiftInsert = {
  user_id: string;
  shift_type_id: string | null;
  starts_at: string;
  ends_at: string;
};

async function replaceShifts(
  auth: AuthContext,
  scheduleId: string,
  shifts: ShiftInsert[],
  deleteIds?: string[],
): Promise<number> {
  const { data, error } = await auth.supabase.rpc("replace_schedule_shifts", {
    p_schedule_id: scheduleId,
    p_shifts: shifts,
    ...(deleteIds ? { p_delete_ids: deleteIds } : {}),
  });
  if (error) {
    if (error.code === "23P01") throw new AppError("CONFLICT", OVERLAP_MESSAGE);
    if (error.code === "42501") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Só é possível escalar membros da organização.",
      );
    }
    throw fromPostgrestError(error);
  }
  return data;
}

/** Replaces every shift of the schedule with the pattern's expansion. */
export async function generateSchedule(
  auth: AuthContext,
  orgId: string,
  scheduleId: string,
  { patternId, assignments }: GenerateScheduleData,
): Promise<{ created: number }> {
  await requireSchedulingManager(auth, orgId);
  const [{ organization }, schedule, pattern, shiftTypes] = await Promise.all([
    getMyOrganization(auth, orgId),
    getSchedule(auth, orgId, scheduleId),
    getRotationPattern(auth, orgId, patternId),
    listShiftTypes(auth, orgId),
  ]);

  const byId = new Map(shiftTypes.map((st) => [st.id, st]));
  const generated = generateShifts({
    cycle: pattern.days.map((id) => (id ? (byId.get(id) ?? null) : null)),
    assignments,
    from: schedule.periodStart,
    to: schedule.periodEnd,
    timeZone: organization.timezone,
  });

  // The DB would reject these too; checking first gives a clearer message.
  if (findRestViolations(generated, 0).length > 0) {
    throw new AppError(
      "CONFLICT",
      "Esse regime gera plantões sobrepostos para a mesma pessoa.",
    );
  }

  const created = await replaceShifts(
    auth,
    scheduleId,
    generated.map((shift) => ({
      user_id: shift.userId,
      shift_type_id: shift.shiftTypeId,
      starts_at: shift.startsAt,
      ends_at: shift.endsAt,
    })),
  );
  return { created };
}

/** Sets (or clears) one person's shift on one day of the schedule. */
export async function setScheduleCell(
  auth: AuthContext,
  orgId: string,
  scheduleId: string,
  { userId, date, shiftTypeId }: SetScheduleCellData,
): Promise<void> {
  await requireSchedulingManager(auth, orgId);
  const [{ organization }, schedule] = await Promise.all([
    getMyOrganization(auth, orgId),
    getSchedule(auth, orgId, scheduleId),
  ]);

  if (
    daysBetween(schedule.periodStart, date) < 0 ||
    daysBetween(date, schedule.periodEnd) < 0
  ) {
    throw new AppError("VALIDATION_ERROR", "Data fora do período da escala.");
  }

  const timeZone = organization.timezone;
  const { start, end } = localDayBounds(date, timeZone);
  const { data: existing, error } = await auth.supabase
    .from("shifts")
    .select("id")
    .eq("schedule_id", scheduleId)
    .eq("user_id", userId)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString());
  if (error) throw fromPostgrestError(error);

  const inserts: ShiftInsert[] = [];
  if (shiftTypeId) {
    const shiftType = (await listShiftTypes(auth, orgId)).find(
      (st) => st.id === shiftTypeId,
    );
    if (!shiftType) {
      throw new AppError("VALIDATION_ERROR", "Tipo de turno inválido.");
    }
    const startsAt = zonedDateTimeToUtc(date, shiftType.startTime, timeZone);
    inserts.push({
      user_id: userId,
      shift_type_id: shiftType.id,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(
        startsAt.getTime() + shiftType.durationMinutes * 60_000,
      ).toISOString(),
    });
  }

  await replaceShifts(
    auth,
    scheduleId,
    inserts,
    existing.map((row) => row.id),
  );
}
