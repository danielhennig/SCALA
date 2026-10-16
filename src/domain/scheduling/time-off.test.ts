import { describe, expect, it } from "vitest";
import { excludeTimeOff, isOnTimeOff } from "@/domain/scheduling/time-off";

const vacation = {
  userId: "a",
  startDate: "2026-11-10",
  endDate: "2026-11-20",
};

describe("isOnTimeOff", () => {
  it("is inclusive on both ends", () => {
    expect(isOnTimeOff([vacation], "a", "2026-11-10")).toBe(true);
    expect(isOnTimeOff([vacation], "a", "2026-11-20")).toBe(true);
    expect(isOnTimeOff([vacation], "a", "2026-11-09")).toBe(false);
    expect(isOnTimeOff([vacation], "a", "2026-11-21")).toBe(false);
  });

  it("only applies to the person on time off", () => {
    expect(isOnTimeOff([vacation], "b", "2026-11-15")).toBe(false);
  });

  it("works across month boundaries", () => {
    const range = {
      userId: "a",
      startDate: "2026-11-28",
      endDate: "2026-12-03",
    };
    expect(isOnTimeOff([range], "a", "2026-12-01")).toBe(true);
  });
});

describe("excludeTimeOff", () => {
  it("skips shifts on days off and keeps everything else", () => {
    const shifts = [
      { userId: "a", date: "2026-11-09" },
      { userId: "a", date: "2026-11-11" },
      { userId: "b", date: "2026-11-11" },
      { userId: "a", date: "2026-11-21" },
    ];
    const { kept, skipped } = excludeTimeOff(shifts, [vacation]);
    expect(skipped).toEqual([{ userId: "a", date: "2026-11-11" }]);
    expect(kept).toHaveLength(3);
  });

  it("keeps everything when nobody is on time off", () => {
    const shifts = [{ userId: "a", date: "2026-11-11" }];
    expect(excludeTimeOff(shifts, []).kept).toEqual(shifts);
  });
});
