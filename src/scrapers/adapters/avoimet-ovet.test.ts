import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseTitle, CALENDAR_URL, creditsFromLine, detailFromCalendar, parseCalendar, parseDetail, parseList } from "./avoimet-ovet";

const fixture = (name: string) => readFileSync(`fixtures/avoimet-ovet/${name}`, "utf8");
const calendarHtml = fixture("kalenteri.html");
const events = parseCalendar(calendarHtml);
const list = parseList(calendarHtml);
const ref = (externalId: string) => {
  const found = list.find((item) => item.externalId === externalId);
  if (!found) throw new Error(`${externalId} not in the list`);
  return found;
};

describe("Avoimet Ovet calendar and list", () => {
  it("reads every event of the season with its year, in Helsinki time", () => {
    expect(events).toHaveLength(54);
    expect(events[0]).toEqual({
      title: "Sutela & Salminen Stand up",
      startsAt: new Date("2026-08-29T13:00:00Z"), // la 29.8.2026 16.00
      url: "https://www.lippu.fi/artist/sutela-ja-salminen/sutela-salminen-stand-up-k18-4159529/#calendar-start=2026-08",
    });
  });

  it("strips premiere, preview and event notes from calendar titles", () => {
    expect(baseTitle("Soteorpo ENSI-ILTA")).toBe("Soteorpo");
    expect(baseTitle("Soteorpo (Näytelmä tutuksi klo 15)")).toBe("Soteorpo");
  });

  it("lists one production per page, and guest nights by title", () => {
    expect(list.map((item) => item.externalId).sort()).toEqual([
      "aurinkokuninkaani",
      "ilta-rivieralla",
      "jaakko-saariluoma-stand-up",
      "kullervo",
      "magdag",
      "mikko-vaismaa-stand-up",
      "niitylta-tuulee",
      "soteorpo",
      "sutela-ja-salminen-stand-up",
      "tomi-haustola-stand-up",
    ]);
    expect(ref("soteorpo")).toEqual({
      externalId: "soteorpo",
      title: "Soteorpo",
      url: "https://www.avoimetovet.fi/soteorpo/",
      isVisiting: false,
    });
  });

  it("marks the menu's visiting programme and guest nights as visiting", () => {
    expect(ref("aurinkokuninkaani").isVisiting).toBe(true);
    expect(ref("niitylta-tuulee").isVisiting).toBe(true);
    expect(ref("magdag").isVisiting).toBe(false);
    expect(ref("tomi-haustola-stand-up")).toMatchObject({ url: CALENDAR_URL, isVisiting: true });
  });
});

describe("Avoimet Ovet production page", () => {
  const soteorpo = parseDetail(fixture("production-soteorpo.html"), ref("soteorpo"), events);

  it("takes the schedule from the calendar, with the premiere", () => {
    expect(soteorpo.performances).toHaveLength(25);
    expect(soteorpo.performances.filter((performance) => performance.startsAt >= new Date("2026-10-13"))).toHaveLength(13);
    expect(soteorpo.performances[0]).toEqual({ startsAt: new Date("2026-09-07T15:30:00Z"), stage: "Teatteri Avoimet Ovet" });
    expect(soteorpo).toMatchObject({
      premiereDate: new Date("2026-09-08T00:00:00Z"),
      runEnd: new Date("2026-11-21T14:00:00Z"),
      performancesPartial: false,
    });
  });

  it("reads facts and the outbound ticket link", () => {
    expect(soteorpo).toMatchObject({
      title: "Soteorpo",
      durationText: "n. 2 h 10 min sis. väliajan",
      ticketUrl: "https://www.lippu.fi/artist/teatteri-avoimet-ovet/soteorpo-4149045/",
      languages: ["fi"],
      criticReviews: [],
    });
  });

  it("reads 'role <strong>Name</strong>' lines, not bold names in body text", () => {
    expect(soteorpo.credits.map((credit) => [credit.name, credit.roles])).toEqual([
      ["Ella Pyhältö", ["CAST"]],
      ["Heikki Kujanpää", ["CAST"]],
      ["Minna Lindgren", ["WRITER"]],
      ["Hanna Kirjavainen", ["DIRECTOR", "ADAPTATION"]],
      ["Suvi Saari", ["DESIGNER"]],
      ["Saija Raskulla", ["DESIGNER"]],
      ["Janne Saarinen", ["DESIGNER"]],
      ["Satu Lankinen", ["DESIGNER"]],
      ["Hanna Kirjavainen", ["DESIGNER"]],
      ["Satu Lankinen", ["OTHER"]],
    ]);
  });

  it("skips producers and press lines", () => {
    expect(creditsFromLine("tuotanto <strong>Teatteri Avoimet Ovet</strong>")).toEqual([]);
    expect(creditsFromLine("PR <strong>Elisabet Kedziora </strong>&amp;<strong> Andréa Arlid</strong>")).toEqual([]);
    expect(creditsFromLine("<strong>Kesto</strong> n. 2 h")).toEqual([]);
  });

  it("keeps the WordPress title's dash for a two-line heading", () => {
    const magda = parseDetail(fixture("production-magdag.html"), ref("magdag"), events);
    expect(magda.title).toBe("Magda G – Valtakunnan äiti");
    expect(magda.performances).toHaveLength(6);
    expect(magda.runStart).toEqual(new Date("2027-04-10T13:00:00Z"));
    expect(magda.credits.map((credit) => [credit.name, credit.roles])).toEqual([
      ["Anna-Elina Lyytikäinen", ["DIRECTOR"]],
      ["Veera Tyhtilä", ["WRITER"]],
      ["Marika Heiskanen", ["CAST"]],
      ["Sanna Salmenkallio", ["DESIGNER"]],
    ]);
  });

  it("reads the stated language and bilingual role labels", () => {
    const kullervo = parseDetail(fixture("production-kullervo.html"), ref("kullervo"), events);
    expect(kullervo.languages.sort()).toEqual(["fi", "sv"]);
    expect(kullervo.durationText).toBe("n. 50 minuuttia, ei väliaikaa");
    expect(kullervo.credits.find((credit) => credit.roleText === "ohjaus / regi")?.name).toBe("Antti Silvennoinen");
    expect(kullervo.credits.filter((credit) => credit.roles.includes("CAST"))).toHaveLength(5);
  });

  it("treats 'Näyttelijät' as cast and a child's voice as cast, not sound design", () => {
    const aurinko = parseDetail(fixture("production-aurinkokuninkaani.html"), ref("aurinkokuninkaani"), events);
    const cast = aurinko.credits.filter((credit) => credit.roles.includes("CAST")).map((credit) => credit.name);
    expect(cast).toEqual(["Emmi Nieminen", "Emma-Sofia Hautala", "Hannes Kulmala-Rantala"]);
    expect(aurinko.isVisiting).toBe(true);
  });
});

describe("Avoimet Ovet guest nights", () => {
  it("builds the detail from the calendar alone, with the ticket link as a link", () => {
    const detail = detailFromCalendar(ref("tomi-haustola-stand-up"), events);
    expect(detail.performances.map((performance) => performance.startsAt)).toEqual([
      new Date("2026-12-04T16:00:00Z"),
      new Date("2026-12-04T18:00:00Z"),
    ]);
    expect(detail.ticketUrl).toBe("https://www.lippu.fi/artist/tomi-haustola/tomi-haustola-stand-up-k18-4159517/#calendar-start=2026-12");
    expect(detail.credits).toEqual([]);
  });
});
