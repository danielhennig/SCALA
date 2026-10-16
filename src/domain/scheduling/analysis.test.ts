import { describe, expect, it } from "vitest";
import {
  findRestViolations,
  totalMinutesByUser,
} from "@/domain/scheduling/analysis";

const shift = (userId: string, startsAt: string, endsAt: string) => ({
  userId,
  startsAt,
  endsAt,
});

describe("findRestViolations", () => {
  const dayOne = shift("a", "2026-11-01T10:00:00Z", "2026-11-01T22:00:00Z");
  const dayTwo = shift("a", "2026-11-02T10:00:00Z", "2026-11-02T22:00:00Z");

  it("flags rest shorter than the minimum (12h < 13h)", () => {
    expect(findRestViolations([dayOne, dayTwo], 11 * 60)).toEqual([]);
    expect(findRestViolations([dayOne, dayTwo], 13 * 60)).toEqual([
      { userId: "a", before: dayOne, after: dayTwo, restMinutes: 720 },
    ]);
  });

  it("reports overlaps as negative rest", () => {
    const overlapping = shift(
      "a",
      "2026-11-01T20:00:00Z",
      "2026-11-02T08:00:00Z",
    );
    const [violation] = findRestViolations([dayOne, overlapping], 0);
    expect(violation.restMinutes).toBe(-120);
  });

  it("does not compare different people and ignores input order", () => {
    const other = shift("b", "2026-11-01T22:00:00Z", "2026-11-02T10:00:00Z");
    expect(findRestViolations([dayTwo, other, dayOne], 11 * 60)).toEqual([]);
  });
});

describe("totalMinutesByUser", () => {
  it("sums durations per person", () => {
    const totals = totalMinutesByUser([
      shift("a", "2026-11-01T10:00:00Z", "2026-11-01T22:00:00Z"),
      shift("a", "2026-11-03T10:00:00Z", "2026-11-04T10:00:00Z"),
      shift("b", "2026-11-01T10:00:00Z", "2026-11-01T16:00:00Z"),
    ]);
    expect(totals.get("a")).toBe(36 * 60);
    expect(totals.get("b")).toBe(6 * 60);
  });
});
