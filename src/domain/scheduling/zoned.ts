import { TZDate } from "@date-fns/tz";
import { addDays } from "./dates";
import { parseTimeOfDay } from "./time";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Wall-clock date + time in `timeZone` → the UTC instant it represents.
 * "2026-11-01" 07:00 in America/Sao_Paulo → 2026-11-01T10:00:00Z.
 */
export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const minutes = parseTimeOfDay(time);
  const zoned = new TZDate(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
    timeZone,
  );
  return new Date(zoned.getTime());
}

/** UTC instant → the calendar date it falls on in `timeZone`. */
export function localDate(instant: Date | string, timeZone: string): string {
  const t = new TZDate(new Date(instant).getTime(), timeZone);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** UTC instant → "HH:MM" wall-clock time in `timeZone`. */
export function localTime(instant: Date | string, timeZone: string): string {
  const t = new TZDate(new Date(instant).getTime(), timeZone);
  return `${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

/** [start, end) UTC instants of a local calendar day (23 or 25h around DST). */
export function localDayBounds(
  date: string,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: zonedDateTimeToUtc(date, "00:00", timeZone),
    end: zonedDateTimeToUtc(addDays(date, 1), "00:00", timeZone),
  };
}
