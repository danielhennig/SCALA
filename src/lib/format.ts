// Display helpers for calendar dates ("YYYY-MM-DD"), formatted as pt-BR.
// Dates are rendered in UTC because they are calendar days, not instants.

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

/** "2026-11-14" → "sáb., 14/11" */
export function formatWeekdayDate(date: string): string {
  return `${weekdayShort.format(toUtc(date))}, ${formatShortDate(date)}`;
}

/** "2026-11" → "novembro de 2026" */
export function formatMonth(yearMonth: string): string {
  return monthYear.format(toUtc(`${yearMonth}-01`));
}

/** One-letter weekday headers, Sunday first. */
export const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
