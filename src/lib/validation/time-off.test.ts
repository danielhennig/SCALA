import { describe, expect, it } from "vitest";
import {
  createTimeOffSchema,
  reviewTimeOffSchema,
} from "@/lib/validation/time-off";

describe("createTimeOffSchema", () => {
  const valid = {
    kind: "vacation",
    startDate: "2026-11-10",
    endDate: "2026-11-20",
  };

  it("accepts a request for oneself (no userId) and single-day ranges", () => {
    expect(createTimeOffSchema.safeParse(valid).success).toBe(true);
    expect(
      createTimeOffSchema.safeParse({ ...valid, endDate: "2026-11-10" })
        .success,
    ).toBe(true);
  });

  it.each([
    ["end before start", { endDate: "2026-11-09" }],
    ["longer than a year", { endDate: "2027-11-20" }],
    ["unknown kind", { kind: "sabbatical" }],
    ["impossible date", { startDate: "2026-02-30" }],
  ])("rejects %s", (_, override) => {
    expect(
      createTimeOffSchema.safeParse({ ...valid, ...override }).success,
    ).toBe(false);
  });
});

describe("reviewTimeOffSchema", () => {
  it("only accepts approve or reject", () => {
    expect(reviewTimeOffSchema.safeParse({ status: "approved" }).success).toBe(
      true,
    );
    expect(reviewTimeOffSchema.safeParse({ status: "pending" }).success).toBe(
      false,
    );
  });
});
