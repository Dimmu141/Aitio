import { describe, expect, it } from "vitest";
import { personFix } from "./people";

// Person rows in production on 20 Oct 2026.
describe("personFix", () => {
  it("keeps a real person", () => {
    expect(personFix({ slug: "max-martin", name: "Max Martin" })).toEqual({ action: "keep" });
  });

  it("merges a cell of several people into each of them", () => {
    expect(personFix({ slug: "silva-lillrank-och-outi-paasivirta", name: "Silva Lillrank och Outi Paasivirta" })).toEqual({
      action: "merge",
      into: [
        { slug: "silva-lillrank", name: "Silva Lillrank" },
        { slug: "outi-paasivirta", name: "Outi Paasivirta" },
      ],
    });
  });

  it("merges a person out of a group suffix or a company", () => {
    expect(personFix({ slug: "max-martin-ja-ystavat", name: "Max Martin ja ystävät" })).toEqual({
      action: "merge",
      into: [{ slug: "max-martin", name: "Max Martin" }],
    });
    expect(personFix({ slug: "anna-maria-lipponen-studio-total", name: "Anna-Maria Lipponen + Studio Total" })).toEqual({
      action: "merge",
      into: [{ slug: "anna-maria-lipponen", name: "Anna-Maria Lipponen" }],
    });
  });

  it("drops groups and labels", () => {
    for (const name of ["Starman Työryhmä", "työryhmä", "Arbetsgruppen", "Koncept och manus", "Grafisk design och logga"]) {
      expect(personFix({ slug: "x", name })).toEqual({ action: "drop" });
    }
  });
});
