import { describe, expect, it } from "vitest";
import { findRestViolations } from "@/domain/scheduling/analysis";
import { generateShifts, suggestOffsets } from "@/domain/scheduling/generate";

const SP = "America/Sao_Paulo";
const day = { id: "D", startTime: "07:00", durationMinutes: 720 };
const night = { id: "N", startTime: "19:00", durationMinutes: 720 };
const full = { id: "F", startTime: "07:00", durationMinutes: 1440 };

const november = { from: "2026-11-01", to: "2026-11-30", timeZone: SP };

describe("generateShifts", () => {
  it("12x36 group A works odd days, starting at 07:00 local (10:00Z)", () => {
    const shifts = generateShifts({
      ...november,
      cycle: [day, null],
      assignments: [{ userId: "a", offset: 0 }],
    });
    expect(shifts).toHaveLength(15);
    expect(shifts[0]).toEqual({
      userId: "a",
      shiftTypeId: "D",
      startsAt: "2026-11-01T10:00:00.000Z",
      endsAt: "2026-11-01T22:00:00.000Z",
      date: "2026-11-01",
    });
    expect(shifts.at(-1)?.date).toBe("2026-11-29");
  });

  it("A/B groups together cover every day exactly once", () => {
    const shifts = generateShifts({
      ...november,
      cycle: [day, null],
      assignments: suggestOffsets(["a", "b"], 2),
    });
    const dates = shifts.map((s) => s.date).sort();
    expect(dates).toHaveLength(30);
    expect(new Set(dates).size).toBe(30);
  });

  it("the last night of the period ends the next month", () => {
    const shifts = generateShifts({
      ...november,
      cycle: [night, null],
      assignments: [{ userId: "b", offset: 1 }],
    });
    const last = shifts.at(-1)!;
    expect(last.date).toBe("2026-11-30");
    expect(last.startsAt).toBe("2026-11-30T22:00:00.000Z");
    expect(last.endsAt).toBe("2026-12-01T10:00:00.000Z");
  });

  it("12x36 nights keep exactly 36h of rest (no violations at 36h)", () => {
    const shifts = generateShifts({
      ...november,
      cycle: [night, null],
      assignments: [{ userId: "a", offset: 0 }],
    });
    expect(findRestViolations(shifts, 36 * 60)).toEqual([]);
    expect(findRestViolations(shifts, 36 * 60 + 1)).toHaveLength(14);
  });

  it("24x72 gives 8 shifts in 30 days", () => {
    const shifts = generateShifts({
      ...november,
      cycle: [full, null, null, null],
      assignments: [{ userId: "a", offset: 0 }],
    });
    expect(shifts.map((s) => s.date.slice(8))).toEqual([
      "01",
      "05",
      "09",
      "13",
      "17",
      "21",
      "25",
      "29",
    ]);
  });

  it("offsets wrap around the cycle (2 ≡ 0 and -1 ≡ 1 in a 2-day cycle)", () => {
    const run = (offset: number) =>
      generateShifts({
        ...november,
        cycle: [day, null],
        assignments: [{ userId: "a", offset }],
      }).map((s) => s.date);
    expect(run(2)).toEqual(run(0));
    expect(run(-1)).toEqual(run(1));
  });

  it("uses the organization's time zone", () => {
    const [first] = generateShifts({
      ...november,
      timeZone: "America/Manaus",
      cycle: [day],
      assignments: [{ userId: "a", offset: 0 }],
    });
    expect(first.startsAt).toBe("2026-11-01T11:00:00.000Z");
  });

  it("returns nothing for an empty cycle or no people", () => {
    expect(
      generateShifts({
        ...november,
        cycle: [],
        assignments: [{ userId: "a", offset: 0 }],
      }),
    ).toEqual([]);
    expect(
      generateShifts({ ...november, cycle: [day], assignments: [] }),
    ).toEqual([]);
  });
});

describe("suggestOffsets", () => {
  it("spreads people round-robin over the cycle", () => {
    expect(suggestOffsets(["a", "b", "c"], 2).map((a) => a.offset)).toEqual([
      0, 1, 0,
    ]);
  });
});
