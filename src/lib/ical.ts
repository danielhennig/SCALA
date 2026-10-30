// Minimal iCalendar (RFC 5545) writer for read-only subscription feeds. Times
// are written in UTC ("Z"), so no VTIMEZONE block is needed: calendar apps
// convert to the viewer's zone.

export type CalendarEvent = {
  /** Globally unique and stable across refreshes, so apps update in place. */
  uid: string;
  startsAt: string;
  endsAt: string;
  summary: string;
  description?: string;
};

const MAX_LINE_OCTETS = 75;
const encoder = new TextEncoder();

/** "2030-01-10T07:00:00-03:00" → "20300110T100000Z" */
export function formatUtc(instant: string | Date): string {
  return new Date(instant)
    .toISOString()
    .replace(/\.\d{3}/, "")
    .replace(/[-:]/g, "");
}

/** Escapes a TEXT value (RFC 5545 §3.3.11) and drops control characters. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
}

/**
 * Folds a content line at 75 octets (RFC 5545 §3.1): continuation lines start
 * with a space. Splits between code points, never inside a UTF-8 sequence.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // The leading space of a continuation line counts toward its 75.
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildICalendar({
  name,
  events,
  now,
}: {
  name: string;
  events: readonly CalendarEvent[];
  /** DTSTAMP: when this copy of the feed was generated. */
  now: Date;
}): string {
  const stamp = formatUtc(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SCALA//Escalas//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    // Refresh hints (RFC 7986 and Apple/Outlook). Google ignores both and
    // refreshes on its own schedule, usually every few hours.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtc(event.startsAt)}`,
      `DTEND:${formatUtc(event.endsAt)}`,
      `SUMMARY:${escapeText(event.summary)}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
