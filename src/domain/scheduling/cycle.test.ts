import { describe, expect, it } from "vitest";
import {
  averageWeeklyHours,
  minimumRestMinutes,
  ROTATION_PRESETS,
} from "@/domain/scheduling/cycle";

const day = { startTime: "07:00", durationMinutes: 720 };
const night = { startTime: "19:00", durationMinutes: 720 };
const full = { startTime: "07:00", durationMinutes: 1440 };
const office = { startTime: "08:00", durationMinutes: 480 };

const preset = (id: string) => ROTATION_PRESETS.find((p) => p.id === id)!;

describe("ROTATION_PRESETS", () => {
  it.each([
    ["12x36", 2, 1],
    ["24x48", 3, 1],
    ["24x72", 4, 1],
    ["6x1", 7, 6],
    ["5x2", 7, 5],
  ])("%s has a %i-day cycle with %i working days", (id, length, working) => {
    const cycle = preset(id).build("shift");
    expect(cycle).toHaveLength(length);
    expect(cycle.filter(Boolean)).toHaveLength(working);
  });
});

describe("averageWeeklyHours", () => {
  it("12x36 and 24x72 both average 42h/week", () => {
    expect(averageWeeklyHours(preset("12x36").build(day))).toBe(42);
    expect(averageWeeklyHours(preset("24x72").build(full))).toBe(42);
  });

  it("5x2 with 8h days is 40h/week", () => {
    expect(averageWeeklyHours(preset("5x2").build(office))).toBe(40);
  });

  it("an empty cycle is 0", () => {
    expect(averageWeeklyHours([])).toBe(0);
  });
});

describe("minimumRestMinutes", () => {
  it("12x36 day shift rests 36h", () => {
    expect(minimumRestMinutes(preset("12x36").build(day))).toBe(36 * 60);
  });

  it("12x36 night shift also rests 36h (crosses midnight)", () => {
    expect(minimumRestMinutes(preset("12x36").build(night))).toBe(36 * 60);
  });

  it("24x72 rests 72h", () => {
    expect(minimumRestMinutes(preset("24x72").build(full))).toBe(72 * 60);
  });

  it("6x1 office days: 16h between days (wraps the cycle correctly)", () => {
    expect(minimumRestMinutes(preset("6x1").build(office))).toBe(16 * 60);
  });

  it("day shift, then night shift the next day: 24h rest", () => {
    // Day 1 ends 19:00; day 2's night starts 19:00 on day 2.
    expect(minimumRestMinutes([day, night, null, null])).toBe(24 * 60);
  });

  it("night shift, then day shift the next day: no rest", () => {
    // Night ends 07:00 on day 2, exactly when the day shift starts.
    expect(minimumRestMinutes([night, day, null])).toBe(0);
  });

  it("two 24h shifts in a row: no rest", () => {
    expect(minimumRestMinutes([full, full, null])).toBe(0);
  });

  it("overlapping shifts give a negative rest", () => {
    // 08:00 + 24h ends 08:00 on day 2, but the day shift starts 07:00.
    const late24h = { startTime: "08:00", durationMinutes: 1440 };
    expect(minimumRestMinutes([late24h, day, null])).toBe(-60);
  });

  it("returns null when there is no working day", () => {
    expect(minimumRestMinutes([null, null])).toBeNull();
  });
});
