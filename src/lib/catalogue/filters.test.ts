import { describe, expect, it } from "vitest";
import { applyFilters, filterOptions, filterQuery, hasFilters, parseFilters, SUBTITLE_FILTER_ENABLED } from "./filters";
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
    soon: [],
    duration: null,
    premiere: null,
    phase: "running",
    year: null,
    ...overrides,
  };
}

const cards = [
  card({ slug: "a", type: "PLAY", languages: ["fi"] }),
  card({ slug: "b", type: "CONCERT", languages: ["sv"], subtitleLangs: ["fi", "en"] }),
  card({ slug: "c", theatre: { slug: "e", name: "E", city: "Espoo" }, type: "MUSICAL" }),
];
// Monday 19 Oct 2026, noon in Helsinki.
const asOf = new Date("2026-10-19T09:00:00Z");
const options = filterOptions(cards, asOf);

describe("filterOptions", () => {
  it("never offers the classifier's don't-know as a type", () => {
    expect(filterOptions([card({ type: "OTHER" }), card({ type: "PLAY" })], asOf).type).toEqual(["PLAY"]);
  });

  it("lists only values that occur, in a stable order", () => {
    expect(options).toEqual({
      city: ["Espoo", "Helsinki"],
      type: ["PLAY", "MUSICAL", "CONCERT"],
      lang: ["fi", "sv", "english"],
      subs: SUBTITLE_FILTER_ENABLED ? ["en", "fi"] : [],
      when: [],
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
    expect(applyFilters(cards, { lang: "sv", subs: "fi" }, asOf).map((c) => c.slug)).toEqual(["b"]);
    expect(applyFilters(cards, { city: "Helsinki" }, asOf).map((c) => c.slug)).toEqual(["a", "b"]);
    expect(applyFilters(cards, {}, asOf)).toHaveLength(3);
  });

  it("reports whether anything is selected", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ type: "PLAY" })).toBe(true);
  });
});

describe("time chips", () => {
  const at = (iso: string) => new Date(iso);
  const daily = card({ slug: "daily", soon: [at("2026-10-19T16:00:00Z"), at("2026-10-20T16:00:00Z"), at("2026-10-24T13:00:00Z")] });
  const friday = card({ slug: "friday", soon: [at("2026-10-23T16:00:00Z")] });
  const list = [daily, friday];

  it("offers only the chips that match something", () => {
    expect(filterOptions(list, asOf).when).toEqual(["today", "tomorrow", "weekend", "week"]);
    expect(filterOptions([friday], asOf).when).toEqual(["weekend", "week"]);
  });

  it("moves each card to its first performance on those days", () => {
    const tomorrow = applyFilters(list, { when: "tomorrow" }, asOf);
    expect(tomorrow.map((c) => [c.slug, c.next])).toEqual([["daily", at("2026-10-20T16:00:00Z")]]);
    const weekend = applyFilters(list, { when: "weekend" }, asOf);
    expect(weekend.map((c) => [c.slug, c.next])).toEqual([
      ["daily", at("2026-10-24T13:00:00Z")],
      ["friday", at("2026-10-23T16:00:00Z")],
    ]);
  });

  it("reads the chip from the query string", () => {
    expect(parseFilters({ when: "weekend" }, filterOptions(list, asOf))).toEqual({ when: "weekend" });
    expect(parseFilters({ when: "today" }, filterOptions([friday], asOf))).toEqual({});
  });

  it("builds links that keep the other choices", () => {
    expect(filterQuery({ city: "Espoo", when: "today" }, { when: "weekend" })).toBe("?city=Espoo&when=weekend");
    expect(filterQuery({ city: "Espoo", when: "today" }, { when: undefined })).toBe("?city=Espoo");
    expect(filterQuery({})).toBe("");
  });
});

describe("understandable in English", () => {
  it("means spoken in English, without words, or with English subtitles", () => {
    const list = [
      card({ slug: "fi", languages: ["fi"] }),
      card({ slug: "en", languages: ["en"] }),
      card({ slug: "wordless", languages: ["zxx"] }),
      card({ slug: "surtitled", languages: ["it"], subtitleLangs: ["fi", "en"] }),
    ];
    expect(applyFilters(list, { lang: "english" }, asOf).map((c) => c.slug)).toEqual(["en", "wordless", "surtitled"]);
    expect(filterOptions(list, asOf).lang).toEqual(["en", "fi", "it", "english"]);
  });
});
