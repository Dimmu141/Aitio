import { describe, expect, it } from "vitest";
import { currentPerformances } from "./freshness";

describe("currentPerformances", () => {
  const lastRun = new Date("2026-10-18T03:00:00Z");

  it("keeps performances seen in the production's latest scrape", () => {
    const seen = { id: "seen", lastSeenAt: lastRun };
    const cancelled = { id: "cancelled", lastSeenAt: new Date("2026-10-17T03:00:00Z") };
    expect(currentPerformances([seen, cancelled], lastRun)).toEqual([seen]);
  });
});
