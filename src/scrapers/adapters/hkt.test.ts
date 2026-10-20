import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitPeople } from "../text";
import { bylineCredits, parseDetail, parseList, parseNextPage, parsePostId, parseTicketList } from "./hkt";

const fixture = (name: string) => readFileSync(`fixtures/hkt/${name}`, "utf8");

describe("HKT list", () => {
  const first = parseList(fixture("list-esitykset.html"));

  it("reads every production with stage and author hints", () => {
    expect(first).toHaveLength(21);
    expect(first.find((item) => item.externalId === "julia")).toEqual({
      externalId: "julia",
      title: "& Julia",
      url: "https://hkt.fi/esitykset/julia/",
      stageHint: "Suuri näyttämö",
      authorHint: "David West Read - Max Martin",
      isVisiting: false,
    });
  });

  it("skips feed and pagination links", () => {
    expect(first.map((item) => item.externalId)).not.toContain("feed");
    expect(first.every((item) => !item.externalId.startsWith("page"))).toBe(true);
  });

  it("follows rel=next pagination", () => {
    expect(parseNextPage(fixture("list-esitykset.html"))).toBe("https://hkt.fi/esitykset/page/2/");
    expect(parseList(fixture("list-esitykset-page-2.html"))).toHaveLength(21);
  });
});

describe("HKT performances", () => {
  const performances = parseTicketList(fixture("ticket-list-47167.json"));

  it("finds the post id the performance endpoint needs", () => {
    expect(parsePostId(fixture("production-julia.html"))).toBe("47167");
    expect(parsePostId(fixture("production-de-obehoriga.html"))).toBe("49627");
  });

  it("converts Helsinki date and time to UTC, not HKT's misleading timestamp", () => {
    expect(performances).toHaveLength(74);
    expect(performances[0]).toEqual({
      startsAt: new Date("2026-10-20T15:30:00Z"), // 18.30 in Helsinki
      stage: "Suuri näyttämö",
      ticketUrl:
        "https://www.lippu.fi/event/julia-helsingin-kaupunginteatteri-suuri-nayttamo-ja-pieni-nayttamo-20985483/?affiliate=HKK&language=fi",
    });
  });

  it("handles the switch to winter time", () => {
    const december = performances.find((performance) => performance.startsAt.getUTCMonth() === 11);
    expect(december?.startsAt.getUTCHours()).toBe(16); // 18.30 EET is 16.30 UTC
  });

  it("tolerates an empty or odd response", () => {
    expect(parseTicketList('{"tickets":null,"all":null}')).toEqual([]);
    expect(parseTicketList('{"unexpected":true}')).toEqual([]);
  });
});

describe("HKT production page", () => {
  const julia = parseDetail(fixture("production-julia.html"), fixture("ticket-list-47167.json"), {
    externalId: "julia",
    url: "https://hkt.fi/esitykset/julia/",
    title: "Julia",
    authorHint: "David West Read - Max Martin",
  });
  const obehoriga = parseDetail(fixture("production-de-obehoriga.html"), null, {
    externalId: "de-obehoriga",
    url: "https://hkt.fi/esitykset/de-obehoriga/",
    title: "De obehöriga",
  });

  it("reads the facts list", () => {
    expect(julia).toMatchObject({
      title: "& Julia",
      stage: "Suuri näyttämö",
      durationText: "Noin 2 t 40 min, sis. väliajan",
      premiereDate: new Date("2026-08-20T00:00:00Z"),
      languages: ["fi"],
      // "Esitys tekstitetään sovelluksella": subtitled, but no language is named.
      subtitleLangs: [],
    });
    expect(julia.runEnd).toEqual(julia.performances.at(-1)?.startsAt);
  });

  it("knows Lilla Teatern plays in Swedish with Finnish and Swedish subtitles", () => {
    expect(obehoriga).toMatchObject({ stage: "Lilla Teatern", languages: ["sv"], subtitleLangs: ["fi", "sv"] });
  });

  it("maps the team in Finnish and Swedish, and skips rights holders", () => {
    const role = (detail: typeof julia, name: string) => detail.credits.find((credit) => credit.name === name)?.roles;
    expect(role(julia, "Samuel Harjanne")).toEqual(["DIRECTOR"]);
    expect(role(julia, "Paavo Leppäkoski")).toEqual(["TRANSLATOR"]);
    expect(role(julia, "MTI")).toBeUndefined();
    expect(role(obehoriga, "John Ajvide Lindqvist")).toEqual(["WRITER"]);
    expect(role(obehoriga, "David Sandqvist")).toEqual(["DIRECTOR"]);
    expect(role(obehoriga, "Agency North / Colombine Teaterförlag")).toBeUndefined();
  });

  it("reads the cast with characters and without guest markers", () => {
    expect(julia.credits.find((credit) => credit.name === "Renée Böök")).toMatchObject({
      roles: ["CAST"],
      characterName: "Julia",
    });
    expect(obehoriga.credits.map((credit) => credit.name)).toContain("Mawlawi Rahem");
  });

  it("keeps critic links with outlet, critic and date, never the quote", () => {
    expect(obehoriga.criticReviews).toEqual([
      {
        outlet: "Helsingin Sanomat",
        critic: "Maria Säkö",
        url: "https://hkt.fi/arvostelut/helsingin-sanomat-de-obehoriga/",
        publishedAt: new Date("2026-09-07T00:00:00Z"),
      },
      {
        outlet: "Svenska Yle",
        critic: "Lasse Garoff",
        url: "https://hkt.fi/arvostelut/de-obehoriga-svenska-yle/",
        publishedAt: new Date("2026-09-07T00:00:00Z"),
      },
    ]);
  });

  it("passes the tagline to the classifier only", () => {
    expect(julia.subtitle).toBe("Elämää suurempi hittimusikaali");
  });
});

describe("HKT byline", () => {
  it("makes the composer after the book writer a composer only (& Julia)", () => {
    const julia = parseDetail(fixture("production-julia.html"), null, {
      externalId: "julia",
      url: "https://hkt.fi/esitykset/julia/",
      title: "Julia",
      authorHint: "David West Read - Max Martin",
    });
    const roles = (name: string) => julia.credits.filter((credit) => splitPeople(credit.name).includes(name)).flatMap((credit) => credit.roles);
    expect(roles("David West Read")).toEqual(["WRITER"]);
    expect(roles("Max Martin")).toEqual(["COMPOSER"]);
  });

  it("keeps both roles for a sole author-composer", () => {
    const credits = [
      { name: "Lin-Manuel Miranda", roleText: "Teksti", roles: ["WRITER" as const] },
      { name: "Lin-Manuel Miranda", roleText: "Sävellys", roles: ["COMPOSER" as const] },
    ];
    expect(bylineCredits(credits, "Lin-Manuel Miranda")).toEqual(credits);
  });
});
