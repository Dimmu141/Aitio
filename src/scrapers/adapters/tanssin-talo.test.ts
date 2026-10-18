import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  creditNames,
  danceRoles,
  isOwnedElsewhere,
  listUrl,
  parseDetail,
  parseList,
  parseListing,
  showTime,
  typeHintFor,
  type ListingEntry,
} from "./tanssin-talo";

const fixture = (name: string) => readFileSync(`fixtures/tanssin-talo/${name}`, "utf8");
const listing = parseListing(fixture("ohjelma-api.json"));
const entry = (slug: string): ListingEntry => {
  const found = listing.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(`no listing for ${slug}`);
  return found;
};
const ref = (slug: string) => ({ externalId: slug, url: `https://www.tanssintalo.fi/ohjelma/${slug}`, title: slug });

describe("Tanssin talo listing", () => {
  it("asks the GraphQL endpoint for entries running on the given Helsinki date", () => {
    const url = decodeURIComponent(listUrl(new Date("2026-10-17T22:30:00Z")));
    expect(url.startsWith("https://www.tanssintalo.fi/api?query=")).toBe(true);
    expect(url).toContain('endDate: ">=2026-10-18"');
  });

  it("keeps staged shows and skips workshops, talks and professional events", () => {
    const ids = parseList(fixture("ohjelma-api.json")).map((item) => item.externalId);
    expect(ids).toContain("alpo-aaltokoski-company-kolmen-soolon-juhla");
    expect(ids).toContain("talvisirkus-väri");
    expect(ids).toContain("anna-eriksson-juhlakonsertti");
    expect(ids).toContain("square-2026"); // no categories at all, still a show
    for (const skipped of [
      "lia-rodrigues-työpaja", // masterclass
      "lasten-lauantai-2026-syksy", // free workshop Saturday
      "saastamoinen-foundation-yuko-mohri", // keynote
      "avoin-toimisto-taiteilijoille-ja-tuottajille-3",
      "keskustelua-taiteesta-ja-viestinnasta",
    ]) {
      expect(ids).not.toContain(skipped);
    }
  });

  it("drops soft hyphens from titles and keeps the organiser", () => {
    expect(entry("saastamoinen-foundation-yuko-mohri").title).toBe("Saastamoinen Foundation Keynote: Yuko Mohri");
    expect(entry("carl-knif-company-vaasabaroque").organisers).toEqual(["Carl Knif Company"]);
  });

  it("combines the date of one field with the wall clock of the other", () => {
    expect(showTime("2026-10-27T00:00:00+02:00", "2026-06-09T18:30:00+03:00")).toEqual(new Date("2026-10-27T16:30:00Z"));
    expect(showTime("2026-10-17T00:00:00+03:00", "2026-01-19T19:00:00+02:00")).toEqual(new Date("2026-10-17T16:00:00Z"));
  });

  it("maps the site's categories to a type hint", () => {
    expect(typeHintFor(["Tanssi", "Musiikki"])).toBe("DANCE");
    expect(typeHintFor(["Musiikki"])).toBe("CONCERT");
    expect(typeHintFor(["Lasten kanssa", "Sirkus"])).toBeUndefined();
  });
});

