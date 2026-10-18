import { describe, expect, it } from "vitest";
import { formatCalendarDate, formatDate, formatPerformance, helsinkiDate } from "./format";

const asOf = new Date("2026-10-18T09:00:00Z");

describe("formatPerformance", () => {
  it("shows Helsinki summer time, not UTC", () => {
    expect(formatPerformance(new Date("2026-10-23T15:30:00Z"), "fi", asOf)).toBe("pe 23.10. klo 18.30");
  });

  it("shows Helsinki winter time after the DST change", () => {
    expect(formatPerformance(new Date("2026-12-19T16:30:00Z"), "fi", asOf)).toBe("la 19.12. klo 18.30");
  });

  it("adds the year for next year's dates", () => {
    expect(formatPerformance(new Date("2027-01-15T17:00:00Z"), "fi", asOf)).toBe("pe 15.1.2027 klo 19.00");
  });

  it("formats Swedish and English", () => {
    const date = new Date("2026-10-23T15:30:00Z");
    expect(formatPerformance(date, "sv", asOf)).toBe("fre 23.10 18:30");
    expect(formatPerformance(date, "en", asOf)).toBe("Fri 23/10, 18:30");
  });

  it("uses the Helsinki date near midnight", () => {
    // 22:30 UTC on the 23rd is already the 24th in Helsinki.
    expect(formatPerformance(new Date("2026-10-23T22:30:00Z"), "fi", asOf)).toBe("la 24.10. klo 01.30");
  });
});

describe("formatDate", () => {
  it("formats a long date", () => {
    expect(formatDate(new Date("2026-09-10T00:00:00Z"), "fi")).toBe("10. syyskuuta 2026");
    expect(formatDate(new Date("2026-09-10T00:00:00Z"), "sv")).toBe("10 september 2026");
  });
});

describe("helsinkiDate", () => {
  it("uses the Helsinki day, not the UTC one", () => {
    expect(helsinkiDate(new Date("2026-10-23T22:30:00Z"))).toBe("2026-10-24");
    expect(helsinkiDate(new Date("2026-10-23T15:30:00Z"))).toBe("2026-10-23");
  });
});

describe("formatCalendarDate", () => {
  it("does not shift a stored date", () => {
    expect(formatCalendarDate(new Date("2026-10-24T00:00:00Z"), "fi")).toBe("24. lokakuuta 2026");
  });
});
