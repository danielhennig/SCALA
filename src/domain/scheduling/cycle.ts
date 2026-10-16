import { MINUTES_PER_DAY, parseTimeOfDay } from "./time";

/** One day of a rotation cycle: the shift worked that day, or null (day off). */
export type CycleDay<T> = T | null;

type TimedShift = { startTime: string; durationMinutes: number };

export type RotationPresetId = "12x36" | "24x48" | "24x72" | "6x1" | "5x2";

export type RotationPreset = {
  id: RotationPresetId;
  label: string;
  description: string;
  /** Builds the cycle using the same shift on every working day. */
  build: <T>(shift: T) => CycleDay<T>[];
};

const repeat = <T>(value: T, times: number): T[] => Array(times).fill(value);

export const ROTATION_PRESETS: readonly RotationPreset[] = [
  {
    id: "12x36",
    label: "12x36",
    description: "Plantão de 12h em dias alternados",
    build: (shift) => [shift, null],
  },
  {
    id: "24x48",
    label: "24x48",
    description: "Plantão de 24h, dois dias de folga",
    build: (shift) => [shift, null, null],
  },
  {
    id: "24x72",
    label: "24x72",
    description: "Plantão de 24h, três dias de folga",
    build: (shift) => [shift, null, null, null],
  },
  {
    id: "6x1",
    label: "6x1",
    description: "Seis dias de trabalho, um de folga",
    build: (shift) => [...repeat(shift, 6), null],
  },
  {
    id: "5x2",
    label: "5x2",
    description: "Cinco dias de trabalho, dois de folga",
    build: (shift) => [...repeat(shift, 5), null, null],
  },
];

/** Average hours worked per week if the cycle repeats indefinitely. */
export function averageWeeklyHours(
  cycle: readonly CycleDay<{ durationMinutes: number }>[],
): number {
  if (cycle.length === 0) return 0;
  const totalMinutes = cycle.reduce(
    (sum, day) => sum + (day?.durationMinutes ?? 0),
    0,
  );
  return (totalMinutes / cycle.length) * (7 / 60);
}

/**
 * Shortest rest (in minutes) between the end of one shift and the start of the
 * next, treating the cycle as repeating (the last shift is followed by the
 * first shift of the next cycle). Negative means shifts overlap. Returns null
 * when the cycle has no working day.
 */
export function minimumRestMinutes(
  cycle: readonly CycleDay<TimedShift>[],
): number | null {
  const cycleMinutes = cycle.length * MINUTES_PER_DAY;
  const shifts = cycle.flatMap((day, index) => {
    if (!day) return [];
    const start = index * MINUTES_PER_DAY + parseTimeOfDay(day.startTime);
    return [{ start, end: start + day.durationMinutes }];
  });
  if (shifts.length === 0) return null;

  shifts.sort((a, b) => a.start - b.start);
  return shifts.reduce((min, shift, i) => {
    const nextStart =
      i + 1 < shifts.length
        ? shifts[i + 1].start
        : shifts[0].start + cycleMinutes;
    return Math.min(min, nextStart - shift.end);
  }, Infinity);
}
