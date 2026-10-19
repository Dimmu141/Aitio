import { describe, expect, it } from "vitest";
import { dictionaryFor } from "@/i18n/dictionaries";
import { subtitleText } from "./PerformanceList";

describe("subtitleText", () => {
  it("names the languages instead of printing codes", () => {
    expect(subtitleText(["en", "fi"], dictionaryFor("fi"))).toBe("Tekstitys: englanti, suomi");
    expect(subtitleText(["fi"], dictionaryFor("en"))).toBe("Subtitles: Finnish");
  });

  it("never offers 'wordless' as subtitles (BullyBully showed 'Tekstitys ZXX')", () => {
    expect(subtitleText(["zxx"], dictionaryFor("fi"))).toBeNull();
    expect(subtitleText(["zxx", "sv"], dictionaryFor("sv"))).toBe("Textning: svenska");
  });
});
