import { describe, expect, it } from "vitest";
import {
  endDayOffset,
  formatDuration,
  formatTimeOfDay,
  parseTimeOfDay,
  shiftWindowLabel,
} from "@/domain/scheduling/time";

describe("parseTimeOfDay", () => {
  it("accepts HH:MM and Postgres HH:MM:SS", () => {
    expect(parseTimeOfDay("07:00")).toBe(420);
    expect(parseTimeOfDay("19:30:00")).toBe(1170);
    expect(parseTimeOfDay("00:00")).toBe(0);
  });

  it.each(["24:00", "7:00", "12:60", "", "abc"])("rejects %j", (value) => {
    expect(() => parseTimeOfDay(value)).toThrow();
  });
});

describe("formatTimeOfDay / formatDuration", () => {
  it("wraps past midnight", () => {
    expect(formatTimeOfDay(1860)).toBe("07:00");
    expect(formatTimeOfDay(-60)).toBe("23:00");
  });

  it.each([
    [720, "12h"],
    [390, "6h30"],
    [45, "45min"],
    [1440, "24h"],
    [0, "0h"],
  ])("formats %i minutes as %s", (minutes, label) => {
    expect(formatDuration(minutes)).toBe(label);
  });
});

describe("shift windows", () => {
  it("same-day shift", () => {
    expect(endDayOffset("07:00", 720)).toBe(0);
    expect(shiftWindowLabel("07:00", 720)).toBe("07:00 – 19:00");
  });

  it("night shift ends the next day", () => {
    expect(endDayOffset("19:00", 720)).toBe(1);
    expect(shiftWindowLabel("19:00", 720)).toBe("19:00 – 07:00 (+1)");
  });

  it("24h shift ends at the same time the next day", () => {
    expect(shiftWindowLabel("07:00", 1440)).toBe("07:00 – 07:00 (+1)");
  });

  it("ending exactly at midnight counts as the next day", () => {
    expect(shiftWindowLabel("23:00", 60)).toBe("23:00 – 00:00 (+1)");
  });
});
