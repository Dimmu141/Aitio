import { describe, expect, it } from "vitest";
import { classifyProduction } from "./classify";
import { mapRoleText } from "./roles";

describe("mapRoleText", () => {
  it.each([
    ["Ohjaus ja käsikirjoitus", ["DIRECTOR", "WRITER"]],
    ["Regi", ["DIRECTOR"]],
    ["Ohjaajan assistentti", ["OTHER"]],
    ["Författare", ["WRITER"]],
    ["Textbearbetning", ["WRITER"]],
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
    expect(classifyProduction({ ...base, title: "Konstens natt 2026" })).toEqual({ type: "OTHER", confidence: 0.2 });
  });
});
