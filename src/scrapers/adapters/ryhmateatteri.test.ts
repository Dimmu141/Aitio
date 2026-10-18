import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { helsinkiWeekday } from "../text";
import { parseDetail, parseRestList, parseRun, parseSubtitleRule } from "./ryhmateatteri";

const fixture = (name: string) => readFileSync(`fixtures/ryhmateatteri/${name}`, "utf8");

describe("Ryhmäteatteri list", () => {
  it("keeps the Finnish post and drops its English twin", () => {
    expect(parseRestList(fixture("artist-page-1.json"))).toEqual([
      {
        externalId: "6382",
        title: "Äitisi, Klytaimestra",
        url: "https://www.ryhmateatteri.fi/ohjelma/aitisi-klytaimestra/",
        isVisiting: false,
      },
    ]);
  });
});

describe("Ryhmäteatteri production page", () => {
  const detail = parseDetail(fixture("production-aitisi-klytaimestra.html"), {
    externalId: "6382",
    url: "https://www.ryhmateatteri.fi/ohjelma/aitisi-klytaimestra/",
    title: "Äitisi, Klytaimestra",
  });

  it("reads the facts", () => {
    expect(detail).toMatchObject({
      title: "Äitisi, Klytaimestra",
      stage: "Hesari",
      durationText: "2h 5 min, sisältäen väliajan",
      languages: ["fi"],
      runStart: new Date("2026-10-06T00:00:00Z"),
    });
  });

  it("reads performances with the year from the month headings", () => {
    expect(detail.performances).toHaveLength(24);
    expect(detail.performances[0]).toMatchObject({
      startsAt: new Date("2026-10-21T15:30:00Z"), // ke 21.10. klo 18.30
      stage: "Hesari",
      ticketUrl: "https://www.tiketti.fi/tapahtuma/118087",
    });
    expect(detail.runEnd).toEqual(detail.performances.at(-1)?.startsAt);
  });

  it("puts subtitles on Wednesday and Friday performances only", () => {
    expect(detail.subtitleLangs).toEqual([]);
    for (const performance of detail.performances) {
      const day = helsinkiWeekday(performance.startsAt);
      expect(performance.subtitleLangs).toEqual(day === 3 || day === 5 ? ["fi", "en"] : undefined);
    }
  });

  it("splits a cast line into people and maps combined roles", () => {
    const roles = (name: string) => detail.credits.filter((credit) => credit.name === name).flatMap((credit) => credit.roles);
    expect(roles("Minna Lund").sort()).toEqual(["DIRECTOR", "WRITER"]);
    expect(detail.credits.filter((credit) => credit.roles.includes("CAST")).map((credit) => credit.name)).toEqual([
      "Santtu Karvonen",
      "Sonja Kuittinen",
      "Minna Suuronen",
      "Robin Svartström",
    ]);
    expect(detail.credits.find((credit) => credit.name === "Nordic Drama Corner")).toBeUndefined();
  });

  it("keeps critic links with tidied names, never headlines or quotes", () => {
    expect(detail.criticReviews[0]).toEqual({
      outlet: "Apu",
      critic: "Selina Keränen",
      url: "https://www.apu.fi/artikkelit/aitisi-klytaimestra-poistuin-ryhmateatterista-haikaistyneena",
    });
    expect(detail.criticReviews.find((review) => review.critic === "Hanna Helavuori")?.outlet).toBe("hannahelavuori.com");
    expect(JSON.stringify(detail.criticReviews)).not.toContain("häikäistyneenä");
  });
});

describe("helpers", () => {
  it("reads a weekday subtitle rule", () => {
    expect(parseSubtitleRule("Tekstitys englanniksi keskiviikkoisin.")).toEqual({ langs: ["en"], weekdays: [3] });
    expect(parseSubtitleRule("Tekstitys ruotsiksi.")).toEqual({ langs: ["sv"], weekdays: [] });
    expect(parseSubtitleRule("Ei tekstitystä tiedossa")).toBeNull();
  });

  it("infers the run's year, including runs over New Year", () => {
    expect(parseRun("6.10.–28.11.", new Date("2026-10-21T15:30:00Z"))).toEqual({
      start: new Date("2026-10-06T00:00:00Z"),
      end: new Date("2026-11-28T00:00:00Z"),
    });
    expect(parseRun("15.11.–10.2.", new Date("2027-01-10T15:00:00Z"))).toEqual({
      start: new Date("2026-11-15T00:00:00Z"),
      end: new Date("2027-02-10T00:00:00Z"),
    });
  });
});
