import { describe, expect, it } from "vitest";
import { hoursReportQuerySchema } from "@/lib/validation/reports";

const parse = (input: Record<string, unknown>) =>
  hoursReportQuerySchema.safeParse(input);

describe("hoursReportQuerySchema", () => {
  it("accepts a month, with or without a team", () => {
    expect(parse({ from: "2030-03-01", to: "2030-03-31" }).success).toBe(true);
    expect(
      parse({
        from: "2030-03-01",
        to: "2030-03-31",
        teamId: "c8000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(true);
  });

  it("accepts a single day and up to 93 days", () => {
    expect(parse({ from: "2030-03-01", to: "2030-03-01" }).success).toBe(true);
    expect(parse({ from: "2030-01-01", to: "2030-04-03" }).success).toBe(true);
  });

  it("rejects reversed or too long periods", () => {
    expect(parse({ from: "2030-03-31", to: "2030-03-01" }).success).toBe(false);
    expect(parse({ from: "2030-01-01", to: "2030-04-04" }).success).toBe(false);
  });

  it("rejects invalid dates and team ids", () => {
    expect(parse({ from: "2030-02-30", to: "2030-03-01" }).success).toBe(false);
    expect(parse({ to: "2030-03-01" }).success).toBe(false);
    expect(
      parse({ from: "2030-03-01", to: "2030-03-31", teamId: "x" }).success,
    ).toBe(false);
  });
});
