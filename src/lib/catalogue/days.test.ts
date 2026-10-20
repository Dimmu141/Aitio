import { describe, expect, it } from "vitest";
import { helsinkiToUtc } from "@/scrapers/text";
import { groupByDay, premieresSoon } from "./days";
import type { ProductionCard } from "./types";

function card(slug: string, next: string | null): ProductionCard {
  const date = next ? new Date(next) : null;
  return {
    slug,
    title: slug,
    theatre: { slug: "t", name: "T", city: "Helsinki" },
    stage: null,
    type: "PLAY",
    languages: ["fi"],
    subtitleLangs: [],
    next: date,
    last: date,
    end: date,
    onSoon: true,
    closingSoon: false,
    soon: date ? [date] : [],
    duration: null,
    premiere: null,
    phase: "running",
    year: null,
  };
}

// Sunday 18 Oct 2026, 23:30 in Helsinki (UTC+3).
const asOf = new Date("2026-10-18T20:30:00Z");

function multi(slug: string, starts: string[]): ProductionCard {
  const dates = starts.map((start) => new Date(start));
  return { ...card(slug, starts[0]), soon: dates, last: dates.at(-1) ?? null };
}

describe("groupByDay", () => {
  // Third review (20 Oct 2026): Saturday 24.10 listed Miniooppera Reininkulta four times.
  it("gives a production one card a day, with every time that day", () => {
    const reininkulta = multi("reininkulta", [
      "2026-10-24T08:00:00Z",
      "2026-10-24T11:00:00Z",
      "2026-10-24T09:00:00Z",
      "2026-10-24T10:00:00Z",
      "2026-10-25T09:00:00Z",
    ]);
    const days = groupByDay([reininkulta, card("other", "2026-10-24T08:30:00Z")], asOf);
    const saturday = days.find((day) => day.date === "2026-10-24");
    expect(saturday?.cards.map((c) => c.slug)).toEqual(["reininkulta", "other"]);
    expect(saturday?.cards[0].times.map((time) => time.toISOString())).toEqual([
      "2026-10-24T08:00:00.000Z", // 11.00 Helsinki
      "2026-10-24T09:00:00.000Z",
      "2026-10-24T10:00:00.000Z",
      "2026-10-24T11:00:00.000Z",
    ]);
    expect(saturday?.cards[0].next).toEqual(new Date("2026-10-24T08:00:00Z"));
    expect(days.find((day) => day.date === "2026-10-25")?.cards[0].times).toHaveLength(1);
  });

  // Clocks go back at 04.00 on Sunday 25 Oct 2026 (UTC+3 → UTC+2): a 25-hour day.
  it("keeps every performance of the DST change day on that Sunday", () => {
    const sunday = ["00:30", "13:00", "23:30"].map((time) => helsinkiToUtc("2026-10-25", time));
    expect(sunday[1]).toEqual(new Date("2026-10-25T11:00:00Z")); // 13.00 is UTC+2 after the change
    const days = groupByDay(
      sunday.map((startsAt, index) => card(`sun-${index}`, startsAt.toISOString())),
      asOf,
    );
    expect(days.map((day) => [day.date, day.cards.map((c) => c.slug)])).toEqual([["2026-10-25", ["sun-0", "sun-1", "sun-2"]]]);
  });

  it("groups by the Helsinki day, in date and time order", () => {
    const days = groupByDay(
      [
        card("late-today", "2026-10-18T20:45:00Z"),
        card("tue", "2026-10-20T15:30:00Z"),
        card("mon-evening", "2026-10-19T15:30:00Z"),
        card("mon-matinee", "2026-10-19T10:00:00Z"),
      ],
      asOf,
    );
    expect(days.map((day) => [day.date, day.relative, day.cards.map((c) => c.slug)])).toEqual([
      ["2026-10-18", "today", ["late-today"]],
      ["2026-10-19", "tomorrow", ["mon-matinee", "mon-evening"]],
      ["2026-10-20", null, ["tue"]],
    ]);
  });

  it("puts a show after midnight UTC on the right Helsinki day", () => {
    // 22:30 UTC on the 19th is already the 20th in Helsinki.
    expect(groupByDay([card("night", "2026-10-19T22:30:00Z")], asOf)[0].date).toBe("2026-10-20");
  });

  it("leaves out productions with nothing upcoming", () => {
    expect(groupByDay([card("past", null)], asOf)).toEqual([]);
  });

  it("lists a show on every day it plays, each at its own time", () => {
    const twoNights = { ...card("two-nights", "2026-10-19T15:30:00Z"), soon: [new Date("2026-10-19T15:30:00Z"), new Date("2026-10-20T16:00:00Z")] };
    const days = groupByDay([twoNights], asOf);
    expect(days.map((day) => [day.date, day.cards.map((c) => c.next?.toISOString())])).toEqual([
      ["2026-10-19", ["2026-10-19T15:30:00.000Z"]],
      ["2026-10-20", ["2026-10-20T16:00:00.000Z"]],
    ]);
  });
});

describe("premieresSoon", () => {
  const withPremiere = (slug: string, premiere: string | null) => ({ ...card(slug, "2026-10-25T16:00:00Z"), premiere: premiere ? new Date(premiere) : null });

  it("keeps stated premieres from today to the end of the window, earliest first", () => {
    const cards = [
      withPremiere("later", "2026-10-29T00:00:00Z"),
      withPremiere("today", "2026-10-18T00:00:00Z"), // a date-only premiere earlier today still counts
      withPremiere("past", "2026-10-10T00:00:00Z"),
      withPremiere("beyond", "2026-11-20T00:00:00Z"),
      withPremiere("unknown", null),
    ];
    expect(premieresSoon(cards, asOf).map((c) => c.slug)).toEqual(["today", "later"]);
  });

  it("counts new stagings only, not stand-up or concert nights (Monsterit Stand Up Show)", () => {
    const night = (slug: string, type: ProductionCard["type"]) => ({ ...withPremiere(slug, "2026-10-20T00:00:00Z"), type });
    const cards = [night("standup", "STANDUP"), night("concert", "CONCERT"), night("event", "OTHER"), night("dance", "DANCE"), night("opera", "OPERA")];
    expect(premieresSoon(cards, asOf).map((c) => c.slug)).toEqual(["dance", "opera"]);
  });
});
