import { describe, expect, it } from "vitest";
import { roleLooksLikeNames, sanityWarnings, titleKey, type SanityContext } from "./sanity";
import type { RawProduction, RawProductionDetail } from "./types";

const asOf = new Date("2026-10-19T12:00:00Z");
const context: SanityContext = { sourceId: "kom-teatteri", type: "PLAY", fullSchedule: true, asOf };
const ref: RawProduction = { externalId: "x", title: "POISKATSOJAT", url: "https://example.fi/x/", isVisiting: false };

function detail(overrides: Partial<RawProductionDetail> = {}): RawProductionDetail {
  return {
    externalId: "x",
    title: "Poiskatsojat",
    url: "https://example.fi/x/",
    languages: ["fi"],
    subtitleLangs: [],
    credits: [{ name: "Susanna Kuparinen", roleText: "Ohjaus", roles: ["DIRECTOR"] }],
    performances: [{ startsAt: new Date("2026-09-09T15:30:00Z") }, { startsAt: new Date("2026-10-20T15:30:00Z") }],
    criticReviews: [],
    isVisiting: false,
    performancesPartial: false,
    ...overrides,
  };
}

const rules = (value: RawProductionDetail, ctx = context) => sanityWarnings(ref, value, ctx).map((warning) => warning.rule);

describe("sanity warnings", () => {
  it("stays quiet on a complete production", () => {
    expect(rules(detail({ premiereDate: new Date("2026-09-09T00:00:00Z") }))).toEqual([]);
  });

  it("flags a recent premiere long before the first stored show (lost early dates)", () => {
    const lost = detail({ premiereDate: new Date("2026-09-09T00:00:00Z"), performances: [{ startsAt: new Date("2026-10-13T15:30:00Z") }] });
    expect(rules(lost)).toEqual(["premiere-before-run"]);
    expect(rules(lost, { ...context, fullSchedule: false })).toEqual([]);
    expect(rules({ ...lost, premiereDate: new Date("2025-12-06T00:00:00Z") })).toEqual([]); // old premiere
  });

  it("flags a running play without a director, but not dance", () => {
    expect(rules(detail({ credits: [] }))).toEqual(["no-director"]);
    expect(rules(detail({ credits: [] }), { ...context, type: "DANCE" })).toEqual([]);
  });

  it("flags names inside a role and labels stored as people", () => {
    const broken = detail({
      credits: [
        { name: "Susanna Kuparinen", roleText: "Ohjaus", roles: ["DIRECTOR"] },
        { name: "Taavi Hasunen", roleText: "Näyttämöllä Youssef Asad Alkhatib ja", roles: ["CAST"] },
        { name: "työryhmä", roleText: "Lavastussuunnittelu", roles: ["DESIGNER"] },
      ],
    });
    expect(rules(broken)).toEqual(["role-looks-like-names", "name-not-a-person"]);
  });

  it("flags no performances and a list title that names another show", () => {
    expect(rules(detail({ performances: [] }))).toEqual(["no-performances"]);
    expect(rules(detail({ title: "NAZA" }))).toEqual(["title-mismatch"]);
  });
});

describe("helpers", () => {
  it("tells role labels from names", () => {
    expect(roleLooksLikeNames("Lavastussuunnittelu ja esitysdramaturgia")).toBe(false);
    expect(roleLooksLikeNames("Teksti ja ohjaus")).toBe(false);
    expect(roleLooksLikeNames("Näyttämöllä Youssef Asad Alkhatib ja")).toBe(true);
    expect(roleLooksLikeNames("Rooleissa Anna Virtanen")).toBe(true);
  });

  it("ignores case, soft hyphens and punctuation in titles", () => {
    expect(titleKey("POIS­KAT­SO­JAT!")).toBe(titleKey("Poiskatsojat"));
  });
});
