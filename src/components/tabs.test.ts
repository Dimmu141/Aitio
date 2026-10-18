import { describe, expect, it } from "vitest";
import { activeTab } from "./tabs";

describe("activeTab", () => {
  it.each([
    ["/", "fi", "programme"],
    ["/esitys/nattland", "fi", "programme"],
    ["/sv/forestallning/nattland", "sv", "programme"],
    ["/en", "en", "programme"],
    ["/paivakirja", "fi", "diary"],
    ["/paivakirja/2026", "fi", "diary"],
    ["/en/diary", "en", "diary"],
    ["/sv/installningar", "sv", "settings"],
    ["/fi/asetukset", "fi", "settings"],
    ["/haku", "fi", "search"],
    ["/en/search", "en", "search"],
    ["/tietosuoja", "fi", null],
    ["/paivakirjat", "fi", null],
  ] as const)("%s (%s) → %s", (pathname, locale, tab) => {
    expect(activeTab(pathname, locale)).toBe(tab);
  });
});
