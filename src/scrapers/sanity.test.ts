import { describe, expect, it } from "vitest";
import { roleLooksLikeNames, sanityWarnings, titleKey, type SanityContext } from "./sanity";
import type { RawCredit, RawProduction, RawProductionDetail } from "./types";

// Every string below is from the dry run of all sources on 19 Oct 2026.
const asOf = new Date("2026-10-19T12:00:00Z");
const context: SanityContext = { sourceId: "kom-teatteri", type: "PLAY", asOf };
const ref: RawProduction = { externalId: "x", title: "POISKATSOJAT", url: "https://example.fi/x/", isVisiting: false };

const director: RawCredit = { name: "Susanna Kuparinen", roleText: "Ohjaus", roles: ["DIRECTOR"] };
const actor: RawCredit = { name: "Tuuli Paju", roleText: "Näyttämöllä", roles: ["CAST"] };
const designer: RawCredit = { name: "Saara Ryymin", roleText: "Pukusuunnittelu", roles: ["DESIGNER"] };

function detail(overrides: Partial<RawProductionDetail> = {}): RawProductionDetail {
  return {
    externalId: "x",
    title: "Poiskatsojat",
    url: "https://example.fi/x/",
    languages: ["fi"],
    subtitleLangs: [],
    credits: [director, actor, designer],
    performances: [{ startsAt: new Date("2026-10-20T15:30:00Z") }],
    criticReviews: [],
    isVisiting: false,
    performancesPartial: false,
    ...overrides,
  };
}

const rules = (value: RawProductionDetail, ctx = context, listed = ref) =>
  sanityWarnings(listed, value, ctx).map((warning) => warning.rule);

describe("sanity warnings", () => {
  it("stays quiet on a complete production", () => {
    expect(rules(detail())).toEqual([]);
  });

  it("flags a running play without cast (KOM) or with only performers (Änglagård)", () => {
    expect(rules(detail({ credits: [designer] }))).toEqual(["missing-team"]);
    expect(rules(detail({ credits: [actor, actor] }))).toEqual(["missing-team"]);
    expect(rules(detail({ credits: [] }), { ...context, type: "DANCE" })).toEqual([]);
    expect(rules(detail({ credits: [designer], performances: [] }))).toEqual([]); // not playing
  });

  it("leaves devised work without a director alone (Gob Squad, Collage)", () => {
    expect(rules(detail({ credits: [actor, designer] }))).toEqual([]);
  });

  it("flags names inside a role and things stored as people", () => {
    const broken = detail({
      credits: [
        director,
        designer,
        { name: "Taavi Hasunen", roleText: "Näyttämöllä Youssef Asad Alkhatib ja", roles: ["CAST"] },
        { name: "Linnea Sjunnesson och Fredrik Fischer", roleText: "Översättning", roles: ["OTHER"] },
        { name: "Colombine teaterförlag", roleText: "Rättigheter", roles: ["OTHER"] },
        { name: "Mats Forss, Jesper Karlsson", roleText: "Ljusdesign", roles: ["DESIGNER"] },
      ],
    });
    expect(rules(broken)).toEqual(["role-looks-like-names", "name-not-a-person", "name-not-a-person", "name-not-a-person"]);
  });

  it("flags a list card that names another show, not a shortened title", () => {
    const listed = (title: string) => ({ ...ref, title });
    expect(rules(detail({ title: "Hej sommaren!" }), context, listed("Arne Alligator & Djungeltrumman"))).toEqual(["title-mismatch"]);
    expect(rules(detail({ title: "NAZA" }), context, listed("LUKUREIVIT"))).toEqual(["title-mismatch"]);
    expect(rules(detail({ title: "Klockriketeatern: Divan" }), context, listed("Divan"))).toEqual([]);
    expect(rules(detail({ title: "KAJ" }), context, listed("KAJ – karar i arbeit"))).toEqual([]);
    expect(rules(detail({ title: "Sås & Kopp jubeliumskonsert – encore!" }), context, listed("Sås och Kopp jubeliumskonsert"))).toEqual([]);
  });
});

describe("helpers", () => {
  it("tells names from lists of role labels", () => {
    expect(roleLooksLikeNames("Näyttämöllä Youssef Asad Alkhatib ja")).toBe(true);
    expect(roleLooksLikeNames("Sonja Ahlfors, Joanna Wingren, Willjam Tigerstedt, Vega Adsten, Edit Williams")).toBe(true);
    expect(roleLooksLikeNames("Regi, Scenografi, Kostym")).toBe(false);
    expect(roleLooksLikeNames("Koreografi ja ohjaaja, Pukusuunnittelija, Tanssijat")).toBe(false);
    expect(roleLooksLikeNames("Lavastussuunnittelu ja esitysdramaturgia")).toBe(false);
  });

  it("ignores case, soft hyphens, punctuation and joining words in titles", () => {
    expect(titleKey("POIS­KAT­SO­JAT!")).toBe(titleKey("Poiskatsojat"));
    expect(titleKey("Sås & Kopp")).toBe(titleKey("Sås och Kopp"));
  });
});
