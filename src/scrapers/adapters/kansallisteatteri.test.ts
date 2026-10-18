import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDetail, parseList } from "./kansallisteatteri";

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
