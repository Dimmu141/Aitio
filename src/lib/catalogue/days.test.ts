import { describe, expect, it } from "vitest";
import { groupByNextDay, premieresSoon } from "./days";
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
    soon: [],
    duration: null,
    premiere: null,
    phase: "running",
    year: null,
  };
}

// Sunday 18 Oct 2026, 23:30 in Helsinki (UTC+3).
const asOf = new Date("2026-10-18T20:30:00Z");

describe("groupByNextDay", () => {
  it("groups by the Helsinki day, in date and time order", () => {
    const days = groupByNextDay(
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
    expect(groupByNextDay([card("night", "2026-10-19T22:30:00Z")], asOf)[0].date).toBe("2026-10-20");
  });

  it("leaves out productions with nothing upcoming", () => {
    expect(groupByNextDay([card("past", null)], asOf)).toEqual([]);
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
});
