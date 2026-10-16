import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  eachDate,
  isIsoDate,
  monthPeriod,
  weekdayOf,
} from "@/domain/scheduling/dates";

describe("calendar dates", () => {
  it("adds days across month, year and leap-day boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-11-01", "2026-11-30")).toBe(29);
    expect(daysBetween("2026-11-30", "2026-11-01")).toBe(-29);
  });

  it("lists dates inclusively, empty when reversed", () => {
    expect(eachDate("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(eachDate("2026-11-02", "2026-11-01")).toEqual([]);
  });

  it("validates real calendar dates only", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-01")).toBe(false);
  });

  it("knows weekdays (2026-11-01 is a Sunday)", () => {
    expect(weekdayOf("2026-11-01")).toBe(0);
    expect(weekdayOf("2026-11-07")).toBe(6);
  });

  it("builds month periods, including February in leap years", () => {
    expect(monthPeriod("2026-11")).toEqual({
      start: "2026-11-01",
      end: "2026-11-30",
    });
    expect(monthPeriod("2028-02").end).toBe("2028-02-29");
    expect(monthPeriod("2026-12").end).toBe("2026-12-31");
  });
});
