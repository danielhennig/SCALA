import "server-only";
import { addDays } from "@/domain/scheduling/dates";
import { swapRestWarnings } from "@/domain/scheduling/swap";
import { formatDuration } from "@/domain/scheduling/time";
import {
  localDate,
  localDayBounds,
  localTime,
} from "@/domain/scheduling/zoned";
import { formatShortDate } from "@/lib/format";
import { canManageScheduling } from "@/lib/roles";
import type { SwapStatus } from "@/lib/swaps";
import type { CreateSwapData, SwapAction } from "@/lib/validation/swaps";
import type { AuthContext } from "../auth";
import { AppError, fromPostgrestError } from "../errors";
import { assertUuid } from "../params";
import { getMyOrganization, getMyRole } from "./organizations";

export type SwapShift = {
  startsAt: string;
  endsAt: string;
  shiftTypeName: string | null;
  color: string | null;
};

export type ShiftSwap = {
  id: string;
  status: SwapStatus;
  requesterId: string;
  requesterName: string;
  targetId: string;
  targetName: string;
  offeredShiftId: string;
  requestedShiftId: string | null;
  offered: SwapShift;
  /** Null: coverage request. */
  requested: SwapShift | null;
  createdAt: string;
  /** Rest-time warnings, computed for managers on requests awaiting approval. */
  warnings: string[];
};

const COLUMNS = `
  id, status, requester_id, target_id, offered_shift_id, requested_shift_id,
  offered_starts_at, offered_ends_at, requested_starts_at, requested_ends_at, created_at,
  requester:profiles!shift_swaps_requester_id_fkey(full_name),
  target:profiles!shift_swaps_target_id_fkey(full_name),
  offered_type:shift_types!shift_swaps_offered_shift_type_id_fkey(name, color),
  requested_type:shift_types!shift_swaps_requested_shift_type_id_fkey(name, color)
`;

type Row = {
  id: string;
  status: SwapStatus;
  requester_id: string;
  target_id: string;
  offered_shift_id: string;
  requested_shift_id: string | null;
  offered_starts_at: string;
  offered_ends_at: string;
  requested_starts_at: string | null;
  requested_ends_at: string | null;
  created_at: string;
  requester: { full_name: string } | null;
  target: { full_name: string } | null;
  offered_type: { name: string; color: string } | null;
  requested_type: { name: string; color: string } | null;
};

function toSwap(row: Row): ShiftSwap {
  return {
    id: row.id,
    status: row.status,
    requesterId: row.requester_id,
    requesterName: row.requester?.full_name ?? "Ex-membro",
    targetId: row.target_id,
    targetName: row.target?.full_name ?? "Ex-membro",
    offeredShiftId: row.offered_shift_id,
    requestedShiftId: row.requested_shift_id,
    offered: {
      startsAt: row.offered_starts_at,
      endsAt: row.offered_ends_at,
      shiftTypeName: row.offered_type?.name ?? null,
      color: row.offered_type?.color ?? null,
    },
    requested:
      row.requested_starts_at && row.requested_ends_at
        ? {
            startsAt: row.requested_starts_at,
            endsAt: row.requested_ends_at,
            shiftTypeName: row.requested_type?.name ?? null,
            color: row.requested_type?.color ?? null,
          }
        : null,
    createdAt: row.created_at,
    warnings: [],
  };
}

/**
 * Requests the caller can see (RLS: requester, target, or managers), newest
 * first. Managers get rest-time warnings on those awaiting approval.
 */
export async function listSwaps(
  auth: AuthContext,
  orgId: string,
): Promise<ShiftSwap[]> {
  const role = await getMyRole(auth, orgId);

  const { data, error } = await auth.supabase
    .from("shift_swaps")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw fromPostgrestError(error);
  const swaps = data.map(toSwap);
  if (canManageScheduling(role)) await addRestWarnings(auth, orgId, swaps);
  return swaps;
}

async function addRestWarnings(
  auth: AuthContext,
  orgId: string,
  swaps: ShiftSwap[],
): Promise<void> {
  const awaiting = swaps.filter((s) => s.status === "pending_approval");
  if (awaiting.length === 0) return;

  const { organization } = await getMyOrganization(auth, orgId);
  const timeZone = organization.timezone;
  const instants = awaiting.flatMap((s) =>
    [s.offered.startsAt, s.requested?.startsAt].filter((v): v is string =>
      Boolean(v),
    ),
  );
  const dates = instants.map((i) => localDate(i, timeZone)).sort();
  const from = localDayBounds(addDays(dates[0], -2), timeZone).start;
  const to = localDayBounds(addDays(dates.at(-1)!, 2), timeZone).end;
  const userIds = [
    ...new Set(awaiting.flatMap((s) => [s.requesterId, s.targetId])),
  ];

  const { data, error } = await auth.supabase
    .from("shifts")
    .select("id, user_id, starts_at, ends_at")
    .eq("org_id", orgId)
    .in("user_id", userIds)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString());
  if (error) throw fromPostgrestError(error);

  const shifts = data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));
  const name = (s: ShiftSwap, userId: string) =>
    userId === s.requesterId ? s.requesterName : s.targetName;

  for (const swap of awaiting) {
    swap.warnings = swapRestWarnings(
      shifts,
      {
        offeredShiftId: swap.offeredShiftId,
        requesterId: swap.requesterId,
        targetId: swap.targetId,
        requestedShiftId: swap.requestedShiftId,
      },
      organization.minRestHours * 60,
    ).map(
      (v) =>
        `${name(swap, v.userId)} ficaria com ${
          v.restMinutes < 0
            ? "plantões sobrepostos"
            : `${formatDuration(v.restMinutes)} de descanso`
        } (${formatShortDate(localDate(v.before.endsAt, timeZone))} ${localTime(v.before.endsAt, timeZone)} → ${formatShortDate(localDate(v.after.startsAt, timeZone))} ${localTime(v.after.startsAt, timeZone)})`,
    );
  }
}

