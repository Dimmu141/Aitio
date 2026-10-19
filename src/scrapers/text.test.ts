import { describe, expect, it } from "vitest";
import {
  cleanText,
  helsinkiToUtc,
  helsinkiWeekday,
  languageCodes,
  parseFinnishDate,
  personName,
  slugify,
  stripGuestMarker,
  weekdaysIn,
  yearFromWeekday,
  splitPeople,
} from "./text";

describe("helsinkiToUtc", () => {
  it("uses UTC+3 in summer time", () => {
    expect(helsinkiToUtc("2026-10-23", "18:30").toISOString()).toBe("2026-10-23T15:30:00.000Z");
  });

  it("uses UTC+2 in winter time", () => {
    expect(helsinkiToUtc("2026-12-19", "18:30").toISOString()).toBe("2026-12-19T16:30:00.000Z");
  });

  it("handles the day DST ends (25 Oct 2026)", () => {
    expect(helsinkiToUtc("2026-10-25", "19:00").toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });
});

describe("parseFinnishDate", () => {
  it("parses d.m.yyyy", () => {
    expect(parseFinnishDate("10.9.2026")?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("returns undefined for dates without a year", () => {
    expect(parseFinnishDate("23.10.")).toBeUndefined();
  });
});

describe("slugify", () => {
  it("keeps Nordic letters readable", () => {
    expect(slugify("Änglagård")).toBe("anglagard");
    expect(slugify("Seitsemän veljestä")).toBe("seitseman-veljesta");
    expect(slugify("10 år med Ted & Kaj")).toBe("10-ar-med-ted-ja-kaj");
  });
});

describe("cleanText", () => {
  it("collapses whitespace and nbsp", () => {
    expect(cleanText("  Katariina   Kirjavainen \n")).toBe("Katariina Kirjavainen");
  });
});

describe("languageCodes", () => {
  it("maps Swedish and Finnish language names", () => {
    expect(languageCodes("Finska, engelska, svenska. Textningskod NATT").sort()).toEqual(["en", "fi", "sv"]);
    expect(languageCodes("suomeksi ja ruotsiksi").sort()).toEqual(["fi", "sv"]);
  });
});

describe("stripGuestMarker", () => {
  it("removes guest markers", () => {
    expect(stripGuestMarker("Mawlawi Rahem (vier.)")).toBe("Mawlawi Rahem");
    expect(stripGuestMarker("Anna Gäst (gäst)")).toBe("Anna Gäst");
    expect(stripGuestMarker("Pia Runnakko")).toBe("Pia Runnakko");
  });
});

describe("weekdays", () => {
  it("reads Finnish and Swedish weekday adverbs", () => {
    expect(weekdaysIn("Tekstitys keskiviikkoisin ja perjantaisin.")).toEqual([3, 5]);
    expect(weekdaysIn("textning på lördagar")).toEqual([6]);
    expect(weekdaysIn("joka ilta")).toEqual([]);
  });

  it("uses the Helsinki weekday, not the UTC one", () => {
    // 23:30 UTC on Tuesday is already Wednesday in Helsinki.
    expect(helsinkiWeekday(new Date("2026-10-20T23:30:00Z"))).toBe(3);
  });
});

describe("languageCodes, more languages", () => {
  it("reads Espoo's language labels", () => {
    expect(languageCodes("suomi, englanti ja latvia")).toEqual(["fi", "en", "lv"]);
    expect(languageCodes("espanja")).toEqual(["es"]);
    expect(languageCodes("arabia")).toEqual(["ar"]);
    expect(languageCodes("sanaton")).toEqual(["zxx"]);
  });
});

describe("yearFromWeekday", () => {
  const near = new Date("2026-10-18T12:00:00Z");

  it("finds the year whose date falls on that weekday", () => {
    expect(yearFromWeekday(14, 11, "la", near)).toBe(2026); // Saturday 14.11.2026
    expect(yearFromWeekday(12, 1, "ti", near)).toBe(2027); // Tuesday 12.1.2027
  });

  it("returns null when no nearby year fits", () => {
    // 14.11. is a Friday in 2025, Saturday in 2026 and Sunday in 2027: never a Monday.
    expect(yearFromWeekday(14, 11, "ma", near)).toBeNull();
    expect(yearFromWeekday(14, 11, "xx", near)).toBeNull();
  });
});

describe("personName", () => {
  it.each([
    ["Anacarsis Ramos / Pornotráfico", "Anacarsis Ramos"],
    ["Ludwig van Beethoven", "Ludwig van Beethoven"],
    ["Karla Sánchez Kiwi", "Karla Sánchez Kiwi"],
    ["magu", "magu"],
    ["Anacarsis Ramos Josefina Orlainetan arkistojen pohjalta", null],
    ["  ", null],
  ])("%s", (raw, expected) => {
    expect(personName(raw)).toBe(expected);
  });
});

// Every case is a person record production held on 19 Oct 2026.
describe("splitPeople", () => {
  it.each([
    ["Max Martin ja ystävät", ["Max Martin"]],
    ["Anna-Maria Lipponen + Studio Total", ["Anna-Maria Lipponen"]],
    ["Carl Knif & Kristofer Möller", ["Carl Knif", "Kristofer Möller"]],
    ["Jonte Ramsten, Ville Virtanen och Birthe Wingren", ["Jonte Ramsten", "Ville Virtanen", "Birthe Wingren"]],
    ["Eva-Maria Dahlin och Lisa Lindén", ["Eva-Maria Dahlin", "Lisa Lindén"]],
    ["Kristian Smeds", ["Kristian Smeds"]],
    ["Pia Ingman m.fl.", ["Pia Ingman"]],
  ])("%s", (raw, people) => {
    expect(splitPeople(raw)).toEqual(people);
  });

  it("refuses role labels stored as names", () => {
    expect(splitPeople("Grafisk design och logga")).toEqual([]);
    expect(splitPeople("Koncept och manus")).toEqual([]);
  });

  it("never makes a person of a group or a company alone", () => {
    expect(splitPeople("ATR-tuotanto Oy")).toEqual([]);
    expect(splitPeople("ystävät")).toEqual([]);
  });
});
