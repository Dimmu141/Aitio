import { describe, expect, it } from "vitest";
import { applyFilters, filterOptions, hasFilters, parseFilters, SUBTITLE_FILTER_ENABLED } from "./filters";
import type { ProductionCard } from "./types";

function card(overrides: Partial<ProductionCard>): ProductionCard {
  return {
    slug: "x",
    title: "X",
    theatre: { slug: "t", name: "T", city: "Helsinki" },
    stage: null,
    type: "PLAY",
    languages: ["fi"],
    subtitleLangs: [],
    next: null,
    last: null,
    end: null,
    onSoon: true,
    closingSoon: false,
    year: null,
    ...overrides,
  };
}

const cards = [
  card({ slug: "a", type: "PLAY", languages: ["fi"] }),
  card({ slug: "b", type: "CONCERT", languages: ["sv"], subtitleLangs: ["fi", "en"] }),
  card({ slug: "c", theatre: { slug: "e", name: "E", city: "Espoo" }, type: "MUSICAL" }),
];
const options = filterOptions(cards);

describe("filterOptions", () => {
  it("never offers the classifier's don't-know as a type", () => {
    expect(filterOptions([card({ type: "OTHER" }), card({ type: "PLAY" })]).type).toEqual(["PLAY"]);
  });

  it("lists only values that occur, in a stable order", () => {
    expect(options).toEqual({
      city: ["Espoo", "Helsinki"],
      type: ["PLAY", "MUSICAL", "CONCERT"],
      lang: ["fi", "sv"],
      subs: SUBTITLE_FILTER_ENABLED ? ["en", "fi"] : [],
    });
  });
});

describe("parseFilters", () => {
  it("keeps known values and drops the rest", () => {
    expect(parseFilters({ city: "Espoo", type: "OPERA", lang: ["sv", "fi"], subs: "de", utm: "x" }, options)).toEqual({
      city: "Espoo",
      lang: "sv",
    });
  });
});

describe("applyFilters", () => {
  it("ignores the subtitle choice while that filter is off", () => {
    expect(parseFilters({ subs: "fi" }, options)).toEqual(SUBTITLE_FILTER_ENABLED ? { subs: "fi" } : {});
  });

  it("combines filters with AND", () => {
    expect(applyFilters(cards, { lang: "sv", subs: "fi" }).map((c) => c.slug)).toEqual(["b"]);
    expect(applyFilters(cards, { city: "Helsinki" }).map((c) => c.slug)).toEqual(["a", "b"]);
    expect(applyFilters(cards, {})).toHaveLength(3);
  });

  it("reports whether anything is selected", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ type: "PLAY" })).toBe(true);
  });
});
