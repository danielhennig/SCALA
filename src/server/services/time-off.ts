import "server-only";
import type { TimeOffRange } from "@/domain/scheduling/time-off";
import { localDate, localDayBounds } from "@/domain/scheduling/zoned";
import { canManageScheduling } from "@/lib/roles";
import type { TimeOffKind, TimeOffStatus } from "@/lib/time-off";
import type { CreateTimeOffData } from "@/lib/validation/time-off";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { assertUuid } from "../params";
import { getMyOrganization, getMyRole } from "./organizations";

export type TimeOff = {
  id: string;
  userId: string;
  fullName: string;
  kind: TimeOffKind;
  status: TimeOffStatus;
  startDate: string;
  endDate: string;
  reviewedAt: string | null;
};

// time_off has three FKs to profiles; name the one for the person on leave.
const COLUMNS =
  "id, user_id, kind, status, start_date, end_date, reviewed_at, profile:profiles!time_off_user_id_fkey(full_name)";

type Row = {
  id: string;
  user_id: string;
  kind: TimeOffKind;
  status: TimeOffStatus;
  start_date: string;
  end_date: string;
  reviewed_at: string | null;
  profile: { full_name: string } | null;
};

function toTimeOff(row: Row): TimeOff {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.profile?.full_name ?? "Ex-membro",
    kind: row.kind,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    reviewedAt: row.reviewed_at,
  };
}

const OVERLAP_MESSAGE =
  "Já existe um afastamento (pendente ou aprovado) dessa pessoa nesse período.";

/**
 * Entries overlapping [from, to] (local dates). RLS returns everything to
 * admins/managers and only the caller's own entries to members.
 */
export async function listTimeOff(
  auth: AuthContext,
  orgId: string,
  { from, to }: { from: string; to: string },
): Promise<TimeOff[]> {
  await getMyRole(auth, orgId);

  const { data, error } = await auth.supabase
    .from("time_off")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .lte("start_date", to)
    .gte("end_date", from)
    .order("start_date");

  if (error) throw fromPostgrestError(error);
  return data.map(toTimeOff);
}

/** Approved ranges overlapping a period: what blocks scheduling. */
export async function listApprovedTimeOff(
  auth: AuthContext,
  orgId: string,
  { from, to }: { from: string; to: string },
): Promise<(TimeOffRange & { kind: TimeOffKind })[]> {
  const { data, error } = await auth.supabase
    .from("time_off")
    .select("user_id, kind, start_date, end_date")
    .eq("org_id", orgId)
    .eq("status", "approved")
    .lte("start_date", to)
    .gte("end_date", from);

  if (error) throw fromPostgrestError(error);
  return data.map((row) => ({
    userId: row.user_id,
    kind: row.kind,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

/**
 * Managers register time off for any member (approved right away). Members
 * request it for themselves (pending until a manager reviews it).
 */
export async function createTimeOff(
  auth: AuthContext,
  orgId: string,
  { userId, kind, startDate, endDate }: CreateTimeOffData,
): Promise<TimeOff> {
  const isManager = canManageScheduling(await getMyRole(auth, orgId));
  const target = userId ?? auth.user.id;
  if (!isManager && target !== auth.user.id) {
    throw new AppError(
      "FORBIDDEN",
      "Você só pode pedir afastamento para si mesmo.",
    );
  }

  const { data, error } = await auth.supabase
    .from("time_off")
    .insert({
      org_id: orgId,
      user_id: target,
      kind,
      status: isManager ? "approved" : "pending",
      start_date: startDate,
      end_date: endDate,
    })
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === "23P01") throw new AppError("CONFLICT", OVERLAP_MESSAGE);
    if (error.code === "42501") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Essa pessoa não é membro da organização.",
      );
    }
    throw fromPostgrestError(error);
  }
  return toTimeOff(data);
}

/**
 * Approve or reject. Approving doesn't touch existing shifts; the count of
 * shifts that now fall on days off is returned so the UI can warn.
 */
export async function reviewTimeOff(
  auth: AuthContext,
  orgId: string,
  timeOffId: string,
  status: "approved" | "rejected",
): Promise<{ timeOff: TimeOff; conflictingShifts: number }> {
  const [role, { organization }] = await Promise.all([
    getMyRole(auth, orgId),
    getMyOrganization(auth, orgId),
  ]);
  if (!canManageScheduling(role)) {
    throw new AppError(
      "FORBIDDEN",
      "Apenas administradores e gestores podem aprovar afastamentos.",
    );
  }
  assertUuid(timeOffId, "Afastamento não encontrado.");

  const { data, error } = await auth.supabase
    .from("time_off")
    .update({ status })
    .eq("id", timeOffId)
    .eq("org_id", orgId)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === "23P01") throw new AppError("CONFLICT", OVERLAP_MESSAGE);
    throw fromPostgrestError(error);
  }
  if (!data) throw new AppError("NOT_FOUND", "Afastamento não encontrado.");
  const timeOff = toTimeOff(data);

  let conflictingShifts = 0;
  if (status === "approved") {
    const from = localDayBounds(timeOff.startDate, organization.timezone).start;
    const to = localDayBounds(timeOff.endDate, organization.timezone).end;
    const { count, error: countError } = await auth.supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("user_id", timeOff.userId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString());
    if (countError) throw fromPostgrestError(countError);
    conflictingShifts = count ?? 0;
  }
  return { timeOff, conflictingShifts };
}

/**
 * For each approved entry: how many existing shifts of that person start on
 * one of its days (e.g. time off approved after the schedule was built).
 * One query for all entries.
 */
export async function countTimeOffConflicts(
  auth: AuthContext,
  orgId: string,
  entries: readonly TimeOff[],
): Promise<Map<string, number>> {
  const approved = entries.filter((e) => e.status === "approved");
  const conflicts = new Map<string, number>();
  if (approved.length === 0) return conflicts;

  const { organization } = await getMyOrganization(auth, orgId);
  const timeZone = organization.timezone;
  const first = approved.reduce(
    (m, e) => (e.startDate < m ? e.startDate : m),
    approved[0].startDate,
  );
  const last = approved.reduce(
    (m, e) => (e.endDate > m ? e.endDate : m),
    approved[0].endDate,
  );

  const { data, error } = await auth.supabase
    .from("shifts")
    .select("user_id, starts_at")
    .eq("org_id", orgId)
    .in("user_id", [...new Set(approved.map((e) => e.userId))])
    .gte("starts_at", localDayBounds(first, timeZone).start.toISOString())
    .lt("starts_at", localDayBounds(last, timeZone).end.toISOString());
  if (error) throw fromPostgrestError(error);

  for (const entry of approved) {
    const count = data.filter((shift) => {
      if (shift.user_id !== entry.userId) return false;
      const date = localDate(shift.starts_at, timeZone);
      return entry.startDate <= date && date <= entry.endDate;
    }).length;
    if (count > 0) conflicts.set(entry.id, count);
  }
  return conflicts;
}

/** Managers delete any entry; members cancel their own pending requests. */
export async function deleteTimeOff(
  auth: AuthContext,
  orgId: string,
  timeOffId: string,
): Promise<void> {
  await getMyRole(auth, orgId);
  assertUuid(timeOffId, "Afastamento não encontrado.");

  const { data, error } = await auth.supabase
    .from("time_off")
    .delete()
    .eq("id", timeOffId)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) {
    throw new AppError(
      "NOT_FOUND",
      "Afastamento não encontrado (ou já aprovado: peça a um gestor).",
    );
  }
}
