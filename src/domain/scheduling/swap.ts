import {
  findRestViolations,
  type RestViolation,
  type TimedShift,
} from "./analysis";

/** A swap (requestedShiftId set) or a coverage request (null). */
export type SwapProposal = {
  offeredShiftId: string;
  requesterId: string;
  targetId: string;
  requestedShiftId: string | null;
};

type IdentifiedShift = TimedShift & { id: string };

/** The shifts as they would look after the swap. */
export function applySwap<T extends IdentifiedShift>(
  shifts: readonly T[],
  swap: SwapProposal,
): T[] {
  return shifts.map((shift) => {
    if (shift.id === swap.offeredShiftId)
      return { ...shift, userId: swap.targetId };
    if (shift.id === swap.requestedShiftId) {
      return { ...shift, userId: swap.requesterId };
    }
    return shift;
  });
}

/**
 * Rest violations the swap would create: only those involving a moved shift,
 * so problems that already existed aren't blamed on the swap.
 */
export function swapRestWarnings<T extends IdentifiedShift>(
  shifts: readonly T[],
  swap: SwapProposal,
  minRestMinutes: number,
): RestViolation<T>[] {
  const moved = new Set(
    [swap.offeredShiftId, swap.requestedShiftId].filter(Boolean),
  );
  return findRestViolations(applySwap(shifts, swap), minRestMinutes).filter(
    (v) => moved.has(v.before.id) || moved.has(v.after.id),
  );
}
