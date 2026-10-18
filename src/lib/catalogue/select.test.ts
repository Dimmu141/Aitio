import { describe, expect, it } from "vitest";
import {
  effectiveType,
  isCurrent,
  lastYear,
  runProgress,
  schedule,
  summariseRatings,
  upcomingPerformances,
} from "./select";

const asOf = new Date("2026-10-18T09:00:00Z");
const scraped = new Date("2026-10-18T03:00:00Z");
const earlier = new Date("2026-10-10T03:00:00Z");
const day = (n: number) => new Date(asOf.getTime() + n * 86_400_000);

describe("isCurrent", () => {
  it("compares against the production's latest scrape", () => {
    expect(isCurrent({ lastSeenAt: scraped }, { lastSeenAt: scraped })).toBe(true);
    expect(isCurrent({ lastSeenAt: earlier }, { lastSeenAt: scraped })).toBe(false);
  });
});

describe("effectiveType", () => {
  it("prefers the manual override", () => {
    expect(effectiveType({ type: "CONCERT", typeOverride: "MUSICAL" })).toBe("MUSICAL");
    expect(effectiveType({ type: "PLAY", typeOverride: null })).toBe("PLAY");
  });
});

describe("upcomingPerformances", () => {
  it("drops past and vanished performances and sorts the rest", () => {
    const rows = [
      { startsAt: day(3), lastSeenAt: scraped },
      { startsAt: day(-1), lastSeenAt: scraped },
      { startsAt: day(1), lastSeenAt: earlier }, // cancelled: no longer on the theatre's page
      { startsAt: day(2), lastSeenAt: scraped },
    ];
    expect(upcomingPerformances(rows, { lastSeenAt: scraped }, asOf).map((row) => row.startsAt)).toEqual([day(2), day(3)]);
  });
});

describe("schedule", () => {
  it("is on soon and closing soon when the whole remaining run fits the window", () => {
    expect(schedule([{ startsAt: day(2) }, { startsAt: day(9) }], asOf)).toEqual({
      next: day(2),
      last: day(9),
      onSoon: true,
      closingSoon: true,
    });
  });

  it("is on soon but not closing when the run continues", () => {
    expect(schedule([{ startsAt: day(2) }, { startsAt: day(40) }], asOf)).toMatchObject({ onSoon: true, closingSoon: false });
  });

  it("is neither when the next date is beyond the window", () => {
    expect(schedule([{ startsAt: day(20) }], asOf)).toMatchObject({ onSoon: false, closingSoon: false });
  });

  it("handles no performances", () => {
    expect(schedule([], asOf)).toEqual({ next: null, last: null, onSoon: false, closingSoon: false });
  });
});

describe("runProgress", () => {
  it("is a clamped percentage", () => {
    expect(runProgress(day(-10), day(10), asOf)).toBe(50);
    expect(runProgress(day(5), day(10), asOf)).toBe(0);
    expect(runProgress(day(-20), day(-10), asOf)).toBe(100);
  });

  it("is null without a usable range", () => {
    expect(runProgress(null, day(10), asOf)).toBeNull();
    expect(runProgress(day(10), day(10), asOf)).toBeNull();
  });
});

describe("lastYear", () => {
  it("takes the latest known date", () => {
    expect(lastYear([new Date("2023-03-01"), null, new Date("2024-01-05")])).toBe(2024);
    expect(lastYear([null, undefined])).toBeNull();
  });
});

describe("summariseRatings", () => {
  it("buckets half stars and hides the average below ten ratings", () => {
    const summary = summariseRatings([0.5, 4, 4, 5]);
    expect(summary.count).toBe(4);
    expect(summary.buckets[0]).toBe(1);
    expect(summary.buckets[7]).toBe(2);
    expect(summary.buckets[9]).toBe(1);
    expect(summary.average).toBeNull();
  });

  it("shows a one-decimal average from ten ratings", () => {
    expect(summariseRatings([...Array(9).fill(4), 3]).average).toBe(3.9);
  });
});
