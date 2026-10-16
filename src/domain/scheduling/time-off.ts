// Time off works on local calendar dates ("YYYY-MM-DD", inclusive). A shift
// belongs to the date it starts on, so the same rule decides whether it falls
// on a day off (this mirrors the shifts_block_time_off trigger).

export type TimeOffRange = {
  userId: string;
  startDate: string;
  endDate: string;
};

/** Whether `date` is inside any of the person's ranges. */
export function isOnTimeOff(
  ranges: readonly TimeOffRange[],
  userId: string,
  date: string,
): boolean {
  // ISO dates compare correctly as strings.
  return ranges.some(
    (r) => r.userId === userId && r.startDate <= date && date <= r.endDate,
  );
}

/**
 * Splits generated shifts into those that can be kept and those that would
 * fall on a day of time off (and must be skipped).
 */
export function excludeTimeOff<T extends { userId: string; date: string }>(
  shifts: readonly T[],
  ranges: readonly TimeOffRange[],
): { kept: T[]; skipped: T[] } {
  const kept: T[] = [];
  const skipped: T[] = [];
  for (const shift of shifts) {
    (isOnTimeOff(ranges, shift.userId, shift.date) ? skipped : kept).push(
      shift,
    );
  }
  return { kept, skipped };
}
