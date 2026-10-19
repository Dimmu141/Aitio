import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authorCredits, parseDetail, parseList, subtitleLanguages, textBlockCredits } from "./kansallisteatteri";

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
      paywalled: false,
      feature: false,
    });
  });

  it("tells a paywalled review from a feature by the link text", () => {
    const hs = detail.criticReviews.filter((review) => review.outlet === "Helsingin Sanomat");
    expect(hs.map(({ critic, paywalled, feature }) => ({ critic, paywalled, feature }))).toEqual([
      { critic: "Maria Säkö", paywalled: true, feature: false },
      { critic: "Sanna Kangasniemi", paywalled: false, feature: true },
    ]);
    expect(detail.criticReviews.filter((review) => review.feature).map((review) => review.outlet).sort()).toEqual([
      "Helsingin Sanomat",
      "MTV Uutiset",
      "YLE",
    ]);
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

describe("Kansallisteatteri premiere", () => {
  const detail = (slug: string, file: string) =>
    parseDetail(fixture(file), { externalId: slug, url: `https://www.kansallisteatteri.fi/esitys/${slug}`, isVisiting: false });

  it("reads the stated premiere, which stays on the page after it has passed", () => {
    // "Kantaesitys Maalaamosalissa 15.4.2026"; the run now listed starts in October.
    expect(detail("lady-t-0", "production-lady-t.html").premiereDate).toEqual(new Date("2026-04-15T00:00:00Z"));
    expect(detail("viidakon-villit-naiset", "production-viidakon-villit-naiset.html").premiereDate).toEqual(
      new Date("2026-09-16T00:00:00Z"),
    );
  });

  it("does not take a preview for the premiere", () => {
    // Previews from 14.11.; the row of 18.11. is marked "Ensi-ilta", as is the bold line.
    const taru = detail("taru-hohtavasta-helmesta", "production-taru-hohtavasta-helmesta.html");
    expect(taru.performances[0].startsAt).toEqual(new Date("2026-11-14T11:00:00Z"));
    expect(taru.premiereDate).toEqual(new Date("2026-11-18T00:00:00Z"));
  });

  it("falls back to the performance row marked Ensi-ilta", () => {
    const html = fixture("production-taru-hohtavasta-helmesta.html").replace("<strong>Kantaesitys ", "<strong>");
    const taru = parseDetail(html, { externalId: "taru", url: "https://www.kansallisteatteri.fi/esitys/taru", isVisiting: false });
    expect(taru.premiereDate).toEqual(new Date("2026-11-18T16:30:00Z")); // klo 18:30
  });

  it("leaves it unset for a premiere elsewhere", () => {
    // "Kantaesitys oli Tampereen Työväen Teatterissa 23.1.2025."
    expect(detail("karpaset", "production-karpaset.html").premiereDate).toBeUndefined();
  });
});

describe("Kansallisteatteri authors", () => {
  // Captured 2026-10-19: no dates yet, premieres spring 2027.
  const detail = parseDetail(fixture("production-seitseman-veljesta.html"), {
    externalId: "seitseman-veljesta",
    url: "https://www.kansallisteatteri.fi/esitys/seitseman-veljesta",
    isVisiting: false,
  });

  it("credits the original author and the dramatisation separately", () => {
    expect(detail.credits[0]).toEqual({ name: "Aleksis Kivi", roleText: "", roles: ["WRITER"] });
    expect(detail.credits).toContainEqual({
      name: "Mika Myllyaho",
      roleText: "Ohjaus ja dramatisointi",
      roles: ["DIRECTOR", "ADAPTATION"],
    });
    expect(detail.credits.filter((credit) => credit.roles.includes("WRITER")).map((credit) => credit.name)).toEqual([
      "Aleksis Kivi",
    ]);
  });

  it("reads bare names and labelled lines, and skips prose", () => {
    expect(authorCredits("Sirkku Peltola ja Juha Jokela")).toEqual([
      { name: "Sirkku Peltola", roleText: "", roles: ["WRITER"] },
      { name: "Juha Jokela", roleText: "", roles: ["WRITER"] },
    ]);
    expect(authorCredits("Perustuu Aili Somersalon teokseen Mestaritontun seikkailut<br />\n<br />\nDramatisointi Minna Leino")).toEqual([
      { name: "Minna Leino", roleText: "Dramatisointi", roles: ["ADAPTATION"] },
    ]);
    expect(authorCredits("Kantaesitys Suurella näyttämöllä")).toEqual([]);
    expect(authorCredits("Valo Ahonen")).toEqual([{ name: "Valo Ahonen", roleText: "", roles: ["WRITER"] }]);
  });

  it("does not repeat an author the team list already credits for the text", () => {
    const smeds = parseDetail(fixture("production-viidakon-villit-naiset.html"), {
      externalId: "viidakon-villit-naiset",
      url: "https://www.kansallisteatteri.fi/esitys/viidakon-villit-naiset",
      isVisiting: false,
    });
    expect(smeds.credits.filter((credit) => credit.name === "Kristian Smeds")).toHaveLength(1);
  });
});

describe("Kansallisteatteri guest runs", () => {
  // Kärpäset has no team list, only a "Työryhmä" text block with bold labels.
  const karpaset = parseDetail(fixture("production-karpaset.html"), {
    externalId: "karpaset",
    url: "https://www.kansallisteatteri.fi/esitys/karpaset",
    isVisiting: true,
  });

  it("reads the team from the text block", () => {
    expect(karpaset.credits.filter((credit) => credit.roles.includes("CAST")).map((credit) => credit.name)).toEqual([
      "Petra Ahola",
      "Aimo Räsänen",
      "Martti Suosalo",
    ]);
    expect(karpaset.credits).toContainEqual({ name: "Sirkku Peltola", roleText: "Käsikirjoitus ja ohjaus", roles: ["DIRECTOR", "WRITER"] });
  });

  it("skips the producing company", () => {
    expect(karpaset.credits.map((credit) => credit.name)).not.toContain("ATR-tuotanto Oy");
  });

  it("splits names on commas and 'ja'", () => {
    expect(textBlockCredits("<p><strong>Rooleissa</strong> A Aa, B Bb ja C Cc</p>").map((credit) => credit.name)).toEqual(["A Aa", "B Bb", "C Cc"]);
  });
});
