import { describe, expect, it } from "vitest";
import { hasFullSchedule } from "./theatres";

describe("hasFullSchedule", () => {
  it("is false for Espoo, whose adapter sets performancesPartial", () => {
    expect(hasFullSchedule("espoon-teatteri")).toBe(false);
  });

  it("is true for a theatre that lists its whole run", () => {
    expect(hasFullSchedule("svenska-teatern")).toBe(true);
  });

  it("is false for an unknown theatre", () => {
    expect(hasFullSchedule("no-such-theatre")).toBe(false);
  });
});
