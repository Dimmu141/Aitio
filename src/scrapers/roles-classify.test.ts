import { describe, expect, it } from "vitest";
import { classifyProduction, isConductorLabel, isInstrumentLabel } from "./classify";
import { mapRoleText } from "./roles";

describe("mapRoleText", () => {
  it.each([
    ["Ohjaus ja käsikirjoitus", ["DIRECTOR", "WRITER"]],
    ["Regi", ["DIRECTOR"]],
    ["Ohjaajan assistentti", ["OTHER"]],
    ["Författare", ["WRITER"]],
    ["Textbearbetning", ["ADAPTATION"]],
    // Dramatising someone else's work is not writing it (Seitsemän veljestä, 19 Oct 2026).
    ["Ohjaus ja dramatisointi", ["DIRECTOR", "ADAPTATION"]],
    ["Dramatisointi", ["ADAPTATION"]],
    ["Dramatisering och regi", ["DIRECTOR", "ADAPTATION"]],
    ["Käsikirjoitus ja dramatisointi", ["WRITER", "ADAPTATION"]],
    ["Regissör", ["DIRECTOR"]],
    ["Esitysoikeuksien valvoja", []],
    ["Apulaisohjaaja", ["OTHER"]],
    ["Regiassistent", ["OTHER"]],
    ["Av", ["WRITER"]],
    ["Lavastussuunnittelu", ["DESIGNER"]],
    ["Svensk översättning och dramaturg", ["TRANSLATOR"]],
    ["Koreografia", ["CHOREOGRAPHER"]],
    ["Uppföranderätt", []],
    // From HKT's live pages, 2026-10-18.
    ["Oikeuksien valvoja", []],
    ["Kirjailija", ["WRITER"]],
  ])("%s", (label, expected) => {
    expect(mapRoleText(label).sort()).toEqual([...expected].sort());
  });
});

describe("mapRoleText for arrangements", () => {
  it("does not read a musical arrangement as a dramatisation", () => {
    expect(mapRoleText("Musiikin sovitus")).not.toContain("ADAPTATION");
  });
});

describe("mapRoleText for dance and crew", () => {
  it("counts dancers and performers as cast", () => {
    expect(mapRoleText("Tanssijat")).toEqual(["CAST"]);
    expect(mapRoleText("Esiintyjät")).toEqual(["CAST"]);
    expect(mapRoleText("Dansare")).toEqual(["CAST"]);
    expect(mapRoleText("Lavalla")).toEqual(["CAST"]); // Espoo's Jättömailla, Oct 2026
  });

  it("does not credit assistants as choreographers", () => {
    expect(mapRoleText("Koreografinen assistentti")).toEqual(["OTHER"]);
    expect(mapRoleText("Koreografia")).toEqual(["CHOREOGRAPHER"]);
  });

  it("reads Swedish labels without false writers", () => {
    expect(mapRoleText("Av")).toEqual(["WRITER"]);
    expect(mapRoleText("Design av rekvisita")).toEqual(["DESIGNER"]);
    expect(mapRoleText("Manuskriptets översättning")).toEqual(["TRANSLATOR"]);
    expect(mapRoleText("Manuskript")).toEqual(["WRITER"]);
    expect(mapRoleText("Skenografia")).toEqual(["DESIGNER"]);
    expect(mapRoleText("På scen")).toEqual(["CAST"]);
    expect(mapRoleText("Bygge av scenografi")).toEqual([]);
    expect(mapRoleText("Intimitetskoreograf")).toEqual([]);
  });

  it("reads Takomo-style Finnish and English labels", () => {
    expect(mapRoleText("Näytelmä")).toEqual(["WRITER"]);
    expect(mapRoleText("Näyttelijät")).toEqual(["CAST"]);
    expect(mapRoleText("Directing")).toEqual(["DIRECTOR"]);
    expect(mapRoleText("Writer")).toEqual(["WRITER"]);
    expect(mapRoleText("Tuotanto")).toEqual([]);
    expect(mapRoleText("Teksti, ohjaus, sävellys, tuotanto ja esiintyminen")).toEqual(["DIRECTOR", "WRITER", "COMPOSER", "CAST"]);
  });

  it("does not credit a conductor as the composer", () => {
    expect(mapRoleText("Musiikinjohto")).toEqual(["OTHER"]);
    expect(mapRoleText("Kapellimestari")).toEqual(["OTHER"]);
    expect(mapRoleText("Musiikki")).toEqual(["COMPOSER"]);
  });

  it("skips photographers, technicians and mentors", () => {
    expect(mapRoleText("Esitysvalokuvat")).toEqual([]);
    expect(mapRoleText("Live-videokuvaajat")).toEqual([]);
    expect(mapRoleText("Ääniteknikko")).toEqual([]);
    expect(mapRoleText("Esiintyjäntyön mentori")).toEqual([]);
    expect(mapRoleText("Valosuunnittelu")).toEqual(["DESIGNER"]);
  });
});

