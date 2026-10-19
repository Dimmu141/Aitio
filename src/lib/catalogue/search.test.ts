import { describe, expect, it } from "vitest";
import { isEmpty, normalise, search, type SearchIndex } from "./search";
import type { ProductionCard } from "./types";

function card(slug: string, title: string, next: string | null, year: number | null = null): ProductionCard {
  return {
    slug,
    title,
    theatre: { slug: "t", name: "T", city: "Helsinki" },
    stage: null,
    type: "PLAY",
    languages: ["fi"],
    subtitleLangs: [],
    next: next ? new Date(next) : null,
    last: null,
    soon: [],
    duration: null,
    premiere: null,
    end: null,
    onSoon: true,
    closingSoon: false,
    phase: next ? "running" : "past",
    year,
  };
}

const index: SearchIndex = {
  productions: [
    card("lokki-2019", "Lokki", null, 2019),
    card("lokki", "Lokki", "2026-11-02T16:00:00Z"),
    card("kolmen-soolon-juhla", "Alpo Aaltokoski Company: Kolmen soolon juhla", "2026-10-27T16:30:00Z"),
    card("kirsikkatarha", "Kirsikkatarha", "2026-10-21T16:00:00Z"),
    card("molieren-saituri", "Molièren Saituri", "2026-10-22T16:00:00Z"),
  ],
  people: [
    { slug: "elina-hayrynen", name: "Elina Häyrynen", productions: 2 },
    { slug: "elina-knihtila", name: "Elina Knihtilä", productions: 5 },
  ],
  theatres: [{ slug: "kansallisteatteri", name: "Kansallisteatteri", city: "Helsinki" }],
};

describe("search", () => {
  it("forgives accents and case both ways", () => {
    expect(normalise("Molière: SAITURI")).toBe("moliere saituri");
    expect(search(index, "hayrynen")?.people.map((p) => p.slug)).toEqual(["elina-hayrynen"]);
    expect(search(index, "MOLIEREN")?.productions.map((p) => p.slug)).toEqual(["molieren-saituri"]);
  });

  it("needs every word, in any order", () => {
    expect(search(index, "juhla aaltokoski")?.productions.map((p) => p.slug)).toEqual(["kolmen-soolon-juhla"]);
    expect(search(index, "aaltokoski lokki")?.productions).toEqual([]);
  });

  it("puts exact titles first, and the running production before an old one", () => {
    expect(search(index, "lokki")?.productions.map((p) => p.slug)).toEqual(["lokki", "lokki-2019"]);
    expect(search(index, "k")).toBeNull();
  });

  it("ranks people with more work first when the match is equal", () => {
    expect(search(index, "elina")?.people.map((p) => p.slug)).toEqual(["elina-knihtila", "elina-hayrynen"]);
  });

  it("finds theatres and reports an empty result", () => {
    expect(search(index, "kansallis")?.theatres).toHaveLength(1);
    const none = search(index, "zzzz");
    expect(none && isEmpty(none)).toBe(true);
  });
});
