import { describe, expect, it } from "vitest";
import {
  effectiveType,
  isClosingSoon,
  isCurrent,
  knownEnd,
  currentProductionCount,
  lifecycle,
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
  it("is a clamped percentage from the premiere", () => {
    expect(runProgress(day(-10), null, day(10), asOf)).toBe(50);
    expect(runProgress(day(5), null, day(10), asOf)).toBe(0);
    expect(runProgress(day(-20), null, day(-10), asOf)).toBe(100);
  });

  it("falls back to the earliest performance seen, but only if it has happened", () => {
    expect(runProgress(null, day(-10), day(10), asOf)).toBe(50);
    expect(runProgress(null, day(5), day(10), asOf)).toBeNull();
  });

  it("is null without a usable range", () => {
    expect(runProgress(null, null, day(10), asOf)).toBeNull();
    expect(runProgress(day(10), null, day(10), asOf)).toBeNull();
  });
});

describe("lifecycle", () => {
  const facts = (over: Partial<Parameters<typeof lifecycle>[0]>) => ({
    next: null,
    performances: [],
    runStart: null,
    runEnd: null,
    premiereDate: null,
    delistedAt: null,
    ...over,
  });

  it("is running while performances are coming", () => {
    expect(lifecycle(facts({ next: day(3), performances: [{ startsAt: day(3) }] }), asOf)).toEqual({
      phase: "running",
      started: false,
      year: null,
    });
  });

  it("is upcoming when listed without any dates (Seitsemän veljestä, spring 2027)", () => {
    expect(lifecycle(facts({}), asOf)).toEqual({ phase: "upcoming", started: false, year: null });
  });

  it("is upcoming before a stated premiere, and cannot be logged yet", () => {
    expect(lifecycle(facts({ premiereDate: day(120) }), asOf)).toEqual({ phase: "upcoming", started: false, year: null });
  });

  it("is past only once the last known date has gone by", () => {
    const ended = facts({ performances: [{ startsAt: day(-40) }, { startsAt: day(-30) }] });
    expect(lifecycle(ended, asOf)).toEqual({ phase: "past", started: true, year: 2026 });
  });

  it("counts the theatre's own run dates when no performances were stored", () => {
    const svenska = facts({ premiereDate: new Date("2025-09-04"), runStart: day(-280), runEnd: day(-150) });
    expect(lifecycle(svenska, asOf).phase).toBe("past");
  });

  it("stays upcoming between batches of dates when the run has not ended", () => {
    expect(lifecycle(facts({ performances: [{ startsAt: day(-5) }], runEnd: day(60) }), asOf)).toEqual({
      phase: "upcoming",
      started: true,
      year: null,
    });
  });

  it("archives runs that ended over a year ago", () => {
    expect(lifecycle(facts({ runStart: new Date("2023-01-17"), runEnd: new Date("2023-03-04") }), asOf)).toEqual({
      phase: "archive",
      started: true,
      year: 2023,
    });
  });

  it("archives a delisted production that never had a date, and dates a delisted one by its past", () => {
    expect(lifecycle(facts({ delistedAt: day(-1) }), asOf).phase).toBe("archive");
    const cut = facts({ delistedAt: day(-1), performances: [{ startsAt: day(-10) }], runEnd: day(30) });
    expect(lifecycle(cut, asOf)).toEqual({ phase: "past", started: true, year: 2026 });
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

describe("known end and closing soon for partial schedules", () => {
  // Espoo lists only its next few dates: five shows within a week say nothing about the end.
  const listed = schedule([{ startsAt: day(1) }, { startsAt: day(3) }, { startsAt: day(6) }], asOf);

  it("uses the last listed date when the schedule is complete", () => {
    expect(knownEnd(day(6), day(60), true)).toEqual(day(6));
    expect(isClosingSoon(listed, null, true, asOf)).toBe(true);
  });

  it("uses only the theatre's end date when the schedule is partial", () => {
    expect(knownEnd(day(6), day(60), false)).toEqual(day(60));
    expect(knownEnd(day(6), null, false)).toBeNull();
    expect(isClosingSoon(listed, day(60), false, asOf)).toBe(false);
    expect(isClosingSoon(listed, null, false, asOf)).toBe(false);
  });

  it("is closing soon when the printed end falls within the window", () => {
    expect(isClosingSoon(listed, day(10), false, asOf)).toBe(true);
  });

  it("is not closing soon with nothing left to see", () => {
    expect(isClosingSoon(schedule([], asOf), day(10), false, asOf)).toBe(false);
  });
});

describe("currentProductionCount", () => {
  const seen = new Date("2026-10-18");
  const older = new Date("2026-09-01");
  const credit = (productionId: string, lastSeenAt = seen) => ({ productionId, lastSeenAt, production: { lastSeenAt: seen } });

  it("counts productions, not credits, and ignores stale ones", () => {
    // Writer and director of one show, plus a credit the theatre has since removed.
    expect(currentProductionCount([credit("a"), credit("a"), credit("b", older)])).toBe(1);
    expect(currentProductionCount([credit("a"), credit("b")])).toBe(2);
  });
});
