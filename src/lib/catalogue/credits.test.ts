import { describe, expect, it } from "vitest";
import { groupCredits } from "./credits";
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
