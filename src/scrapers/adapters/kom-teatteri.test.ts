import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergePerformances, normaliseTitle, parseCalendar, parseDetail, parseList, parsePageDates } from "./kom-teatteri";

const fixture = (name: string) => readFileSync(`fixtures/kom-teatteri/${name}`, "utf8");

describe("KOM list and calendar", () => {
  it("reads the current productions from the repertoire page", () => {
    const list = parseList(fixture("ohjelmisto.html"));
    expect(list.map((item) => item.externalId)).toEqual([
      "poiskatsojat",
      "mysteriobuffo",
      "triokaipuu",
      "kuinka-tulla-tapio-rautavaaraksi",
    ]);
    expect(list[0].title).toBe("POISKATSOJAT"); // soft hyphens gone
  });

  it("reads calendar rows with venue but without the street address", () => {
    const rows = parseCalendar(fixture("kalenteri.html"));
    expect(rows[0]).toEqual({
      startsAt: new Date("2026-10-12T15:30:00Z"), // ma 12.10.2026 18.30
      show: "Mysterio Buffo",
      venue: "KOM-teatteri",
      ticketUrl: "https://kom.lippu.fi/webshop/webticket/shop?event=1307",
    });
    expect(rows.find((row) => row.show === "Kuinka tulla Tapio Rautavaaraksi")?.venue).toBe("Vuotalo");
  });

  it("matches titles regardless of capitals and soft hyphens", () => {
    expect(normaliseTitle("POIS­KAT­SO­JAT")).toBe(normaliseTitle("Poiskatsojat"));
  });
});

describe("KOM production page", () => {
  const detail = parseDetail(fixture("production-mysteriobuffo.html"), fixture("kalenteri.html"), {
    externalId: "mysteriobuffo",
    url: "https://kom-teatteri.fi/ohjelmisto/mysteriobuffo/",
    title: "MYSTERIO BUFFO",
  });

  it("takes the title's casing from the calendar", () => {
    expect(detail.title).toBe("Mysterio Buffo");
  });

  it("reads facts from free-form text", () => {
    expect(detail).toMatchObject({
      stage: "KOM-teatteri",
      durationText: "noin 1 h 40 min, sisältäen väliajan",
      premiereDate: new Date("2026-10-01T00:00:00Z"),
      languages: ["fi"],
    });
  });

  it("merges the page's dates with the calendar's tickets", () => {
    expect(detail.performances).toHaveLength(15);
    expect(detail.performances[0]).toEqual({ startsAt: new Date("2026-09-29T10:00:00Z"), stage: "KOM-teatteri" });
    const twoShows = detail.performances.filter((performance) => performance.startsAt.toISOString().startsWith("2026-10-31"));
    expect(twoShows).toHaveLength(2);
    expect(detail.performances.find((performance) => performance.startsAt.toISOString() === "2026-10-12T15:30:00.000Z")?.ticketUrl).toBe(
      "https://kom.lippu.fi/webshop/webticket/shop?event=1307",
    );
  });

  it("reads 'Role <strong>Name</strong>' lines and nothing from body text", () => {
    expect(detail.credits.map((credit) => [credit.name, credit.roles])).toEqual([
      ["Pyry Äikää", ["CAST"]],
      ["Dario Fo", ["WRITER"]],
      ["Erkki Saarela", ["DIRECTOR"]],
      ["Joel Mäkinen", ["COMPOSER"]],
      ["Joona Huotari-Andreou", ["DESIGNER"]],
    ]);
  });

  it("keeps the review link and byline, never the quote", () => {
    expect(detail.criticReviews).toEqual([
      {
        outlet: "Apu",
        critic: "Selina Keränen",
        url: "https://www.apu.fi/artikkelit/pyry-aikaa-otti-mysterio-buffon-heti-omakseen",
      },
    ]);
  });
});

describe("helpers", () => {
  it("reads two shows on one line and marks the premiere", () => {
    const dates = parsePageDates("LOKAKUU 2026\nto 1.10. klo 18.30 (ensi-ilta)\nla 31.10. klo 13.00 ja 18.30");
    expect(dates.performances).toEqual([
      new Date("2026-10-01T15:30:00Z"),
      new Date("2026-10-31T11:00:00Z"),
      new Date("2026-10-31T16:30:00Z"),
    ]);
    expect(dates.premiere).toEqual(new Date("2026-10-01T15:30:00Z"));
  });

  it("lets the calendar's venue win for the same start", () => {
    const at = new Date("2026-10-24T15:00:00Z");
    expect(mergePerformances([at], [{ startsAt: at, show: "x", venue: "Vuotalo", ticketUrl: "https://t.example/1" }])).toEqual([
      { startsAt: at, stage: "Vuotalo", ticketUrl: "https://t.example/1" },
    ]);
  });
});
