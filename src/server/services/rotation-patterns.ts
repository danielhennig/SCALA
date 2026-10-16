import "server-only";
import type { CycleDay } from "@/domain/scheduling/cycle";
import { canManageScheduling } from "@/lib/roles";
import type { RotationPatternData } from "@/lib/validation/scheduling";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { assertUuid } from "../params";
import { getMyRole } from "./organizations";

export type RotationPattern = {
  id: string;
  name: string;
  cycleLength: number;
  /** One entry per cycle day: shift type id, or null for a day off. */
  days: CycleDay<string>[];
};

const COLUMNS =
  "id, name, cycle_length, rotation_pattern_days(day_index, shift_type_id)";

type PatternRow = {
  id: string;
  name: string;
  cycle_length: number;
  rotation_pattern_days: { day_index: number; shift_type_id: string }[];
};

// The DB stores only working days; expand to the full cycle (gaps = day off).
function toRotationPattern(row: PatternRow): RotationPattern {
  const days: CycleDay<string>[] = Array(row.cycle_length).fill(null);
  for (const day of row.rotation_pattern_days) {
    days[day.day_index] = day.shift_type_id;
  }
  return { id: row.id, name: row.name, cycleLength: row.cycle_length, days };
}

async function requireSchedulingManager(auth: AuthContext, orgId: string) {
  if (!canManageScheduling(await getMyRole(auth, orgId))) {
    throw new AppError(
      "FORBIDDEN",
      "Apenas administradores e gestores podem configurar regimes.",
    );
  }
}

export async function listRotationPatterns(
  auth: AuthContext,
  orgId: string,
): Promise<RotationPattern[]> {
  await getMyRole(auth, orgId);

  const { data, error } = await auth.supabase
    .from("rotation_patterns")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .order("name");

  if (error) throw fromPostgrestError(error);
  return data.map(toRotationPattern);
}

export async function getRotationPattern(
  auth: AuthContext,
  orgId: string,
  patternId: string,
): Promise<RotationPattern> {
  await getMyRole(auth, orgId);
  assertUuid(patternId, "Regime não encontrado.");

  const { data, error } = await auth.supabase
    .from("rotation_patterns")
    .select(COLUMNS)
    .eq("id", patternId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Regime não encontrado.");
  return toRotationPattern(data);
}

/** Creates (patternId null) or fully replaces a pattern and its cycle. */
export async function saveRotationPattern(
  auth: AuthContext,
  orgId: string,
  patternId: string | null,
  { name, days }: RotationPatternData,
): Promise<{ id: string }> {
  await requireSchedulingManager(auth, orgId);
  if (patternId !== null) assertUuid(patternId, "Regime não encontrado.");

  const { data, error } = await auth.supabase.rpc("save_rotation_pattern", {
    p_org_id: orgId,
    p_name: name,
    // Generated types say string[], but uuid[] elements may be null (day off).
    p_days: days as string[],
    ...(patternId ? { p_pattern_id: patternId } : {}),
  });

  if (error) {
    if (error.code === "23505") {
      throw new AppError("CONFLICT", "Já existe um regime com esse nome.");
    }
    if (error.code === "23503") {
      throw new AppError("VALIDATION_ERROR", "Tipo de turno inválido.");
    }
    if (error.code === "P0002") {
      throw new AppError("NOT_FOUND", "Regime não encontrado.");
    }
    throw fromPostgrestError(error);
  }
  return { id: data };
}

export async function deleteRotationPattern(
  auth: AuthContext,
  orgId: string,
  patternId: string,
): Promise<void> {
  await requireSchedulingManager(auth, orgId);
  assertUuid(patternId, "Regime não encontrado.");

  const { data, error } = await auth.supabase
    .from("rotation_patterns")
    .delete()
    .eq("id", patternId)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();

  if (error) throw fromPostgrestError(error);
  if (!data) throw new AppError("NOT_FOUND", "Regime não encontrado.");
}
