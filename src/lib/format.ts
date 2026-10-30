// Display helpers for calendar dates ("YYYY-MM-DD"), formatted as pt-BR.
// Dates are rendered in UTC because they are calendar days, not instants.

import { localDate, localTime } from "@/domain/scheduling/zoned";

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const weekdayShort = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: "UTC",
});

const monthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "2026-11-14" → "14/11" */
export function formatShortDate(date: string): string {
  return shortDate.format(toUtc(date));
}

const fullDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-14" → "14/11/2026" */
export function formatDate(date: string): string {
  return fullDate.format(toUtc(date));
}

/** Inclusive range: "14/11/2026" or "10/11/2026 a 20/11/2026". */
export function formatDateRange(start: string, end: string): string {
  return start === end
    ? formatDate(start)
    : `${formatDate(start)} a ${formatDate(end)}`;
}

/** "2026-11-14" → "sáb." */
export function formatWeekday(date: string): string {
  return weekdayShort.format(toUtc(date));
}

/** "2026-11-14" → "sáb., 14/11" */
export function formatWeekdayDate(date: string): string {
  return `${formatWeekday(date)}, ${formatShortDate(date)}`;
}

/** "2026-11" → "novembro de 2026" */
export function formatMonth(yearMonth: string): string {
  return monthYear.format(toUtc(`${yearMonth}-01`));
}

/**
 * "sáb., 14/11 07:00–19:00 · Diurno" in the organization's time zone.
 * (+1) marks shifts that end on the next day.
 */
export function formatShiftLabel(
  shift: { startsAt: string; endsAt: string; shiftTypeName: string | null },
  timeZone: string,
): string {
  const date = localDate(shift.startsAt, timeZone);
  const nextDay = localDate(shift.endsAt, timeZone) !== date ? " (+1)" : "";
  const type = shift.shiftTypeName ? ` · ${shift.shiftTypeName}` : "";
  return `${formatWeekdayDate(date)} ${localTime(shift.startsAt, timeZone)}–${localTime(shift.endsAt, timeZone)}${nextDay}${type}`;
}

/** One-letter weekday headers, Sunday first. */
export const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