describe("classifyProduction", () => {
  const base = { hasDirector: false, castCount: 0 };

  it("detects stand-up", () => {
    expect(classifyProduction({ ...base, title: "Iikka Kivi: Protestinauru stand up show" }).type).toBe("STANDUP");
  });

  it("detects concerts from the stage name", () => {
    expect(classifyProduction({ ...base, title: "Lavaklubin runoillat", stage: "Lavaklubi" }).type).toBe("CONCERT");
    expect(classifyProduction({ ...base, title: "Tommy Körberg – Unplugged" }).type).toBe("CONCERT");
  });

  it("detects talks", () => {
    expect(classifyProduction({ ...base, title: "Samtal om nedskärningar" }).type).toBe("TALK");
  });

  // The productions the 19 Oct review found without a genre.
  it.each([
    ["Litteraturfestivalen Gränslöst – Mellanrum", "TALK"],
    ["Ballader och oförskämdheter", "CONCERT"],
    ["Sånger från bottenvåningen", "CONCERT"],
    ["Humorlandskampen", "STANDUP"],
  ] as const)("reads %s as %s", (title, type) => {
    expect(classifyProduction({ ...base, title }).type).toBe(type);
  });

  it("knows confidently that open houses and job ads are not performances", () => {
    for (const title of ["Konstens natt 2026", "Kostymprovning under sportlovet", "Familjelördag 22 november", "Blaue Frau anställer"]) {
      expect(classifyProduction({ ...base, title })).toEqual({ type: "OTHER", confidence: 0.8 });
    }
  });

  it("treats a script and a director without a composer as a play, cast list or not", () => {
    expect(classifyProduction({ title: "Fröken Julie", hasDirector: true, hasWriter: true, castCount: 0 })).toEqual({
      type: "PLAY",
      confidence: 0.65,
    });
    // Next to Normal has a director, a writer and a composer: a musical, left for review.
    expect(classifyProduction({ title: "Next to Normal", hasDirector: true, hasWriter: true, hasComposer: true, castCount: 0 }).confidence).toBeLessThan(0.6);
  });

  // Svenska Teatern's own pages, 19 Oct 2026 (second review).
  it("reads a conductor next to a director as a musical (Mary Poppins)", () => {
    expect(classifyProduction({ title: "Mary Poppins", hasDirector: true, hasConductor: true, castCount: 12 }).type).toBe("MUSICAL");
  });

  it("reads 'Musikalen …' in the subtitle as a musical (Next to Normal)", () => {
    const next = classifyProduction({ title: "Next to Normal", subtitle: "Musikalen som inte lämnar någon oberörd", hasDirector: true, castCount: 0 });
    expect(next.type).toBe("MUSICAL");
  });

  it("reads a band credited player by player as a concert (Georg Malmstén & HumppAvanti!)", () => {
    const malmsten = { title: "Georg Malmstén & HumppAvanti!", hasDirector: true, hasConductor: true, musicianCount: 12, castCount: 1 };
    expect(classifyProduction(malmsten).type).toBe("CONCERT");
  });

  it("tells instruments and conductors apart from other labels", () => {
    expect(["Violin", "Trummor", "Kontrabas", "Piano"].every(isInstrumentLabel)).toBe(true);
    expect(isInstrumentLabel("Pianon virittäjä")).toBe(false);
    expect(["Kapellmästare", "Arrangemang och musikalisk ledning", "Kapellimestari"].every(isConductorLabel)).toBe(true);
    expect(isConductorLabel("Regi")).toBe(false);
  });

  it("knows a guided tour is not a performance (Topelius och teatern, stage 'Rundvandring')", () => {
    expect(classifyProduction({ title: "Topelius och teatern", stage: "Rundvandring", hasDirector: false, castCount: 1 })).toEqual({
      type: "OTHER",
      confidence: 0.8,
    });
  });

  it("treats a directed production with a cast as a play", () => {
    const result = classifyProduction({ title: "Nattland", hasDirector: true, castCount: 8 });
    expect(result).toEqual({ type: "PLAY", confidence: 0.7 });
  });

  it("treats a choreographed piece without a director as dance", () => {
    expect(classifyProduction({ title: "no-no", hasDirector: false, hasChoreographer: true, castCount: 9 })).toEqual({
      type: "DANCE",
      confidence: 0.7,
    });
    expect(classifyProduction({ ...base, title: "Helsinki Dance Company: Kvarnström" }).type).toBe("DANCE");
  });

  it("keeps a directed musical with a choreographer a play-or-musical, not dance", () => {
    expect(classifyProduction({ title: "Kotijoukot", hasDirector: true, hasChoreographer: true, castCount: 6 }).type).toBe("PLAY");
  });

  it("takes the source's own category over the keyword rules", () => {
    expect(classifyProduction({ ...base, title: "Hamlet", typeHint: "DANCE" })).toEqual({ type: "DANCE", confidence: 0.9 });
    expect(classifyProduction({ title: "Nattland", hasDirector: true, castCount: 8, typeHint: "OTHER" }).type).toBe("PLAY");
  });

  it("falls back to OTHER with low confidence", () => {
    expect(classifyProduction({ ...base, title: "Haapajärven Elvis" })).toEqual({ type: "OTHER", confidence: 0.2 });
  });
});
