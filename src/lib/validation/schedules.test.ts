import { describe, expect, it } from "vitest";
import {
  createScheduleSchema,
  generateScheduleSchema,
  setScheduleCellSchema,
} from "@/lib/validation/schedules";

const UUID = "3f6c2a7e-8b1d-4c5e-9f0a-1b2c3d4e5f60";
const UUID2 = "4a7d3b8f-9c2e-4d6f-8a1b-2c3d4e5f6a70";

describe("createScheduleSchema", () => {
  const valid = {
    teamId: UUID,
    name: "UTI — novembro",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-30",
  };

  it("accepts a month", () => {
    expect(createScheduleSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["end before start", { periodEnd: "2026-10-31" }],
    ["longer than 62 days", { periodEnd: "2027-01-02" }],
    ["impossible date", { periodStart: "2026-02-30" }],
  ])("rejects %s", (_, override) => {
    expect(
      createScheduleSchema.safeParse({ ...valid, ...override }).success,
    ).toBe(false);
  });
});

describe("generateScheduleSchema", () => {
  it("rejects duplicated people and empty lists", () => {
    expect(
      generateScheduleSchema.safeParse({
        patternId: UUID,
        assignments: [
          { userId: UUID2, offset: 0 },
          { userId: UUID2, offset: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      generateScheduleSchema.safeParse({ patternId: UUID, assignments: [] })
        .success,
    ).toBe(false);
  });
});

describe("setScheduleCellSchema", () => {
  it("accepts clearing a day with null", () => {
    expect(
      setScheduleCellSchema.safeParse({
        userId: UUID,
        date: "2026-11-14",
        shiftTypeId: null,
      }).success,
    ).toBe(true);
  });
});
