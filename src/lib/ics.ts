/**
 * One performance as an iCalendar file (RFC 5545), for "Kalenteriin". Plain text in
 * a fixed format: every calendar app, phone or desktop, opens it without an account.
 */
export interface CalendarEvent {
  uid: string;
  start: Date;
  /** Only when the theatre states the running time; we don't invent an end. */
  minutes: number | null;
  title: string;
  location: string;
  url: string;
  description: string;
  stamp: Date;
}

const MAX_OCTETS = 75;

/** 20261024T160000Z */
export function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Commas, semicolons, backslashes and newlines are special in text values. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets continue on the next line after a space, never mid-character. */
export function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
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

export function performanceIcs(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aitio//omaaitio.fi//FI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(event.stamp)}`,
    `DTSTART:${icsDate(event.start)}`,
    ...(event.minutes ? [`DTEND:${icsDate(new Date(event.start.getTime() + event.minutes * 60_000))}`] : []),
    `SUMMARY:${escapeText(event.title)}`,
    `LOCATION:${escapeText(event.location)}`,
    `URL:${event.url}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
