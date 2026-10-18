import { describe, expect, it } from "vitest";
import { fi } from "@/i18n/dictionaries/fi";
import { typeLabel } from "./type-label";

describe("typeLabel", () => {
  it("names known types", () => {
    expect(typeLabel("PLAY", fi)).toBe("Näytelmä");
  });

  it("shows nothing for the classifier's don't-know", () => {
    expect(typeLabel("OTHER", fi)).toBeNull();
  });
});
