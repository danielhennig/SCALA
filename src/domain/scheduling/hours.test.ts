import { describe, expect, it } from "vitest";
import {
  nightMinutes,
  summarizeHours,
  weekendMinutes,
} from "@/domain/scheduling/hours";

const SP = "America/Sao_Paulo"; // UTC−3, no DST
const shift = (startsAt: string, endsAt: string, userId = "u1") => ({
  userId,
  startsAt,
  endsAt,
});

// 2030-03-01 is a Friday.
const dayFri = shift("2030-03-01T10:00:00Z", "2030-03-01T22:00:00Z"); // 07–19
const nightFri = shift("2030-03-01T22:00:00Z", "2030-03-02T10:00:00Z"); // 19–07
const fullSat = shift("2030-03-02T10:00:00Z", "2030-03-03T10:00:00Z"); // 24h Sat 07 → Sun 07
const earlyWed = shift("2030-03-06T06:00:00Z", "2030-03-06T12:00:00Z"); // 03–09

describe("nightMinutes (22:00–05:00 local)", () => {
  it("is zero for a day shift", () => {
    expect(nightMinutes(dayFri, SP)).toBe(0);
  });

  it("counts 7h for a 19–07 shift", () => {
    expect(nightMinutes(nightFri, SP)).toBe(420);
  });

  it("counts the window that started the evening before", () => {
    expect(nightMinutes(earlyWed, SP)).toBe(120);
  });

  it("counts one night in a 24h shift", () => {
    expect(nightMinutes(fullSat, SP)).toBe(420);
  });

  it("uses the organization's wall clock", () => {
    // 01:00Z–07:00Z is 22:00–04:00 in São Paulo but 21:00–03:00 in Manaus.
    const s = shift("2030-03-05T01:00:00Z", "2030-03-05T07:00:00Z");
    expect(nightMinutes(s, SP)).toBe(360);
    expect(nightMinutes(s, "America/Manaus")).toBe(300);
  });

  it("follows DST: the spring-forward night is 6h long", () => {
    // New York, 2026-03-07 19:00 EST → 2026-03-08 07:00 EDT (11h).
    const s = shift("2026-03-08T00:00:00Z", "2026-03-08T11:00:00Z");
    expect(nightMinutes(s, "America/New_York")).toBe(360);
  });
});

describe("weekendMinutes", () => {
  it("is zero on a weekday", () => {
    expect(weekendMinutes(dayFri, SP)).toBe(0);
  });

  it("counts only the Saturday part of a Friday night shift", () => {
    expect(weekendMinutes(nightFri, SP)).toBe(420);
  });

  it("counts a whole Saturday → Sunday shift", () => {
    expect(weekendMinutes(fullSat, SP)).toBe(1440);
  });
});

describe("summarizeHours", () => {
  it("adds up shifts per person", () => {
    const summary = summarizeHours(
      [dayFri, nightFri, shift(fullSat.startsAt, fullSat.endsAt, "u2")],
      SP,
    );
    expect(summary.get("u1")).toEqual({
      shifts: 2,
      totalMinutes: 1440,
      nightMinutes: 420,
      weekendMinutes: 420,
    });
    expect(summary.get("u2")).toEqual({
      shifts: 1,
      totalMinutes: 1440,
      nightMinutes: 420,
      weekendMinutes: 1440,
    });
  });

  it("returns an empty map for no shifts", () => {
    expect(summarizeHours([], SP).size).toBe(0);
  });
});
