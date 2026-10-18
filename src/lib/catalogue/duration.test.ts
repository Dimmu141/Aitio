import { describe, expect, it } from "vitest";
import { parseDuration } from "./duration";

describe("parseDuration", () => {
  it.each([
    ["1 t, ei väliaikaa", 60, 0],
    ["1 t 40 min, sis. väliajan (25 min) (arvioitu kesto, tarkentuu ensi-iltaviikolla)", 100, 1],
    ["ca 2 h 30 min med paus", 150, 1],
    ["n. 2h 50min, sisältäen väliajan", 170, 1],
    ["Ca 80min, det är ingen paus i föreställningen. Längden bekräftas under premiärveckan.", 80, 0],
    ["ca 2 h 40 min inkl paus (20-25 min)", 160, 1],
    ["1 h 45 min (sis. 2 väliaikaa)", 105, 2],
    ["3 t, sis. 2 väliaikaa (25 min)", 180, 2],
    ["n. 70 min", 70, null],
    ["3 H (sis. väliaika)", 180, 1],
    ["1,5h ei väliaikaa", 90, 0],
    ["n. 2,5 h (sis. väliaika)", 150, 1],
    ["n. 1 tunti, ei väliaikaa", 60, 0],
    ["noin 2h15min, sisältää väliajan", 135, 1],
    ["2 h, inkl 20 min paus", 120, 1],
    ["90 minuter, ingen paus", 90, 0],
    ["Yhteensä noin 1 t 30 min", 90, null],
    ["Noin 2 h (sis. väliaika), arkiaamunäytökset noin 1 h (ei väliaikaa)", 120, 1],
    ["Ilmoitetaan ensi-illan alla. Sisältää väliajan.", null, 1],
  ] as const)("%s", (text, minutes, intervals) => {
    expect(parseDuration(text)).toEqual({ minutes, intervals });
  });

  it("returns null when the text says nothing usable", () => {
    expect(parseDuration(null)).toBeNull();
    expect(parseDuration("Ilmoitetaan myöhemmin")).toBeNull();
  });
});
