import { describe, expect, it } from "vitest";
import { groupCredits, posterFoot, teamRows } from "./credits";
import type { CreditRow } from "./types";

const credit = (
  role: CreditRow["role"],
  slug: string,
  characterName: string | null = null,
  roleText: string | null = null,
): CreditRow => ({
  role,
  roleText,
  person: { slug, name: slug.toUpperCase() },
  characterName,
});

describe("groupCredits", () => {
  it("orders roles like a programme and keeps cast order", () => {
    const groups = groupCredits([
      credit("CAST", "b", "Hamlet"),
      credit("DESIGNER", "d"),
      credit("CAST", "a", "Ofelia"),
      credit("DIRECTOR", "c"),
    ]);
    expect(groups.map((group) => group.role)).toEqual(["DIRECTOR", "DESIGNER", "CAST"]);
    expect(groups[2].people.map((person) => person.characterName)).toEqual(["Hamlet", "Ofelia"]);
  });

  it("lists a person once per role but in several roles", () => {
    const groups = groupCredits([credit("DIRECTOR", "a"), credit("WRITER", "a"), credit("DIRECTOR", "a")]);
    expect(groups).toEqual([
      { role: "DIRECTOR", people: [{ slug: "a", name: "A", characterName: null }] },
      { role: "WRITER", people: [{ slug: "a", name: "A", characterName: null }] },
    ]);
  });
});

describe("posterFoot", () => {
  const labels = { directedBy: "ohjaus", writtenAndDirectedBy: "teksti ja ohjaus" };

  it("names writer and director like a programme cover", () => {
    expect(posterFoot([credit("DIRECTOR", "d"), credit("WRITER", "w")], labels)).toBe("W · ohjaus D");
  });

  it("names someone who wrote and directed only once", () => {
    expect(posterFoot([credit("WRITER", "smeds"), credit("DIRECTOR", "smeds")], labels)).toBe("teksti ja ohjaus SMEDS");
  });

  it("is null without either", () => {
    expect(posterFoot([credit("CAST", "c")], labels)).toBeNull();
  });
});

describe("teamRows", () => {
  const roleName = (role: CreditRow["role"]) => ({ DIRECTOR: "Ohjaus", ADAPTATION: "Dramatisointi", DESIGNER: "Suunnittelu", WRITER: "Teksti" })[role as string] ?? role;
  const seven = [
    credit("WRITER", "aleksis-kivi"),
    credit("DIRECTOR", "mika-myllyaho", null, "Ohjaus ja dramatisointi"),
    credit("ADAPTATION", "mika-myllyaho", null, "Ohjaus ja dramatisointi"),
    credit("DESIGNER", "katri-rentto", null, "Lavastussuunnittelu"),
    credit("DESIGNER", "katri-rentto", null, "Pukusuunnittelu"),
    credit("CAST", "actor", "Juhani"),
  ];

  it("gives each person one row in the theatre's wording and order, whatever the page language", () => {
    expect(teamRows(seven, roleName)).toEqual([
      { person: { slug: "aleksis-kivi", name: "ALEKSIS-KIVI" }, roles: "Teksti", minor: false, sourceText: false },
      { person: { slug: "mika-myllyaho", name: "MIKA-MYLLYAHO" }, roles: "Ohjaus ja dramatisointi", minor: false, sourceText: true },
      { person: { slug: "katri-rentto", name: "KATRI-RENTTO" }, roles: "Lavastussuunnittelu, pukusuunnittelu", minor: false, sourceText: true },
    ]);
  });

  it("falls back to the translated role name only where the theatre gave no label", () => {
    expect(teamRows([credit("DESIGNER", "erik-salvesen", null, "Scenografi"), credit("DESIGNER", "x")], roleName).map((row) => row.roles)).toEqual([
      "Scenografi",
      "Suunnittelu",
    ]);
  });

  it("marks people credited only for other roles, so they can fold away", () => {
    const rows = teamRows([credit("OTHER", "tech", null, "Valotekniikka"), credit("DIRECTOR", "d"), credit("OTHER", "d", null, "Tuotanto")], roleName);
    expect(rows.map((row) => [row.person.slug, row.minor])).toEqual([["tech", true], ["d", false]]);
  });

  it("keeps acronyms as written", () => {
    const rows = teamRows([credit("DESIGNER", "x", null, "Valosuunnittelu"), credit("DESIGNER", "x", null, "VR-toteutus")], roleName);
    expect(rows[0].roles).toBe("Valosuunnittelu, VR-toteutus");
  });
});
