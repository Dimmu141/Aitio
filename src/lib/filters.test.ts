import { describe, expect, it } from "vitest";
import { applyFilters, parseFilters } from "./filters";

const items = [
  { slug: "nattland", type: "PLAY", theatre: { city: "Helsinki" }, languages: ["sv"], subtitleLangs: ["fi", "en"] },
  { slug: "musikaali", type: "MUSICAL", theatre: { city: "Espoo" }, languages: ["fi"], subtitleLangs: [] },
] as const;
const list = items.map((item) => ({ ...item, languages: [...item.languages], subtitleLangs: [...item.subtitleLangs] }));

describe("parseFilters", () => {
  it("reads known values from the query string", () => {
    expect(parseFilters({ kaupunki: "Espoo", tyyppi: "play", kieli: "SV", tekstitys: "fi" }, ["Helsinki", "Espoo"])).toEqual({
      city: "Espoo",
      type: "PLAY",
      language: "sv",
      subtitles: "fi",
    });
  });

  it("drops unknown values instead of failing", () => {
    expect(parseFilters({ kaupunki: "Tampere", tyyppi: "circus", kieli: "de" }, ["Helsinki"])).toEqual({
      city: undefined,
      type: undefined,
      language: undefined,
      subtitles: undefined,
    });
  });
});

describe("applyFilters", () => {
  it("keeps productions matching every filter", () => {
    expect(applyFilters(list, { language: "sv", subtitles: "fi" }).map((item) => item.slug)).toEqual(["nattland"]);
    expect(applyFilters(list, { city: "Espoo" }).map((item) => item.slug)).toEqual(["musikaali"]);
    expect(applyFilters(list, {})).toHaveLength(2);
  });
});
