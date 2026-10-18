import { describe, expect, it } from "vitest";
import { escapeText, fold, icsDate, performanceIcs } from "./ics";

const event = {
  uid: "lokki-1792886400@omaaitio.fi",
  start: new Date("2026-10-24T16:00:00Z"),
  minutes: 150,
  title: "Lokki",
  location: "Kansallisteatteri, Suuri näyttämö",
  url: "https://omaaitio.fi/esitys/lokki",
  description: "Liput: https://example.fi/liput\nhttps://omaaitio.fi/esitys/lokki",
  stamp: new Date("2026-10-18T20:00:00Z"),
};

describe("performanceIcs", () => {
  const ics = performanceIcs(event);
  const unfolded = ics.replace(/\r\n /g, "");

  it("writes a complete event in UTC with CRLF line ends", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("\r\nDTSTART:20261024T160000Z\r\n");
    expect(ics).toContain("\r\nDTEND:20261024T183000Z\r\n");
    expect(ics).toContain("\r\nLOCATION:Kansallisteatteri\\, Suuri näyttämö\r\n");
    expect(unfolded).toContain("\r\nDESCRIPTION:Liput: https://example.fi/liput\\nhttps://omaaitio.fi/esitys/lokki\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("leaves the end out when the running time isn't known", () => {
    expect(performanceIcs({ ...event, minutes: null })).not.toContain("DTEND");
  });
});

describe("helpers", () => {
  it("formats dates and escapes text", () => {
    expect(icsDate(new Date("2026-03-01T09:05:00.123Z"))).toBe("20260301T090500Z");
    expect(escapeText("a;b,c\\d")).toBe("a\;b\\,c\\\\d");
  });

  it("folds at 75 octets without splitting a character", () => {
    const long = `SUMMARY:${"ä".repeat(80)}`;
    const lines = fold(long).split("\r\n");
    const encoder = new TextEncoder();
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(lines.map((line, i) => (i === 0 ? line : line.slice(1))).join("")).toBe(long);
    expect(fold("SHORT")).toBe("SHORT");
  });
});
