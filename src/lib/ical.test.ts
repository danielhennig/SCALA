import { describe, expect, it } from "vitest";
import { buildICalendar, escapeText, foldLine, formatUtc } from "@/lib/ical";

const octets = (s: string) => new TextEncoder().encode(s).length;
const unfold = (s: string) => s.replaceAll("\r\n ", "");

describe("formatUtc", () => {
  it("converts any offset to a UTC basic-format timestamp", () => {
    expect(formatUtc("2030-01-10T07:00:00-03:00")).toBe("20300110T100000Z");
    expect(formatUtc(new Date("2030-12-31T23:59:59.999Z"))).toBe(
      "20301231T235959Z",
    );
  });
});

describe("escapeText", () => {
  it("escapes backslashes, semicolons, commas and newlines", () => {
    expect(escapeText("UTI, Ala B; noite\\turno\nlinha 2")).toBe(
      "UTI\\, Ala B\\; noite\\\\turno\\nlinha 2",
    );
  });

  it("drops control characters but keeps accents", () => {
    expect(escapeText("Plantão\u0000\u0007 São José\r\n")).toBe(
      "Plantão São José\\n",
    );
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Diurno")).toBe("SUMMARY:Diurno");
  });

  it("folds at 75 octets, continuation lines starting with a space", () => {
    const line = `SUMMARY:${"x".repeat(150)}`;
    const physical = foldLine(line).split("\r\n");
    expect(physical.length).toBe(3);
    expect(octets(physical[0])).toBe(75);
    expect(physical[1].startsWith(" ")).toBe(true);
    expect(physical.every((l) => octets(l) <= 75)).toBe(true);
    expect(unfold(foldLine(line))).toBe(line);
  });

  it("never splits a multi-byte character", () => {
    const line = `DESCRIPTION:${"ção 🚑 ".repeat(30)}`;
    const folded = foldLine(line);
    for (const physical of folded.split("\r\n")) {
      expect(octets(physical)).toBeLessThanOrEqual(75);
      // A split surrogate pair wouldn't survive a UTF-8 round trip.
      expect(new TextDecoder().decode(new TextEncoder().encode(physical))).toBe(
        physical,
      );
    }
    expect(unfold(folded)).toBe(line);
  });
});

describe("buildICalendar", () => {
  const now = new Date("2030-01-01T12:00:00Z");

  it("writes a calendar with one VEVENT per shift, CRLF-terminated", () => {
    const ics = buildICalendar({
      name: "SCALA · Meus plantões",
      now,
      events: [
        {
          uid: "e8000000-0000-0000-0000-000000000003@scala",
          startsAt: "2030-01-10T10:00:00+00:00",
          endsAt: "2030-01-10T22:00:00+00:00",
          summary: "Diurno · UTI",
          description: "Hospital\nEscala: UTI, janeiro",
        },
      ],
    });

    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replaceAll("\r\n", "")).not.toContain("\n");
    expect(ics.split("\r\n")).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SCALA//Escalas//PT-BR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:SCALA · Meus plantões",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
      "BEGIN:VEVENT",
      "UID:e8000000-0000-0000-0000-000000000003@scala",
      "DTSTAMP:20300101T120000Z",
      "DTSTART:20300110T100000Z",
      "DTEND:20300110T220000Z",
      "SUMMARY:Diurno · UTI",
      "DESCRIPTION:Hospital\\nEscala: UTI\\, janeiro",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ]);
  });

  it("is still a valid calendar with no shifts", () => {
    const ics = buildICalendar({ name: "Vazio", now, events: [] });
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("END:VCALENDAR\r\n");
    expect(ics).not.toContain("VEVENT");
  });
});