export async function createSwap(
  auth: AuthContext,
  orgId: string,
  { offeredShiftId, targetId, requestedShiftId }: CreateSwapData,
): Promise<{ id: string }> {
  await getMyRole(auth, orgId);

  // The RPC derives the org from the shift; make sure it's this org.
  const { data: shift, error: shiftError } = await auth.supabase
    .from("shifts")
    .select("org_id")
    .eq("id", offeredShiftId)
    .maybeSingle();
  if (shiftError) throw fromPostgrestError(shiftError);
  if (!shift || shift.org_id !== orgId) {
    throw new AppError("NOT_FOUND", "Plantão não encontrado.");
  }

  const { data, error } = await auth.supabase.rpc("create_shift_swap", {
    p_offered_shift_id: offeredShiftId,
    p_target_id: targetId,
    ...(requestedShiftId ? { p_requested_shift_id: requestedShiftId } : {}),
  });

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        "CONFLICT",
        "Já existe um pedido de troca ativo para esse plantão.",
      );
    }
    throw fromPostgrestError(error);
  }
  return { id: data };
}

/** One state transition: accept/decline (colleague), cancel (requester), approve/reject (manager). */
export async function actOnSwap(
  auth: AuthContext,
  orgId: string,
  swapId: string,
  action: SwapAction,
): Promise<{ status: SwapStatus }> {
  await getMyRole(auth, orgId);
  assertUuid(swapId, "Pedido de troca não encontrado.");

  // Scope check: the request must belong to this org (RLS also hides others').
  const { data: swap, error: swapError } = await auth.supabase
    .from("shift_swaps")
    .select("org_id")
    .eq("id", swapId)
    .maybeSingle();
  if (swapError) throw fromPostgrestError(swapError);
  if (!swap || swap.org_id !== orgId) {
    throw new AppError("NOT_FOUND", "Pedido de troca não encontrado.");
  }

  const call =
    action === "accept" || action === "decline"
      ? auth.supabase.rpc("respond_shift_swap", {
          p_swap_id: swapId,
          p_accept: action === "accept",
        })
      : action === "cancel"
        ? auth.supabase.rpc("cancel_shift_swap", { p_swap_id: swapId })
        : auth.supabase.rpc("review_shift_swap", {
            p_swap_id: swapId,
            p_approve: action === "approve",
          });

  const { data, error } = await call;
  if (error) {
    if (error.code === "23P01") {
      throw new AppError(
        "CONFLICT",
        "A troca deixaria alguém com plantões sobrepostos.",
      );
    }
    if (error.code === "42501") {
      throw new AppError(
        "FORBIDDEN",
        action === "accept" || action === "decline"
          ? "Só o colega convidado pode responder."
          : action === "cancel"
            ? "Só quem pediu pode cancelar."
            : "Apenas administradores e gestores aprovam trocas.",
      );
    }
    throw fromPostgrestError(error);
  }
  return { status: data };
}

/** Requests waiting on the caller (as colleague, or as manager). */
export async function countActionableSwaps(
  auth: AuthContext,
  orgId: string,
  isManager: boolean,
): Promise<number> {
  const forMe = auth.supabase
    .from("shift_swaps")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("target_id", auth.user.id)
    .eq("status", "pending_target");
  const forManager = isManager
    ? auth.supabase
        .from("shift_swaps")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "pending_approval")
    : null;

  const [mine, managed] = await Promise.all([forMe, forManager]);
  if (mine.error) throw fromPostgrestError(mine.error);
  if (managed?.error) throw fromPostgrestError(managed.error);
  return (mine.count ?? 0) + (managed?.count ?? 0);
}

export type SwapFormShift = {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  shiftTypeName: string | null;
};

/**
 * What the request form needs: the caller's future shifts in published
 * schedules, and colleagues' future shifts the caller can see (for exchanges).
 */
export async function listSwapCandidates(
  auth: AuthContext,
  orgId: string,
): Promise<{ mine: SwapFormShift[]; colleagues: SwapFormShift[] }> {
  await getMyRole(auth, orgId);
  const now = new Date();
  const until = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const { data, error } = await auth.supabase
    .from("shifts")
    .select(
      "id, user_id, starts_at, ends_at, shift_type:shift_types(name), schedule:schedules!inner(status)",
    )
    .eq("org_id", orgId)
    .eq("schedule.status", "published")
    .gt("starts_at", now.toISOString())
    .lt("starts_at", until.toISOString())
    .order("starts_at");
  if (error) throw fromPostgrestError(error);

  const shifts = data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    shiftTypeName: row.shift_type?.name ?? null,
  }));
  return {
    mine: shifts.filter((s) => s.userId === auth.user.id),
    colleagues: shifts.filter((s) => s.userId !== auth.user.id),
  };
}
