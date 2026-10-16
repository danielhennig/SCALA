// Calendar dates as "YYYY-MM-DD" strings. Arithmetic runs in UTC on purpose:
// a calendar day has no time zone, so DST never shifts these results.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMs(date: string): number {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** True for real calendar dates only ("2026-02-30" is false). */
export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && fromUtcMs(toUtcMs(value)) === value;
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** Every date from `from` to `to`, inclusive. */
export function eachDate(from: string, to: string): string[] {
  const count = daysBetween(from, to) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, i) => addDays(from, i));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

/** "2026-11" → first and last day of that month. */
export function monthPeriod(yearMonth: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) throw new Error(`Invalid month: ${yearMonth}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = fromUtcMs(Date.UTC(year, month - 1, 1));
  const end = fromUtcMs(Date.UTC(year, month, 0)); // day 0 = last day of previous month
  return { start, end };
}
