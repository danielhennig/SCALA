export const MINUTES_PER_DAY = 24 * 60;

const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** "07:00" or Postgres' "07:00:00" → minutes since midnight. */
export function parseTimeOfDay(value: string): number {
  const match = TIME_OF_DAY.exec(value);
  if (!match) throw new Error(`Invalid time of day: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes since midnight → "HH:MM" (wraps past 24h). */
export function formatTimeOfDay(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** 720 → "12h", 390 → "6h30", 45 → "45min", 0 → "0h" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return m === 0 ? "0h" : `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** How many days after its start day a shift ends (19:00 + 12h → 1). */
export function endDayOffset(
  startTime: string,
  durationMinutes: number,
): number {
  return Math.floor(
    (parseTimeOfDay(startTime) + durationMinutes) / MINUTES_PER_DAY,
  );
}

/** "07:00 – 19:00", or "19:00 – 07:00 (+1)" when it ends on a later day. */
export function shiftWindowLabel(
  startTime: string,
  durationMinutes: number,
): string {
  const start = parseTimeOfDay(startTime);
  const offset = endDayOffset(startTime, durationMinutes);
  const label = `${formatTimeOfDay(start)} – ${formatTimeOfDay(start + durationMinutes)}`;
  return offset > 0 ? `${label} (+${offset})` : label;
}