describe("Tanssin talo production page", () => {
  const solos = parseDetail(
    fixture("production-kolmen-soolon-juhla.html"),
    ref("alpo-aaltokoski-company-kolmen-soolon-juhla"),
    { listing: entry("alpo-aaltokoski-company-kolmen-soolon-juhla") },
  );

  it("reads the facts under the title", () => {
    expect(solos).toMatchObject({
      title: "Alpo Aaltokoski Company: Kolmen soolon juhla",
      stage: "Pannuhalli",
      typeHint: "DANCE",
      durationText: "1 h 45 min (sis. 2 väliaikaa)",
      ticketUrl: "https://tix.tanssintalo.fi/fi/buyingflow/tickets/15889",
      performancesPartial: false,
    });
  });

  it("takes every performance from the listing, after the switch to winter time", () => {
    expect(solos.performances).toHaveLength(5);
    expect(solos.performances[0]).toEqual({ startsAt: new Date("2026-10-27T16:30:00Z"), stage: "Pannuhalli" }); // ti 27.10. klo 18.30
    expect(solos.performances[4].startsAt).toEqual(new Date("2026-10-31T13:00:00Z")); // la 31.10. klo 15
  });

  it("keeps choreographers and dancers of every piece, one entry per person", () => {
    const credits = Object.fromEntries(solos.credits.map((credit) => [credit.name, credit.roles]));
    expect(credits["Alpo Aaltokoski"]).toEqual(["CHOREOGRAPHER"]);
    expect(credits["Nina Bulgakova"]).toEqual(["CHOREOGRAPHER", "CAST"]);
    expect(credits["Vadim Yesaulenko"]).toEqual(["CHOREOGRAPHER"]);
    expect(credits["Pachi Sejas"]).toEqual(["CAST"]);
    expect(credits["Kalle Paasonen"]).toEqual(["DESIGNER"]);
    // Photographers, graphic design and production companies are not credits.
    expect(credits["Ninna Lindström"]).toBeUndefined();
    expect(credits["Atte Karttunen"]).toBeUndefined();
    expect(solos.credits.some((credit) => /Nomadi|Company/.test(credit.name))).toBe(false);
  });

  it("reads a triple bill's credits piece by piece", () => {
    const bill = parseDetail(fixture("production-wild-is-the-wind.html"), ref("wild-is-the-wind"));
    const credits = Object.fromEntries(bill.credits.map((credit) => [credit.name, credit.roles]));
    expect(bill.title).toBe("Tero Saarinen Companyn kolmen teoksen ilta: Wild Is the Wind");
    expect(bill.stage).toBe("Erkko-sali");
    expect(credits["Tero Saarinen"]).toEqual(["CHOREOGRAPHER", "CAST"]); // Garden; dances Room 7
    expect(credits["Carolyn Carlson"]).toContain("CHOREOGRAPHER");
    expect(credits["Sonya Lindfors"]).toEqual(["DIRECTOR", "CHOREOGRAPHER"]);
    expect(credits["Elina Häyrynen"]).toEqual(["CAST"]); // in two pieces, listed once
    expect(bill.credits.filter((credit) => credit.name === "Elina Häyrynen")).toHaveLength(1);
    expect(credits["René Aubry"]).toEqual(["COMPOSER"]);
    expect(credits["Satu Halttunen"]).toBeUndefined(); // choreographer's assistant
    expect(bill.performances).toEqual([]); // no listing row: the page alone has no years
  });

  it("calls dance with live music dance, and keeps the production's own ticket link", () => {
    const knif = parseDetail(fixture("production-carl-knif-vaasabaroque.html"), ref("carl-knif-company-vaasabaroque"), {
      listing: entry("carl-knif-company-vaasabaroque"),
    });
    expect(knif.typeHint).toBe("DANCE");
    expect(knif.performances.map((performance) => performance.startsAt)).toEqual([
      new Date("2026-11-13T17:00:00Z"),
      new Date("2026-11-14T13:00:00Z"),
    ]);
    expect(knif.credits.find((credit) => credit.name === "Carl Knif")?.roles).toEqual([
      "DIRECTOR",
      "CHOREOGRAPHER",
      "DESIGNER",
      "CAST",
    ]);
  });

  it("reads a long run across the new year and an unlabelled performer list", () => {
    const circus = parseDetail(fixture("production-talvisirkus-vari.html"), ref("talvisirkus-väri"), {
      listing: entry("talvisirkus-väri"),
    });
    expect(circus.performances).toHaveLength(45);
    expect(circus.runEnd).toEqual(new Date("2027-01-24T11:00:00Z"));
    expect(circus.typeHint).toBeUndefined();
    expect(circus.languages).toEqual(["zxx"]); // "Esitys on sanaton."
    expect(circus.ticketUrl).toBe("https://tix.hurjaruuth.fi/fi/buyingflow/tickets/15885");
    const credits = Object.fromEntries(circus.credits.map((credit) => [credit.name, credit.roles]));
    expect(credits["Saku Mäkelä"]).toEqual(["CHOREOGRAPHER"]); // "Apuohjaaja, koreografi"
    expect(credits["Aino Koski"]).toEqual(["DESIGNER"]); // "Lavastaja"
    expect(credits["Krista-Julia Arppo"]).toEqual(["CAST"]);
    expect(credits["Paule Aladin"]).toBeUndefined(); // outreach
  });
});

describe("Tanssin talo and Zodiak", () => {
  it("leaves productions organised by Zodiak to the zodiak source", () => {
    const entry = { ...parseListing(fixture("ohjelma-api.json"))[0], organisers: ["Zodiak - Uuden tanssin keskus"] };
    expect(isOwnedElsewhere(entry)).toBe(true);
    expect(isOwnedElsewhere({ ...entry, organisers: ["Carl Knif Company"] })).toBe(false);
  });
});

describe("helpers", () => {
  it("splits free-text names and drops groups and phrases", () => {
    expect(creditNames("Pachi Sejas (Eilisen jälkeen), Delfiina Huczkowski ja feat. Elina Pirinen (FI)")).toEqual([
      "Pachi Sejas",
      "Delfiina Huczkowski",
      "Elina Pirinen",
    ]);
    expect(creditNames("David Scarantino & Mikko Lampinen, näytökset ti 22.9., ke 23.9. ja la 26.9")).toEqual([
      "David Scarantino",
      "Mikko Lampinen",
    ]);
    expect(creditNames("Attituden Pre-Intense- ja Intense 1 -koulutusohjelmien tanssijat, Attitude Kids")).toEqual([]);
  });

  it("maps dance-house role labels", () => {
    expect(danceRoles("Tanssi, osajako 1")).toEqual(["CAST"]);
    expect(danceRoles("Koreografinen assistentti ja harjoituttaja")).toEqual([]);
    expect(danceRoles("Valokuvat")).toEqual([]);
    expect(danceRoles("Ohjaus, koreografinen praktiikka, libretto")).toEqual(["DIRECTOR", "CHOREOGRAPHER", "WRITER"]);
  });
});
