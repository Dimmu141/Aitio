import { describe, expect, it } from "vitest";
import {
  cleanText,
  helsinkiToUtc,
  helsinkiWeekday,
  languageCodes,
  parseFinnishDate,
  slugify,
  stripGuestMarker,
  weekdaysIn,
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
