import type { TimedShift } from "./analysis";
import { addDays, eachDate, weekdayOf } from "./dates";
import { localDate, localDayBounds, zonedDateTimeToUtc } from "./zoned";

export type HoursSummary = {
  shifts: number;
  totalMinutes: number;
  /** Clock minutes between 22:00 and 05:00 local (CLT art. 73 urban night). */
  nightMinutes: number;
  /** Clock minutes on local Saturdays and Sundays. */
  weekendMinutes: number;
};

export const NIGHT_START = "22:00";
export const NIGHT_END = "05:00";

const toMs = (instant: string | Date) => new Date(instant).getTime();

function overlapMinutes(
  startMs: number,
  endMs: number,
  windowStart: Date,
  windowEnd: Date,
): number {
  const from = Math.max(startMs, windowStart.getTime());
  const to = Math.min(endMs, windowEnd.getTime());
  return to > from ? Math.round((to - from) / 60_000) : 0;
}

/**
 * Minutes of the shift inside night windows (22:00 → 05:00 next day), in
 * local wall-clock time, so DST nights are 1h shorter or longer. Clock time:
 * the CLT "hora noturna reduzida" (52m30s) depends on each regime and is not
 * applied here.
 */
export function nightMinutes(shift: TimedShift, timeZone: string): number {
  const start = toMs(shift.startsAt);
  const end = toMs(shift.endsAt);
  // A window starts every evening; the one from the day before the shift
  // can still be running when it starts (e.g. a 03:00 start).
  const days = eachDate(
    addDays(localDate(shift.startsAt, timeZone), -1),
    localDate(shift.endsAt, timeZone),
  );
  return days.reduce(
    (sum, day) =>
      sum +
      overlapMinutes(
        start,
        end,
        zonedDateTimeToUtc(day, NIGHT_START, timeZone),
        zonedDateTimeToUtc(addDays(day, 1), NIGHT_END, timeZone),
      ),
    0,
  );
}

/** Minutes of the shift that fall on a local Saturday or Sunday. */
export function weekendMinutes(shift: TimedShift, timeZone: string): number {
  const start = toMs(shift.startsAt);
  const end = toMs(shift.endsAt);
  return eachDate(
    localDate(shift.startsAt, timeZone),
    localDate(shift.endsAt, timeZone),
  )
    .filter((day) => weekdayOf(day) === 0 || weekdayOf(day) === 6)
    .reduce((sum, day) => {
      const bounds = localDayBounds(day, timeZone);
      return sum + overlapMinutes(start, end, bounds.start, bounds.end);
    }, 0);
}

/** Per-person totals. Each shift counts whole (callers pick shifts by start). */
export function summarizeHours(
  shifts: readonly TimedShift[],
  timeZone: string,
): Map<string, HoursSummary> {
  const byUser = new Map<string, HoursSummary>();
  for (const shift of shifts) {
    const summary = byUser.get(shift.userId) ?? {
      shifts: 0,
      totalMinutes: 0,
      nightMinutes: 0,
      weekendMinutes: 0,
    };
    summary.shifts++;
    summary.totalMinutes += Math.round(
      (toMs(shift.endsAt) - toMs(shift.startsAt)) / 60_000,
    );
    summary.nightMinutes += nightMinutes(shift, timeZone);
    summary.weekendMinutes += weekendMinutes(shift, timeZone);
    byUser.set(shift.userId, summary);
  }
  return byUser;
}
