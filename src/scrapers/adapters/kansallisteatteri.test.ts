import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDetail, parseList, subtitleLanguages } from "./kansallisteatteri";

// Fixtures captured from the live site on 2026-10-18. Refresh with `pnpm fixtures:refresh`.
const fixture = (name: string) => readFileSync(`fixtures/kansallisteatteri/${name}`, "utf8");

describe("Kansallisteatteri list page", () => {
  const list = parseList(fixture("list-esitykset-a-o.html"));

  it("finds every production once", () => {
    expect(list).toHaveLength(21);
    expect(new Set(list.map((item) => item.externalId)).size).toBe(list.length);
  });

  it("reads title, slug, stage and absolute URL", () => {
    const item = list.find((production) => production.externalId === "viidakon-villit-naiset");
    expect(item).toMatchObject({
      title: "Viidakon villit naiset",
      stageHint: "Suuri näyttämö",
      url: "https://www.kansallisteatteri.fi/esitys/viidakon-villit-naiset",
      isVisiting: false,
    });
  });

  it("marks guest productions listed under the visiting heading", () => {
    const visiting = list.filter((production) => production.isVisiting).map((production) => production.title);
    expect(visiting).toContain("Starman");
    expect(visiting).not.toContain("Seitsemän veljestä");
  });
});

describe("Kansallisteatteri production page", () => {
  const detail = parseDetail(fixture("production-viidakon-villit-naiset.html"), {
    externalId: "viidakon-villit-naiset",
    url: "https://www.kansallisteatteri.fi/esitys/viidakon-villit-naiset",
    isVisiting: false,
  });

  it("reads the basic facts", () => {
    expect(detail.title).toBe("Viidakon villit naiset");
    expect(detail.stage).toBe("Suuri näyttämö");
    expect(detail.durationText).toBe("2 h 45 min (sisältää väliajan)");
  });

  it("reads every performance with a correct Helsinki time and Lippu.fi link", () => {
    expect(detail.performances).toHaveLength(19);
    const first = detail.performances[0];
    expect(first.startsAt.toISOString()).toBe("2026-10-23T15:30:00.000Z");
    expect(first.ticketUrl).toMatch(/^https:\/\/www\.lippu\.fi\/event\//);
    expect(detail.runEnd?.toISOString()).toBe("2026-12-19T16:30:00.000Z");
  });

  it("does not double count the mobile and desktop copies of each row", () => {
    const times = detail.performances.map((performance) => performance.startsAt.getTime());
    expect(new Set(times).size).toBe(times.length);
  });

  it("reads the working group and the cast", () => {
    expect(detail.credits).toContainEqual({
      name: "Kristian Smeds",
      roleText: "Ohjaus ja käsikirjoitus",
      roles: ["DIRECTOR", "WRITER"],
    });
    expect(detail.credits.some((credit) => credit.name === "Hannu-Pekka Björkman" && credit.roles.includes("CAST"))).toBe(true);
  });

  it("reads critic review links with outlet and critic", () => {
    expect(detail.criticReviews.length).toBeGreaterThanOrEqual(5);
    expect(detail.criticReviews).toContainEqual({
      outlet: "Kansan Uutiset",
      critic: "Mika Pekkola",
      url: "https://www.ku.fi/artikkeli/5446878-viidakon-villit-naiset-osoittaa-etta-huipulla-voi-olla-yksinaista",
    });
  });
});

describe("Kansallisteatteri subtitles", () => {
  // Captured 2026-10-18: subtitles at every performance except the Saturday matinee on 12.12.
  const ladyT = parseDetail(fixture("production-lady-t.html"), {
    externalId: "lady-t-0",
    url: "https://www.kansallisteatteri.fi/esitys/lady-t-0",
    isVisiting: false,
  });

  it("marks each performance by its own subtitle indicator", () => {
    expect(ladyT.performances).toHaveLength(10);
    const withSubtitles = ladyT.performances.filter((performance) => performance.subtitleLangs?.length);
    expect(withSubtitles).toHaveLength(9);
    expect(withSubtitles[0].subtitleLangs).toEqual(["fi", "en"]);
    const matinee = ladyT.performances.find((performance) => performance.startsAt.toISOString() === "2026-12-12T11:00:00.000Z");
    expect(matinee?.subtitleLangs).toEqual([]);
  });

  it("keeps the production-wide list empty when not every performance has them", () => {
    expect(ladyT.subtitleLangs).toEqual([]);
  });

  it("has no subtitles where the page shows no indicator", () => {
    const viidakko = parseDetail(fixture("production-viidakon-villit-naiset.html"), {
      externalId: "viidakon-villit-naiset",
      url: "https://www.kansallisteatteri.fi/esitys/viidakon-villit-naiset",
      isVisiting: false,
    });
    expect(viidakko.subtitleLangs).toEqual([]);
    expect(viidakko.performances.every((performance) => performance.subtitleLangs?.length === 0)).toBe(true);
  });

  it("reads the languages from the sentence about subtitles only", () => {
    expect(subtitleLanguages("Esityksessä on suomen- ja englanninkielinen tekstitys\nKesto: n. 1 h")).toEqual(["fi", "en"]);
    expect(
      subtitleLanguages(
        "Kesto 2 h 50 min. Tekstitys saatavilla englanniksi ja suomeksi (Subtitle Mobile -sovellus) valituissa näytännöissä. Esitys on ruotsinkielisen romaanin sovitus.",
      ),
    ).toEqual(["fi", "en"]);
    expect(subtitleLanguages("Kesto 2 h 15 min (sisältää väliajan)")).toEqual([]);
  });
});
