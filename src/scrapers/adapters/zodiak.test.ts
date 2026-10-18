import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalUrl, parseDetail, parseList, splitNames, zodiakRoles } from "./zodiak";

const fixture = (name: string) => readFileSync(`fixtures/zodiak/${name}`, "utf8");
const asOf = new Date("2026-10-18T12:00:00Z");

describe("Zodiak programme", () => {
  const list = parseList(fixture("ohjelmisto.html"));

  it("keeps the performances and skips panels, seminars, other events and Z-Lab showings", () => {
    expect(list.map((item) => item.externalId)).toEqual(["sotku-ja-rakkaus", "ghosts-rosegarden", "lampi-2", "imperial-stage"]);
    expect(list.some((item) => /paneeli|laboratory|seminaari|tanssimista/.test(item.externalId))).toBe(false);
  });

  it("takes the title without the artist prefix, which goes to authorHint", () => {
    expect(list[2]).toEqual({
      externalId: "lampi-2",
      title: "Lampi 2",
      url: "https://www.zodiak.fi/fi/ohjelmisto/lampi-2",
      stageHint: "Zodiak Stage",
      authorHint: "Eliel Tammiharju",
      isVisiting: false,
    });
  });

  it("reads the venue, including Tanssin talo", () => {
    expect(list.find((item) => item.externalId === "ghosts-rosegarden")?.stageHint).toBe("Tanssin talo, Erkko-sali");
  });

  it("turns /index%2Ephp/ links into the canonical page", () => {
    expect(canonicalUrl("/index%2Ephp/fi/ohjelmisto/tanssimista-vai-nayttelemista")).toBe(
      "https://www.zodiak.fi/fi/ohjelmisto/tanssimista-vai-nayttelemista",
    );
  });
});

describe("Zodiak production page", () => {
  const ghosts = parseDetail(
    fixture("production-ghosts-rosegarden.html"),
    { externalId: "ghosts-rosegarden", url: "https://www.zodiak.fi/fi/ohjelmisto/ghosts-rosegarden", title: "Ghosts of Rosegarden" },
    asOf,
  );
  const lampi = parseDetail(
    fixture("production-lampi-2.html"),
    { externalId: "lampi-2", url: "https://www.zodiak.fi/fi/ohjelmisto/lampi-2", title: "Lampi 2" },
    asOf,
  );

  it("reads the facts from the sidebar", () => {
    expect(ghosts).toMatchObject({
      title: "Ghosts of Rosegarden",
      stage: "Tanssin talo, Erkko-sali",
      typeHint: "DANCE",
      durationText: "n. 80 min (ei väliaikaa)",
      languages: ["en"],
      premiereDate: new Date("2026-10-06T00:00:00Z"),
      performancesPartial: false,
    });
    expect(lampi.languages).toEqual([]); // no language stated
  });

  it("stores the outbound ticket link only", () => {
    expect(ghosts.ticketUrl).toBe("https://tix.zodiak.fi/fi/tanzo/buyingflow/tickets/15645/");
    expect(lampi.ticketUrl).toBe("https://tix.zodiak.fi/fi/buyingflow/tickets/15875/");
  });

  it("reads every date with its year and the stage", () => {
    expect(ghosts.performances).toHaveLength(4);
    expect(ghosts.performances[3]).toEqual({ startsAt: new Date("2026-10-10T12:00:00Z"), stage: "Tanssin talo, Erkko-sali" }); // la 10.10. klo 15
    expect(lampi.performances).toHaveLength(8);
    // ti 27.10. klo 19, after the switch to winter time (UTC+2).
    expect(lampi.performances[2]).toEqual({ startsAt: new Date("2026-10-27T17:00:00Z"), stage: "Zodiak Stage" });
  });

  it("reads choreographers, dancers and designers, and skips crew and funders", () => {
    expect(ghosts.credits.map((credit) => [credit.name, credit.roles])).toEqual([
      ["Elina Pirinen", ["DIRECTOR", "WRITER", "CHOREOGRAPHER"]],
      ["Ville Kabrell", ["COMPOSER", "DESIGNER"]],
      ["Mateus Manninen", ["DESIGNER"]],
      ["Antrea Kantakoski", ["DESIGNER"]],
      ["Jakob Öhrman", ["DESIGNER"]],
      ["Simone Benini", ["CAST"]],
      ["Elias Berglund", ["CAST"]],
      ["Age Linkmann", ["CAST"]],
      ["Julia Mäkelä", ["CAST"]],
      ["Arolin Raudva", ["CAST"]],
      ["Vera Tegelman", ["CAST"]],
      ["Felix Urbina", ["CAST"]],
      ["Elina Pirinen", ["CAST"]],
    ]);
    expect(lampi.credits.some((credit) => credit.name === "työryhmä")).toBe(false);
  });

  it("reads 'Esiintyjät' lines on pages without line spans", () => {
    const sotku = parseDetail(
      fixture("production-sotku-ja-rakkaus.html"),
      { externalId: "sotku-ja-rakkaus", url: "https://www.zodiak.fi/fi/ohjelmisto/sotku-ja-rakkaus", title: "Sotku ja rakkaus" },
      asOf,
    );
    expect(sotku.credits.filter((credit) => credit.roles.includes("CAST")).map((credit) => credit.name)).toEqual([
      "Elina Hauta-aho",
      "Kadar Khristan",
      "Noora Västinen",
    ]);
    expect(sotku.credits.find((credit) => credit.name === "Kati Raatikainen")?.roles).toEqual(["CHOREOGRAPHER"]);
  });
});

describe("Zodiak credit helpers", () => {
  it("maps dancers and performers to CAST and drops assistants and mentors", () => {
    expect(zodiakRoles("Konsepti, koreografia ja esiintyjä")).toEqual(["CHOREOGRAPHER", "CAST"]);
    expect(zodiakRoles("Koreografinen assistentti ja harjoituttaja")).toEqual([]);
    expect(zodiakRoles("Esiintyjäntyön mentori")).toEqual([]);
    expect(zodiakRoles("Tuottaja")).toEqual([]);
  });

  it("splits names and drops country codes and 'feat.'", () => {
    expect(splitNames("Julia Mäkelä (FI) Arolin Raudva (EE), feat. Elina Pirinen (FI)")).toEqual([
      "Julia Mäkelä",
      "Arolin Raudva",
      "Elina Pirinen",
    ]);
  });
});
