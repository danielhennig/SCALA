import { describe, expect, it } from "vitest";
import {
  localDate,
  localDayBounds,
  localTime,
  zonedDateTimeToUtc,
} from "@/domain/scheduling/zoned";

const SP = "America/Sao_Paulo";

describe("zoned time conversions", () => {
  it("converts local wall-clock time to UTC per time zone", () => {
    expect(zonedDateTimeToUtc("2026-11-01", "07:00", SP).toISOString()).toBe(
      "2026-11-01T10:00:00.000Z",
    );
    expect(
      zonedDateTimeToUtc("2026-11-01", "19:00", "America/Manaus").toISOString(),
    ).toBe("2026-11-01T23:00:00.000Z");
  });

  it("maps a UTC instant back to the local date and time", () => {
    // 02:30Z on Nov 2 is still Nov 1, 23:30 in São Paulo.
    expect(localDate("2026-11-02T02:30:00Z", SP)).toBe("2026-11-01");
    expect(localTime("2026-11-02T02:30:00Z", SP)).toBe("23:30");
  });

  it("gives the UTC bounds of a local day", () => {
    const { start, end } = localDayBounds("2026-11-01", SP);
    expect(start.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T03:00:00.000Z");
  });

  it("handles a DST day (23 hours) correctly", () => {
    // New York springs forward on 2026-03-08.
    const { start, end } = localDayBounds("2026-03-08", "America/New_York");
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });
});
