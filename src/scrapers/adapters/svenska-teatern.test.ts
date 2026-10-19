import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDetail, parseShowsJson } from "./svenska-teatern";

// Fixtures captured from the live site on 2026-10-18. Refresh with `pnpm fixtures:refresh`.
const fixture = (name: string) => readFileSync(`fixtures/svenska-teatern/${name}`, "utf8");

describe("Svenska Teatern REST list", () => {
  const list = parseShowsJson(fixture("shows-page-1.json"));

  it("maps REST items to productions", () => {
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list.find((item) => item.externalId === "34985")).toEqual({
      externalId: "34985",
      title: "Nattland",
      url: "https://svenskateatern.fi/repertoar/nattland/",
      isVisiting: false,
      // WordPress "modified" is Helsinki time without an offset.
      sourceUpdatedAt: new Date("2026-10-08T11:27:00Z"), // 14:27 in Helsinki; minutes are enough
    });
  });

  it("decodes unicode escapes and entities in titles", () => {
    const titles = list.map((item) => item.title);
    expect(titles).toContain("Änglagård");
    expect(titles).toContain("Georg Malmstén & HumppAvanti!");
  });

  it("decodes HTML entities that WordPress puts in rendered titles", () => {
    const [item] = parseShowsJson(
      JSON.stringify([{ id: 1, modified: "2026-01-01T00:00:00", link: "https://svenskateatern.fi/x/", title: { rendered: "Ted &amp; Kaj &#8211; live" } }]),
    );
    expect(item.title).toBe("Ted & Kaj – live");
  });
});

describe("Svenska Teatern production page", () => {
  const detail = parseDetail(fixture("production-nattland.html"), {
    externalId: "34985",
    url: "https://svenskateatern.fi/repertoar/nattland/",
    title: "Nattland",
  });

  it("reads the info box", () => {
    expect(detail.title).toBe("Nattland");
    expect(detail.stage).toBe("AMOS-scenen");
    expect(detail.durationText).toBe("ca 1 h 50 min, ingen paus");
    expect(detail.premiereDate?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(detail.runEnd?.toISOString()).toBe("2026-11-14T00:00:00.000Z");
    expect(detail.subtitleLangs.sort()).toEqual(["en", "fi", "sv"]);
  });

  it("reads performances from the embedded JSON with Tixly links", () => {
    expect(detail.performances).toHaveLength(7);
    expect(detail.performances[0]).toEqual({
      startsAt: new Date("2026-10-23T16:00:00.000Z"),
      stage: "AMOS-scenen",
      ticketUrl: "https://biljetter.svenskateatern.fi/sv/buyingflow/tickets/12275/9322/",
    });
  });

  it("reads team and ensemble with character names, without duplicates", () => {
    expect(detail.credits).toContainEqual({ name: "Anna-Maria Lipponen", roleText: "Regi", roles: ["DIRECTOR"] });
    expect(detail.credits).toContainEqual({ name: "Marius von Mayenburg", roleText: "Av", roles: ["WRITER"] });
    expect(detail.credits).toContainEqual({ name: "Sonia Haga", roleText: "Ensemble", roles: ["CAST"], characterName: "Evamaria" });
    expect(detail.credits.filter((credit) => credit.roles.includes("CAST"))).toHaveLength(8);
    expect(detail.credits.some((credit) => /Acency North/.test(credit.name))).toBe(false);
  });
});
