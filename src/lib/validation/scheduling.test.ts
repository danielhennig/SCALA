import { describe, expect, it } from "vitest";
import {
  rotationPatternSchema,
  shiftTypeSchema,
} from "@/lib/validation/scheduling";

const UUID = "3f6c2a7e-8b1d-4c5e-9f0a-1b2c3d4e5f60";

describe("shiftTypeSchema", () => {
  const valid = {
    name: "Noturno",
    startTime: "19:00",
    durationMinutes: 720,
    color: "#4F46E5",
  };

  it("accepts a night shift and lowercases the color", () => {
    expect(shiftTypeSchema.parse(valid).color).toBe("#4f46e5");
  });

  it.each([
    ["startTime", "7:00"],
    ["startTime", "24:00"],
    ["durationMinutes", 10],
    ["durationMinutes", 1441],
    ["durationMinutes", 90.5],
    ["color", "blue"],
    ["name", "N"],
  ])("rejects invalid %s %j", (field, value) => {
    expect(
      shiftTypeSchema.safeParse({ ...valid, [field]: value }).success,
    ).toBe(false);
  });
});

describe("rotationPatternSchema", () => {
  it("accepts a 12x36 cycle (shift, day off)", () => {
    expect(
      rotationPatternSchema.safeParse({ name: "12x36", days: [UUID, null] })
        .success,
    ).toBe(true);
  });

  it.each([
    ["empty cycle", []],
    ["only days off", [null, null]],
    ["29 days", Array(29).fill(UUID)],
    ["non-uuid", ["abc"]],
  ])("rejects %s", (_, days) => {
    expect(
      rotationPatternSchema.safeParse({ name: "Regime", days }).success,
    ).toBe(false);
  });
});
