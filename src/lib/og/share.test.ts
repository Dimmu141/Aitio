import { describe, expect, it } from "vitest";
import { shareImagePath } from "@/lib/metadata";
import { titleSize } from "./image";

describe("shareImagePath", () => {
  it("gives productions, theatres and people their own image, under /api so no proxy redirect is involved", () => {
    expect(shareImagePath("fi", "esitys", "seitseman-veljesta-kansallisteatteri")).toBe(
      "/api/og/esitys/seitseman-veljesta-kansallisteatteri?l=fi",
    );
    expect(shareImagePath("sv", "teatteri", "svenska-teatern")).toBe("/api/og/teatteri/svenska-teatern?l=sv");
    expect(shareImagePath("en", "henkilo", "kristian-smeds")).toBe("/api/og/henkilo/kristian-smeds?l=en");
  });

  it("falls back to the site card elsewhere", () => {
    expect(shareImagePath("fi")).toBe("/api/og?l=fi");
    expect(shareImagePath("en", "tietoa")).toBe("/api/og?l=en");
  });
});

describe("titleSize", () => {
  it("steps down for long titles", () => {
    expect(titleSize("Kärpäset")).toBe(112);
    expect(titleSize("Mumindalens sagostund: Historien om den sista draken i världen")).toBe(68);
    expect(titleSize("x".repeat(90))).toBe(56);
  });
});
