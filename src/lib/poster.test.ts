import { describe, expect, it } from "vitest";
import { POSTER_COLOURS, posterColour } from "./poster";

describe("posterColour", () => {
  it("is stable for a slug", () => {
    expect(posterColour("nattland-svenska-teatern")).toBe(posterColour("nattland-svenska-teatern"));
  });

  it("spreads slugs over every colour", () => {
    const seen = new Set(Array.from({ length: 200 }, (_, index) => posterColour(`esitys-${index}`)));
    expect(seen.size).toBe(POSTER_COLOURS.length);
  });
});
