import { describe, expect, it } from "vitest";
import { applySwap, swapRestWarnings } from "@/domain/scheduling/swap";

// São Paulo 07–19 = 10:00Z–22:00Z; 19–07 = 22:00Z–10:00Z (+1).
const shift = (
  id: string,
  userId: string,
  startsAt: string,
  endsAt: string,
) => ({
  id,
  userId,
  startsAt,
  endsAt,
});

const brunoDay5 = shift(
  "b5",
  "bruno",
  "2030-01-05T10:00:00Z",
  "2030-01-05T22:00:00Z",
);
const evaNight5 = shift(
  "e5",
  "eva",
  "2030-01-05T22:00:00Z",
  "2030-01-06T10:00:00Z",
);
const evaDay8 = shift(
  "e8",
  "eva",
  "2030-01-08T10:00:00Z",
  "2030-01-08T22:00:00Z",
);
const brunoDay7 = shift(
  "b7",
  "bruno",
  "2030-01-07T10:00:00Z",
  "2030-01-07T22:00:00Z",
);

describe("applySwap", () => {
  it("coverage moves only the offered shift", () => {
    const after = applySwap([brunoDay5, evaDay8], {
      offeredShiftId: "b5",
      requesterId: "bruno",
      targetId: "eva",
      requestedShiftId: null,
    });
    expect(after.map((s) => s.userId)).toEqual(["eva", "eva"]);
  });

  it("an exchange moves both shifts", () => {
    const after = applySwap([brunoDay7, evaDay8], {
      offeredShiftId: "b7",
      requesterId: "bruno",
      targetId: "eva",
      requestedShiftId: "e8",
    });
    expect(after.map((s) => [s.id, s.userId])).toEqual([
      ["b7", "eva"],
      ["e8", "bruno"],
    ]);
  });
});

describe("swapRestWarnings", () => {
  it("warns when covering leaves the colleague with 0h of rest", () => {
    const warnings = swapRestWarnings(
      [brunoDay5, evaNight5],
      {
        offeredShiftId: "b5",
        requesterId: "bruno",
        targetId: "eva",
        requestedShiftId: null,
      },
      11 * 60,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ userId: "eva", restMinutes: 0 });
  });

  it("does not blame the swap for violations it doesn't touch", () => {
    // eva already has 0h rest between e5 and a day shift on the 6th.
    const evaDay6 = shift(
      "e6",
      "eva",
      "2030-01-06T10:00:00Z",
      "2030-01-06T22:00:00Z",
    );
    const warnings = swapRestWarnings(
      [evaNight5, evaDay6, brunoDay7, evaDay8],
      {
        offeredShiftId: "b7",
        requesterId: "bruno",
        targetId: "eva",
        requestedShiftId: "e8",
      },
      11 * 60,
    );
    expect(warnings).toEqual([]);
  });
});
