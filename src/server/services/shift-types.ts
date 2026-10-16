import "server-only";
import { canManageScheduling } from "@/lib/roles";
import type { ShiftTypeData } from "@/lib/validation/scheduling";
import type { Database } from "@/types/database";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { assertUuid } from "../params";
import { getMyRole } from "./organizations";

type ShiftTypeRow = Pick<
  Database["public"]["Tables"]["shift_types"]["Row"],
  "id" | "name" | "start_time" | "duration_minutes" | "color"
>;

export type ShiftType = {
  id: string;
  name: string;
  /** "HH:MM" in the organization's timezone. */
  startTime: string;
  durationMinutes: number;
  color: string;
};

const COLUMNS = "id, name, start_time, duration_minutes, color";

function toShiftType(row: ShiftTypeRow): ShiftType {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time.slice(0, 5), // Postgres returns HH:MM:SS
    durationMinutes: row.duration_minutes,
    color: row.color,
  };
}

function toRow(data: ShiftTypeData) {
  return {
    name: data.name,
    start_time: data.startTime,
    duration_minutes: data.durationMinutes,
    color: data.color,
  };
}

async function requireSchedulingManager(auth: AuthContext, orgId: string) {
  if (!canManageScheduling(await getMyRole(auth, orgId))) {
    throw new AppError(
      "FORBIDDEN",
      "Apenas administradores e gestores podem configurar turnos.",
    );
  }
}

const duplicateName = () =>
  new AppError("CONFLICT", "Já existe um tipo de turno com esse nome.");

export async function listShiftTypes(
  auth: AuthContext,
  orgId: string,
): Promise<ShiftType[]> {
  await getMyRole(auth, orgId);

  const { data, error } = await auth.supabase
    .from("shift_types")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .order("start_time")
    .order("name");

  if (error) throw fromPostgrestError(error);
  return data.map(toShiftType);
}

export async function createShiftType(
  auth: AuthContext,
  orgId: string,
  data: ShiftTypeData,
): Promise<ShiftType> {
  await requireSchedulingManager(auth, orgId);

  const { data: row, error } = await auth.supabase
    .from("shift_types")
    .insert({ org_id: orgId, ...toRow(data) })
    .select(COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw duplicateName();
    throw fromPostgrestError(error);
  }
  return toShiftType(row);
}

/**
 * Editing a shift type does not change shifts already generated from it:
 * schedules store concrete start/end timestamps.
 */
export async function updateShiftType(
  auth: AuthContext,
  orgId: string,
  shiftTypeId: string,
  data: ShiftTypeData,
): Promise<ShiftType> {
  await requireSchedulingManager(auth, orgId);
  assertUuid(shiftTypeId, "Tipo de turno não encontrado.");

  const { data: row, error } = await auth.supabase
    .from("shift_types")
    .update(toRow(data))
    .eq("id", shiftTypeId)
    .eq("org_id", orgId)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") throw duplicateName();
    throw fromPostgrestError(error);
  }
  if (!row) throw new AppError("NOT_FOUND", "Tipo de turno não encontrado.");
  return toShiftType(row);
}

export async function deleteShiftType(
  auth: AuthContext,
  orgId: string,
  shiftTypeId: string,
): Promise<void> {
  await requireSchedulingManager(auth, orgId);
  assertUuid(shiftTypeId, "Tipo de turno não encontrado.");

  const { data, error } = await auth.supabase
    .from("shift_types")
    .delete()
    .eq("id", shiftTypeId)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23503") {
      throw new AppError(
        "CONFLICT",
        "Este tipo de turno é usado em um regime. Tire-o dos regimes antes de excluir.",
      );
    }
    throw fromPostgrestError(error);
  }
  if (!data) throw new AppError("NOT_FOUND", "Tipo de turno não encontrado.");
}
