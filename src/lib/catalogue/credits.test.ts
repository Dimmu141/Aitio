import { describe, expect, it } from "vitest";
import { groupCredits, posterFoot } from "./credits";
import type { CreditRow } from "./types";

const credit = (role: CreditRow["role"], slug: string, characterName: string | null = null): CreditRow => ({
  role,
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
