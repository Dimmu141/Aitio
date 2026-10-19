import { describe, expect, it } from "vitest";
import { durationLabel, parseDuration } from "./duration";

describe("parseDuration", () => {
  it.each([
    ["1 t, ei väliaikaa", 60, 0, false],
    ["1 t 40 min, sis. väliajan (25 min) (arvioitu kesto, tarkentuu ensi-iltaviikolla)", 100, 1, true],
    ["ca 2 h 30 min med paus", 150, 1, false],
    ["n. 2h 50min, sisältäen väliajan", 170, 1, false],
    ["Ca 80min, det är ingen paus i föreställningen. Längden bekräftas under premiärveckan.", 80, 0, true],
    ["ca 2 h 40 min inkl paus (20-25 min)", 160, 1, false],
    ["1 h 45 min (sis. 2 väliaikaa)", 105, 2, false],
    ["3 t, sis. 2 väliaikaa (25 min)", 180, 2, false],
    ["n. 70 min", 70, null, false],
    ["3 H (sis. väliaika)", 180, 1, false],
    ["1,5h ei väliaikaa", 90, 0, false],
    ["n. 2,5 h (sis. väliaika)", 150, 1, false],
    ["n. 1 tunti, ei väliaikaa", 60, 0, false],
    ["noin 2h15min, sisältää väliajan", 135, 1, false],
    ["2 h, inkl 20 min paus", 120, 1, false],
    ["90 minuter, ingen paus", 90, 0, false],
    ["Yhteensä noin 1 t 30 min", 90, null, false],
    ["Noin 2 h (sis. väliaika), arkiaamunäytökset noin 1 h (ei väliaikaa)", 120, 1, false],
    ["Ilmoitetaan ensi-illan alla. Sisältää väliajan.", null, 1, false],
  ] as const)("%s", (text, minutes, intervals, estimate) => {
    expect(parseDuration(text)).toEqual({ minutes, intervals, estimate });
  });

  it("returns null when the text says nothing usable", () => {
    expect(parseDuration(null)).toBeNull();
    expect(parseDuration("Ilmoitetaan myöhemmin")).toBeNull();
  });
});

describe("durationLabel", () => {
  const labels = {
    durationShort: (minutes: number) => `${Math.floor(minutes / 60)} t ${minutes % 60} min`,
    intervals: (n: number) => (n === 0 ? "ei väliaikaa" : "väliaika"),
    approximately: "noin",
  };

  it("replaces the source text with the compact form", () => {
    expect(durationLabel(parseDuration("2 h 45 min (sisältää väliajan)"), labels)).toBe("2 t 45 min, väliaika");
  });

  it("says when the theatre's time is an estimate, where asked", () => {
    const duration = parseDuration("2 t 45 min, sis. väliajan (25 min) (arvioitu kesto, tarkentuu ensi-iltaviikolla)");
    expect(durationLabel(duration, labels, true)).toBe("noin 2 t 45 min, väliaika");
    expect(durationLabel(duration, labels)).toBe("2 t 45 min, väliaika");
  });

  it("shows nothing without a running time", () => {
    expect(durationLabel(parseDuration("TBA"), labels)).toBeNull();
    expect(durationLabel(parseDuration("Ilmoitetaan ensi-illan alla. Sisältää väliajan."), labels)).toBeNull();
  });
});
