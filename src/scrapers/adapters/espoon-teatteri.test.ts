import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDetail, parseList, parseNextPage, parseShows, parseShowsId } from "./espoon-teatteri";

const fixture = (name: string) => readFileSync(`fixtures/espoon-teatteri/${name}`, "utf8");
const asOf = new Date("2026-10-18T12:00:00Z");

describe("Espoon Teatteri list", () => {
  it("reads the repertoire", () => {
    const list = parseList(fixture("ohjelmisto.html"));
    expect(list).toHaveLength(12);
    expect(list[0]).toEqual({
      externalId: "legend-of-harri-kala",
      title: "Legend of Harri Kala",
      url: "https://espoonteatteri.fi/ohjelmisto/legend-of-harri-kala/",
      isVisiting: false,
    });
  });

  it("sees that page 2 repeats page 1 (so paging stops there)", () => {
    expect(parseNextPage(fixture("ohjelmisto.html"))).toBe("https://espoonteatteri.fi/ohjelmisto/page/2/");
    const ids = (name: string) => parseList(fixture(name)).map((item) => item.externalId);
    expect(ids("ohjelmisto-page-2.html")).toEqual(ids("ohjelmisto.html"));
  });
});

describe("Espoon Teatteri production page", () => {
  const kuoro = parseDetail(
    fixture("production-rakastavaisten-kuoro.html"),
    null,
    { externalId: "rakastavaisten-kuoro", url: "https://espoonteatteri.fi/ohjelmisto/rakastavaisten-kuoro/", title: "x" },
    asOf,
  );
  const harriKala = parseDetail(
    fixture("production-legend-of-harri-kala.html"),
    null,
    { externalId: "legend-of-harri-kala", url: "https://espoonteatteri.fi/ohjelmisto/legend-of-harri-kala/", title: "x" },
    asOf,
  );

  it("reads the title despite the letter-by-letter animation markup", () => {
    expect(kuoro.title).toBe("Rakastavaisten kuoro");
  });

  it("reads the facts list", () => {
    expect(kuoro).toMatchObject({
      stage: "Revontuli",
      languages: ["fi"],
      subtitleLangs: [],
      runStart: new Date("2026-11-14T00:00:00Z"),
      runEnd: new Date("2026-12-30T00:00:00Z"),
      premiereDate: new Date("2026-11-14T16:30:00Z"),
      performancesPartial: true,
    });
    expect(harriKala).toMatchObject({ stage: "Louhi", languages: ["en"], subtitleLangs: [] });
  });

  it("dates performances by their weekday, with stage and ticket link", () => {
    expect(kuoro.performances).toHaveLength(5);
    expect(kuoro.performances[0]).toEqual({
      startsAt: new Date("2026-11-14T16:30:00Z"), // la 14.11. 18.30
      stage: "Revontuli",
      ticketUrl: "https://espoonteatteri.lippu.fi/webshop/webticket/shop?event=3081&language=fi",
    });
  });

  it("maps the team table, keeping assistants out of the director role", () => {
    const roles = (name: string) => kuoro.credits.find((credit) => credit.name === name)?.roles;
    expect(roles("Tiago Rodrigues")?.sort()).toEqual(["DIRECTOR", "WRITER"]);
    expect(roles("Jussi Sorjanen")).toEqual(["OTHER"]);
    expect(roles("Alma Pöysti")).toEqual(["CAST"]);
    expect(roles("Tarja Härkönen")).toEqual(["TRANSLATOR"]);
    expect(kuoro.credits.find((credit) => credit.name.includes("Kulttuurirahasto"))).toBeUndefined();
  });

  it("passes the genre to the classifier only", () => {
    expect(harriKala.subtitle).toBe("Peliesitys");
  });
});

describe("Espoon Teatteri shows endpoint", () => {
  it("finds the id the page posts to admin-ajax.php", () => {
    expect(parseShowsId(fixture("production-rakastavaisten-kuoro.html"))).toBe("341");
  });

  it("skips rows whose weekday fits no nearby year", () => {
    const html = '<table class="event-performances"><tr><td><span class="date">ma 14.11.</span><span class="time">18.30</span></td></tr></table>';
    expect(parseShows(`<section class="event-performances">${html}</section>`, asOf).performances).toEqual([]);
  });
});
