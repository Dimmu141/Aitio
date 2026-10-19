import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDetail, parseLanguage, parseList, typeFromGenre } from "./kansallisooppera";

const fixture = (name: string) => readFileSync(`fixtures/kansallisooppera/${name}`, "utf8");

describe("Kansallisooppera repertoire", () => {
  const list = parseList(fixture("ohjelmisto.html"));

  it("reads the season from the embedded data-posts JSON", () => {
    expect(list).toHaveLength(20);
    expect(list.find((item) => item.title === "Figaron häät")).toEqual({
      externalId: "319694",
      title: "Figaron häät",
      url: "https://oopperabaletti.fi/ohjelmisto/figaron-haat/",
      stageHint: "Päänäyttämö",
      authorHint: "W. A. Mozart – Lorenzo Da Ponte",
      isVisiting: false,
    });
  });

  it("skips tours, tea dances, free foyer events, live streams, workshops and concerts elsewhere", () => {
    const titles = list.map((item) => item.title);
    for (const skipped of [
      "Kiertokäynnit",
      "Oopperan teetanssit",
      "Teosesittely",
      "Ooppera kutsuu",
      "Musiikkia lämpiössä",
      "Barokkiporstua",
      "Taikatuokio",
      "Kansallisoopperan orkesteri @ Musiikkitalo",
      "Perinteinen joulukonsertti",
    ]) {
      expect(titles).not.toContain(skipped);
    }
    // Live streams share the title with the tea dances; none of them is kept.
    expect(list.every((item) => item.url.startsWith("https://oopperabaletti.fi/ohjelmisto/"))).toBe(true);
  });

  it("keeps children's shows, galas on its own stage, and marks visiting companies", () => {
    const titles = list.map((item) => item.title);
    expect(titles).toContain("Miniooppera Reininkulta");
    expect(titles).toContain("Oopperan ja Baletin Joulu");
    expect(titles).toContain("La Calisto"); // opera at another venue is still its own production
    expect(list.find((item) => item.title === "Nocturno")?.isVisiting).toBe(true);
  });
});

describe("Kansallisooppera opera page", () => {
  const detail = parseDetail(fixture("production-figaron-haat.html"), {
    externalId: "319694",
    url: "https://oopperabaletti.fi/ohjelmisto/figaron-haat/",
    title: "Figaron häät",
    isVisiting: false,
  });

  it("reads the hero facts", () => {
    expect(detail).toMatchObject({
      title: "Figaron häät",
      stage: "Päänäyttämö",
      typeHint: "OPERA",
      durationText: "3 t 20 min, sis. väliajan (25 min)",
      runStart: new Date("2026-10-22T00:00:00Z"),
      runEnd: new Date("2026-11-27T00:00:00Z"),
      ticketUrl: "https://oopperabaletti.fi/osta/id/319694/",
      performancesPartial: false,
    });
  });

  it("records the sung language and the surtitles", () => {
    expect(detail.languages).toEqual(["it"]);
    expect(detail.subtitleLangs).toEqual(["fi", "sv", "en"]);
  });

  it("reads performances from the Event JSON-LD with the Opera's own shop links", () => {
    expect(detail.performances).toHaveLength(10);
    expect(detail.performances[0]).toEqual({
      startsAt: new Date("2026-10-22T16:00:00Z"), // to 22.10. klo 19.00, EEST
      stage: "Päänäyttämö",
      ticketUrl: "https://shop.oopperabaletti.fi/fi/select-your-own-seat/257808/",
    });
    // Sold out: no offer link, but the performance stays.
    expect(detail.performances.at(-1)).toEqual({ startsAt: new Date("2026-11-27T17:00:00Z"), stage: "Päänäyttämö" });
  });

  it("reads the team and the cast with characters; the conductor is not the composer", () => {
    const roles = (name: string) => detail.credits.find((credit) => credit.name === name)?.roles;
    expect(roles("Wolfgang Amadeus Mozart")).toEqual(["COMPOSER"]);
    expect(roles("Lorenzo da Ponte")).toEqual(["WRITER"]);
    expect(roles("Anna Kelo")).toEqual(["DIRECTOR"]);
    expect(roles("Riikka Räsänen")).toEqual(["CHOREOGRAPHER"]);
    expect(detail.credits.find((credit) => credit.name === "James Sherlock")).toEqual({
      name: "James Sherlock",
      roleText: "Musiikinjohto",
      roles: ["OTHER"],
    });
    expect(detail.credits.find((credit) => credit.name === "Georg Festl")).toMatchObject({
      roles: ["CAST"],
      characterName: "Figaro",
    });
    expect(detail.credits.filter((credit) => credit.roles.includes("CAST"))).toHaveLength(15);
  });

  it("keeps no review quotes", () => {
    expect(detail.criticReviews).toEqual([]);
  });
});

