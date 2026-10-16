import type { CycleDay } from "./cycle";
import { eachDate } from "./dates";
import { zonedDateTimeToUtc } from "./zoned";

export type GeneratorShiftType = {
  id: string;
  startTime: string;
  durationMinutes: number;
};

/**
 * `offset` is the cycle day a person is on at the first date of the period.
 * In a 12x36 ([shift, off]) offset 0 works days 1, 3, 5…; offset 1 works
 * days 2, 4, 6… — the classic A/B groups.
 */
export type Assignment = { userId: string; offset: number };

export type GeneratedShift = {
  userId: string;
  shiftTypeId: string;
  /** ISO UTC instants. */
  startsAt: string;
  endsAt: string;
  /** Local calendar date the shift starts on. */
  date: string;
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Expands a rotation cycle into concrete shifts for each person over
 * [from, to] (inclusive local dates). Start times are wall-clock in
 * `timeZone`; the end is start + duration in elapsed time, so a 19:00 shift of
 * 12h ends at 07:00 the next day, and the last night of the period may end
 * after `to`.
 */
export function generateShifts({
  cycle,
  assignments,
  from,
  to,
  timeZone,
}: {
  cycle: readonly CycleDay<GeneratorShiftType>[];
  assignments: readonly Assignment[];
  from: string;
  to: string;
  timeZone: string;
}): GeneratedShift[] {
  if (cycle.length === 0) return [];
  const dates = eachDate(from, to);

  return assignments.flatMap(({ userId, offset }) =>
    dates.flatMap((date, dayIndex) => {
      const shiftType = cycle[mod(dayIndex + offset, cycle.length)];
      if (!shiftType) return [];
      const startsAt = zonedDateTimeToUtc(date, shiftType.startTime, timeZone);
      const endsAt = new Date(
        startsAt.getTime() + shiftType.durationMinutes * 60_000,
      );
      return [
        {
          userId,
          shiftTypeId: shiftType.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          date,
        },
      ];
    }),
  );
}

/**
 * Default offsets: spread people over the cycle's working days so coverage is
 * balanced (in 12x36, alternating people land on alternating days).
 */
export function suggestOffsets(
  userIds: readonly string[],
  cycleLength: number,
): Assignment[] {
  return userIds.map((userId, i) => ({
    userId,
    offset: cycleLength > 0 ? i % cycleLength : 0,
  }));
}
