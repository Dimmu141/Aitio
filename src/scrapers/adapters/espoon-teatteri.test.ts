import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDetail, parseList, parseShows, parseShowsId } from "./espoon-teatteri";

const fixture = (name: string) => readFileSync(`fixtures/espoon-teatteri/${name}`, "utf8");
const asOf = new Date("2026-10-18T12:00:00Z");

describe("Espoon Teatteri list", () => {
  // The repertoire page is an empty shell; this is the admin-ajax.php answer its script loads.
  it("reads the repertoire", () => {
    const list = parseList(fixture("ohjelmisto-ajax.html"));
    expect(list).toHaveLength(12);
    expect(list[0]).toEqual({
      externalId: "legend-of-harri-kala",
      title: "Legend of Harri Kala",
      url: "https://espoonteatteri.fi/ohjelmisto/legend-of-harri-kala/",
      isVisiting: false,
    });
  });
});

describe("Espoon Teatteri production page", () => {
  // The page itself has no performances: its script fetches them from admin-ajax.php.
  const kuoro = parseDetail(
    fixture("production-rakastavaisten-kuoro.html"),
    fixture("shows-rakastavaisten-kuoro.html"),
    { externalId: "rakastavaisten-kuoro", url: "https://espoonteatteri.fi/ohjelmisto/rakastavaisten-kuoro/", title: "x" },
    asOf,
  );
  const harriKala = parseDetail(
    fixture("production-legend-of-harri-kala.html"),
    fixture("shows-legend-of-harri-kala.html"),
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

  it("finds no performances in the page itself, so the adapter must ask the endpoint", () => {
    expect(parseShows(fixture("production-rakastavaisten-kuoro.html"), asOf).performances).toEqual([]);
  });

  it("skips rows whose weekday fits no nearby year", () => {
    const html = '<table class="event-performances"><tr><td><span class="date">ma 14.11.</span><span class="time">18.30</span></td></tr></table>';
    expect(parseShows(`<section class="event-performances">${html}</section>`, asOf).performances).toEqual([]);
  });
});

describe("Espoon Teatteri team table on a visiting production", () => {
  // Captured 2026-10-18: free-text cells with company names and a descriptive phrase.
  const madre = parseDetail(
    fixture("production-mi-madre-y-el-dinero.html"),
    null,
    { externalId: "mi-madre-y-el-dinero", url: "https://espoonteatteri.fi/ohjelmisto/mi-madre-y-el-dinero/", title: "x" },
    asOf,
  );
  const names = madre.credits.map((credit) => credit.name);

  it("keeps the person and drops the company after a slash", () => {
    expect(madre.credits).toContainEqual({ name: "Anacarsis Ramos", roleText: "Ohjaus", roles: ["DIRECTOR"] });
    expect(names.some((name) => name.includes("Pornotráfico"))).toBe(false);
  });

  it("drops phrases that aren't names and the producers", () => {
    expect(names.some((name) => name.includes("pohjalta"))).toBe(false);
    expect(names.some((name) => name.includes("Festival"))).toBe(false);
    expect(names).not.toContain("Fausto Cataño");
    expect(names).toContain("Josefina Orlaineta");
  });
});