describe("Kansallisooppera ballet pages", () => {
  const hamlet = parseDetail(fixture("production-hamlet.html"), {
    externalId: "319958",
    url: "https://oopperabaletti.fi/ohjelmisto/hamlet/",
    title: "Hamlet",
    isVisiting: false,
  });

  it("reads a ballet with alternating casts and only upcoming performances", () => {
    expect(hamlet).toMatchObject({ typeHint: "DANCE", stage: "Päänäyttämö", languages: [], subtitleLangs: [] });
    expect(hamlet.performances).toHaveLength(11);
    expect(hamlet.performances[0].startsAt).toEqual(new Date("2026-10-21T16:00:00Z"));
    // Winter time from late October: 19.00 is 17.00 UTC.
    expect(hamlet.performances.find((p) => p.startsAt.toISOString().startsWith("2027-01-21"))?.startsAt).toEqual(
      new Date("2027-01-21T17:00:00Z"),
    );
    expect(hamlet.credits.find((credit) => credit.name === "Leo Mujić")?.roles).toEqual(["CHOREOGRAPHER"]);
    expect(hamlet.credits.filter((credit) => credit.characterName === "Hamlet").map((credit) => credit.name)).toEqual([
      "Giulio Diligente",
      "Martin Nudo",
      "Thomas Brun",
    ]);
    expect(hamlet.credits.filter((credit) => credit.roleText === "Musiikki").map((credit) => credit.name)).toEqual([
      "Pjotr Tšaikovski",
      "Camille Saint-Saëns",
    ]);
  });

  it("reads every piece's team in a triple bill", () => {
    const aistit = parseDetail(fixture("production-aistit.html"), {
      externalId: "320098",
      url: "https://oopperabaletti.fi/ohjelmisto/aistit/",
      title: "Aistit",
      isVisiting: false,
    });
    expect(aistit.typeHint).toBe("DANCE"); // Genre "Nykytanssi"
    const choreographers = aistit.credits.filter((credit) => credit.roles.includes("CHOREOGRAPHER")).map((c) => c.name);
    expect(choreographers).toEqual(["Hae Ni Kim", "Jiří Kylián", "Marcos Morau"]);
    expect(aistit.credits.find((credit) => credit.name === "Hae Ni Kim")?.roles).toEqual(["CHOREOGRAPHER", "DESIGNER"]);
    expect(aistit.performances).toHaveLength(9);
  });

  it("states no premiere date, so none is guessed from the run", () => {
    // "Milloin" starts the run, but the page never says it opened as a premiere (Dracula's
    // run this season is a revival); "Ensi-ilta jää … historiaan" is a review quote.
    expect(hamlet.runStart).toEqual(new Date("2026-10-02T00:00:00Z"));
    expect(hamlet.premiereDate).toBeUndefined();
  });
});

describe("helpers", () => {
  it("parses the Kieli line", () => {
    expect(parseLanguage("Suomi, ei tekstitystä")).toEqual({ languages: ["fi"], subtitleLangs: [] });
    expect(parseLanguage("Englanti. Tekstitys suomeksi ja ruotsiksi")).toEqual({
      languages: ["en"],
      subtitleLangs: ["fi", "sv"],
    });
    expect(parseLanguage(undefined)).toEqual({ languages: [], subtitleLangs: [] });
  });

  it("maps the printed genre to a type hint", () => {
    expect(typeFromGenre("Baletti", "Hamlet")).toBe("DANCE");
    expect(typeFromGenre("Nykyooppera", "The Handmaid's Tale")).toBe("OPERA");
    expect(typeFromGenre("Konsertti", "Oopperan ja Baletin Joulu")).toBe("CONCERT");
    expect(typeFromGenre("Lapsille", "Miniooppera Reininkulta")).toBe("OPERA");
    expect(typeFromGenre("Muuta", "Nocturno")).toBeUndefined();
  });
});
