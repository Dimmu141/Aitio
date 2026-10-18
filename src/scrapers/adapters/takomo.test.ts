import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDetail, parseList, parseShowDate, venueIn } from "./takomo";

const fixture = (name: string) => readFileSync(`fixtures/takomo/${name}`, "utf8");
const asOf = new Date("2026-10-18T09:00:00Z");
const ref = (externalId: string) => ({
  externalId,
  url: `https://teatteritakomo.fi/ohjelmisto/${externalId}/`,
  title: externalId,
});

describe("Takomo calendar", () => {
  it("lists each production on the calendar once, in calendar order", () => {
    const list = parseList(fixture("ohjelmisto.html"));
    expect(list.map((item) => item.externalId)).toEqual([
      "kadonnutta-aikaa-etsimassa-2017-2027-osa-9",
      "meri-ekola-kid-kokko",
      "joanna-haartti-viiksi-instituutti-kaksoisolento",
      "962",
      "etelapohjalaisia-lahdenmaki-viitasaari",
      "puhutaan-richardista",
    ]);
    expect(list[2].title).toBe("Joanna Haartti & Viiksi-instituutti: Kaksoisolento");
  });

  it("takes the year from the printed weekday, never a guess", () => {
    expect(parseShowDate("la 13.2. klo 14.00", asOf)).toEqual(new Date("2027-02-13T12:00:00Z"));
    expect(parseShowDate("pe 11.9. klo 19.00", asOf)).toEqual(new Date("2026-09-11T16:00:00Z"));
    expect(parseShowDate("ma 13.2. klo 14.00", asOf)).toBeNull(); // no Monday 13 Feb nearby
  });

  it("names known off-site venues", () => {
    expect(venueIn("Jumppatytöt Kansallisteatterissa")).toBe("Kansallisteatteri");
    expect(venueIn("Eteläpohjalaisia")).toBeUndefined();
  });
});

describe("Takomo production at an external venue (KAE9, Hanasaari)", () => {
  const detail = parseDetail(
    fixture("production-kadonnutta-aikaa-etsimassa-osa-9.html"),
    ref("kadonnutta-aikaa-etsimassa-2017-2027-osa-9"),
    asOf,
  );

  it("records the venue from the text on every performance", () => {
    expect(detail.stage).toBe("Hanasaaren voimala");
    expect(detail.performances.every((performance) => performance.stage === "Hanasaaren voimala")).toBe(true);
  });

  it("keeps one performance per start time (the nine-hour ticket is a variant)", () => {
    expect(detail.performances.map((performance) => performance.startsAt.toISOString())).toEqual([
      "2026-10-18T09:00:00.000Z",
      "2026-10-18T12:00:00.000Z",
      "2026-10-18T15:00:00.000Z",
    ]);
    expect(detail.performances[0].ticketUrl).toBe(
      "https://www.tiketti.fi/kadonnutta-aikaa-etsimassa-2017-2027-hanasaaren-lippuja/120683",
    );
    expect(detail.performancesPartial).toBe(false);
  });

  it("reads the working group and 'Name, role' lines", () => {
    expect(detail.credits.map((credit) => [credit.name, credit.roleText])).toEqual([
      ["Aleksi Holkko", "Työryhmä"],
      ["Hanna-Kaisa Tiainen", "Työryhmä"],
      ["Nita Tiivola", "valmentaja"],
    ]);
  });
});

describe("Takomo production at home (Eteläpohjalaisia)", () => {
  const detail = parseDetail(
    fixture("production-etelapohjalaisia.html"),
    ref("etelapohjalaisia-lahdenmaki-viitasaari"),
    asOf,
  );

  it("reads facts from the text and nothing else", () => {
    expect(detail).toMatchObject({
      title: "Eteläpohjalaisia",
      stage: "Teatteri Takomo",
      durationText: "noin 1h20min, ei väliaikaa",
      premiereDate: new Date("2026-09-11T00:00:00Z"),
      languages: ["fi"],
      criticReviews: [],
    });
    expect(detail).not.toHaveProperty("subtitle");
  });

  it("lists past and future performances across the new year", () => {
    expect(detail.performances).toHaveLength(18);
    expect(detail.runStart).toEqual(new Date("2026-09-11T16:00:00Z"));
    expect(detail.runEnd).toEqual(new Date("2027-02-20T12:00:00Z"));
  });

  it("reads 'Role: names' credits, a role cut by a line break, and skips photo credits", () => {
    const makers = detail.credits.filter((credit) => credit.name === "Ella Lahdenmäki");
    expect(makers).toHaveLength(1);
    expect(makers[0].roles).toEqual(expect.arrayContaining(["DIRECTOR", "WRITER", "COMPOSER", "DESIGNER", "CAST"]));
    expect(detail.credits.map((credit) => credit.name)).toContain("Pinja Kokkonen");
    expect(detail.credits.map((credit) => credit.name)).not.toContain("Matti Ahopelto"); // Esityskuvat
  });
});

describe("Takomo 'Role <b>names</b>' credits (Puhutaan Richardista)", () => {
  const detail = parseDetail(fixture("production-puhutaan-richardista.html"), ref("puhutaan-richardista"), asOf);

  it("maps Takomo's labels to roles", () => {
    expect(detail.credits.map((credit) => [credit.name, credit.roles])).toEqual([
      ["Arni Rajamäki", ["WRITER"]],
      ["Ami Karvonen", ["DIRECTOR"]],
      ["Noora Dadu", ["CAST"]],
      ["Minttu Mustakallio", ["CAST"]],
      ["Anssi Niemi", ["CAST"]],
      ["Sofia Smeds", ["CAST"]],
      ["Tatu Nenonen", ["DESIGNER"]],
      ["Jaakko Pietiläinen", ["DESIGNER"]],
      ["Heikki Paasonen", ["DESIGNER"]],
      ["Tiina Kaukanen", ["DESIGNER"]],
    ]);
  });

  it("keeps the premiere although its dates are gone, and dates the rest in 2027", () => {
    expect(detail.premiereDate).toEqual(new Date("2026-04-15T00:00:00Z"));
    expect(detail.performances).toHaveLength(12);
    expect(detail.performances[0].startsAt).toEqual(new Date("2027-03-05T17:00:00Z"));
  });
});

describe("Takomo production at Teatterimuseo (Pähkinänsärkijän joulu)", () => {
  const detail = parseDetail(fixture("production-pahkinansarkijan-joulu.html"), ref("962"), asOf);

  it("reads the venue from the 'Huom' line", () => {
    expect(detail.stage).toBe("Teatterimuseo");
    expect(detail.performances).toHaveLength(3);
    expect(detail.performances[0]).toEqual({
      startsAt: new Date("2026-12-18T16:30:00Z"),
      stage: "Teatterimuseo",
      ticketUrl: "https://www.tiketti.fi/tapahtuma/121356",
    });
  });

  it("reads several 'Role: names' lines in one paragraph", () => {
    expect(detail.credits.map((credit) => [credit.name, credit.roles])).toEqual([
      ["Ella Lahdenmäki", ["CAST"]],
      ["Pyry Äikää", ["CAST"]],
      ["Mikko Pykäri", ["OTHER"]],
      ["Janne Pellinen", ["DIRECTOR"]],
      ["Annina Nevantaus", ["DESIGNER"]],
      ["Lauri Lundahl", ["DESIGNER"]],
    ]);
  });
});
