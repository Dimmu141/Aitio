import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCredits, parseDetail, parseList, parsePageDates } from "./q-teatteri";

const fixture = (name: string) => readFileSync(`fixtures/q-teatteri/${name}`, "utf8");
const asOf = new Date("2026-10-18T00:00:00Z");
const ref = (externalId: string) => ({ externalId, url: `https://www.q-teatteri.fi/esitykset/${externalId}`, title: externalId });

describe("Q-teatteri list", () => {
  it("reads the current productions, not news, gift cards or the archive", () => {
    expect(parseList(fixture("esitykset.html"))).toEqual([
      {
        externalId: "aukeema---nayttamoessee",
        title: "Aukeema – näyttämöessee",
        url: "https://www.q-teatteri.fi/esitykset/aukeema---nayttamoessee",
        isVisiting: false,
      },
      { externalId: "suliko", title: "Suliko", url: "https://www.q-teatteri.fi/esitykset/suliko", isVisiting: false },
    ]);
  });
});

describe("Q-teatteri month rows (Suliko)", () => {
  const detail = parseDetail(fixture("production-suliko.html"), ref("suliko"), asOf);

  it("reads title, main stage, duration and the Tiketti link", () => {
    expect(detail).toMatchObject({
      title: "Suliko",
      stage: "Q-teatteri",
      durationText: "n. 2h 50min, sisältäen väliajan",
      ticketUrl: "https://www.tiketti.fi/tapahtuma/116661",
      languages: ["fi"],
      performancesPartial: false,
    });
  });

  it("dates every day in the month rows with the season's year and the starred time", () => {
    expect(detail.performances).toHaveLength(44); // 45 listed, one cancelled
    expect(detail.performances[0]).toEqual({ startsAt: new Date("2026-09-21T15:30:00Z"), stage: "Q-teatteri" }); // 18:30 EEST
    const starred = detail.performances.find((performance) => performance.startsAt.toISOString().startsWith("2026-10-03"));
    expect(starred?.startsAt).toEqual(new Date("2026-10-03T11:00:00Z")); // 3* → 14:00
    expect(detail.performances.at(-1)?.startsAt).toEqual(new Date("2026-12-11T16:30:00Z")); // 18:30 EET
    expect(detail.premiereDate).toEqual(new Date("2026-09-23T15:30:00Z"));
  });

  it("drops the cancelled performance", () => {
    expect(detail.performances.some((performance) => performance.startsAt.toISOString().startsWith("2026-09-26"))).toBe(false);
  });

  it("splits credits without colons and skips photographers", () => {
    expect(detail.credits.slice(0, 3).map((credit) => [credit.name, credit.roles])).toEqual([
      ["Pirkko Saisio", ["WRITER"]],
      ["Juho Mantere", ["DIRECTOR"]],
      ["Lotta Kaihua", ["CAST"]],
    ]);
    expect(detail.credits.filter((credit) => credit.roles.includes("CAST"))).toHaveLength(7);
    expect(detail.credits.map((credit) => credit.name)).not.toContain("Antti Sepponen");
  });
});

describe("Q-teatteri date lines (Aukeema)", () => {
  const detail = parseDetail(fixture("production-aukeema.html"), ref("aukeema---nayttamoessee"), asOf);

  it("reads the named stage and one performance per line", () => {
    expect(detail.stage).toBe("Puoli-Q");
    expect(detail.performances).toHaveLength(10);
    expect(detail.performances[0]).toEqual({ startsAt: new Date("2026-11-28T16:00:00Z"), stage: "Puoli-Q" });
    expect(detail.premiereDate).toEqual(new Date("2026-11-28T16:00:00Z"));
    expect(detail.performances.map((performance) => performance.startsAt.toISOString())).toContain("2026-12-05T11:00:00.000Z");
  });

  it("reads 'Role: Name, Name ja Name' credits, 'Esiintyjät' as cast", () => {
    expect(detail.credits.find((credit) => credit.roleText === "Ohjaaja")).toMatchObject({ name: "Henri Tuulasjärvi", roles: ["DIRECTOR"] });
    expect(detail.credits.filter((credit) => credit.roleText === "Esiintyjät").map((credit) => credit.name)).toEqual([
      "Julia Lappalainen",
      "Minea Lång",
      "Ella Mettänen",
    ]);
    expect(detail.credits.map((credit) => credit.roleText)).not.toContain("Kuvat");
  });
});

describe("Q-teatteri past production (Kolme sisarta)", () => {
  const detail = parseDetail(fixture("production-kolme-sisarta.html"), ref("kolme-sisarta"), asOf);

  it("has no ticket link once the show has left the repertoire", () => {
    expect(detail.ticketUrl).toBeUndefined();
  });

  it("reads month headings with dates and the premiere line", () => {
    expect(detail.performances).toHaveLength(10);
    expect(detail.performances[0].startsAt).toEqual(new Date("2026-02-27T16:00:00Z")); // 18:00 EET
    expect(detail.premiereDate).toEqual(new Date("2026-02-27T16:00:00Z"));
  });

  it("lists names under a role heading, without notes in brackets or 'Työryhmä'", () => {
    const cast = detail.credits.filter((credit) => credit.roles.includes("CAST")).map((credit) => credit.name);
    expect(cast).toHaveLength(10);
    expect(cast).toContain("Ville Hilska");
    expect(cast).toContain("Tommi Korpela");
    expect(detail.credits.find((credit) => credit.roleText === "Ohjaus ja sovitus")?.name).toBe("Alise Polacenko");
    expect(detail.credits.some((credit) => credit.name === "Työryhmä")).toBe(false);
  });
});

describe("Q-teatteri text rules", () => {
  it("continues a name list that ends in a comma on the next line only", () => {
    const credits = parseCredits(["rooleissa: Hannu-Pekka Björkman, Lotta Kaihua,", "Elena Leeve ja Miro Lopperi", "lavastus: Milja Aho"]);
    expect(credits.map((credit) => [credit.name, credit.roles])).toEqual([
      ["Hannu-Pekka Björkman", ["CAST"]],
      ["Lotta Kaihua", ["CAST"]],
      ["Elena Leeve", ["CAST"]],
      ["Miro Lopperi", ["CAST"]],
      ["Milja Aho", ["DESIGNER"]],
    ]);
  });

  it("uses the printed weekday for the year and skips dates outside any season", () => {
    const season = { start: new Date("2026-12-28T00:00:00Z"), end: new Date("2027-01-10T00:00:00Z") };
    const { performances } = parsePageDates(["Pe 8.1. klo 19.00", "TAMMIKUU 9 | 40"], season, new Date("2026-10-18T00:00:00Z"));
    expect(performances).toEqual([new Date("2027-01-08T17:00:00Z")]); // no default time for the month row
  });
});
