export type TimedShift = { userId: string; startsAt: string; endsAt: string };

export type RestViolation<T extends TimedShift> = {
  userId: string;
  before: T;
  after: T;
  /** Negative when the shifts overlap. */
  restMinutes: number;
};

const minutesBetween = (from: string, to: string) =>
  (new Date(to).getTime() - new Date(from).getTime()) / 60_000;

/**
 * Consecutive shifts of the same person with less than `minRestMinutes`
 * between the end of one and the start of the next. Input order doesn't
 * matter.
 */
export function findRestViolations<T extends TimedShift>(
  shifts: readonly T[],
  minRestMinutes: number,
): RestViolation<T>[] {
  const byUser = new Map<string, T[]>();
  for (const shift of shifts) {
    const list = byUser.get(shift.userId) ?? [];
    list.push(shift);
    byUser.set(shift.userId, list);
  }

  const violations: RestViolation<T>[] = [];
  for (const [userId, list] of byUser) {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    for (let i = 1; i < list.length; i++) {
      const restMinutes = minutesBetween(list[i - 1].endsAt, list[i].startsAt);
      if (restMinutes < minRestMinutes) {
        violations.push({
          userId,
          before: list[i - 1],
          after: list[i],
          restMinutes,
        });
      }
    }
  }
  return violations;
}

/** Total scheduled minutes per person. */
export function totalMinutesByUser(
  shifts: readonly TimedShift[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const shift of shifts) {
    totals.set(
      shift.userId,
      (totals.get(shift.userId) ?? 0) +
        minutesBetween(shift.startsAt, shift.endsAt),
    );
  }
  return totals;
}
