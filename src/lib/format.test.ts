import { describe, expect, it } from "vitest";
import { formatDay, formatPerformance, formatWeekdayDay } from "./format";

const now = new Date("2026-10-18T09:00:00Z");

describe("Finnish date formatting", () => {
  it("formats a performance in Helsinki wall-clock time", () => {
    expect(formatPerformance(new Date("2026-10-23T16:00:00Z"), now)).toBe("pe 23.10. klo 19.00");
  });

  it("handles winter time after the DST change", () => {
    expect(formatPerformance(new Date("2026-11-14T17:00:00Z"), now)).toBe("la 14.11. klo 19.00");
  });

  it("adds the year only when it is not the current one", () => {
    expect(formatDay(new Date("2026-09-10T00:00:00Z"), now)).toBe("10.9.");
    expect(formatDay(new Date("2027-01-15T12:00:00Z"), now)).toBe("15.1.2027");
  });

  it("prefixes the weekday", () => {
    expect(formatWeekdayDay(new Date("2026-11-14T12:00:00Z"), now)).toBe("la 14.11.");
  });
});
