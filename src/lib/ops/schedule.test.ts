import { describe, expect, it } from "vitest";
import { hasBearer } from "./bearer";
import { health, needsAlert, nextSource, overdueSources, ranRecently, type RunSummary } from "./schedule";

const now = new Date("2026-10-19T03:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
const run = (overrides: Partial<RunSummary>): RunSummary => ({
  sourceId: "hkt",
  status: "SUCCESS",
  startedAt: hoursAgo(24),
  itemsFound: 40,
  failedDetails: 0,
  ...overrides,
});

describe("ranRecently", () => {
  it("blocks a second successful run within 20 hours, not after", () => {
    expect(ranRecently([run({ startedAt: hoursAgo(2) })], "hkt", now)).toBe(true);
    expect(ranRecently([run({ startedAt: hoursAgo(23) })], "hkt", now)).toBe(false);
  });

  it("does not count failures or other sources", () => {
    expect(ranRecently([run({ startedAt: hoursAgo(2), status: "FAILED" })], "hkt", now)).toBe(false);
    expect(ranRecently([run({ startedAt: hoursAgo(2), sourceId: "kom-teatteri" })], "hkt", now)).toBe(false);
  });
});

describe("nextSource", () => {
  it("picks a never-run source first, then the oldest", () => {
    const runs = [run({ sourceId: "a", startedAt: hoursAgo(5) }), run({ sourceId: "b", startedAt: hoursAgo(30) })];
    expect(nextSource(["a", "b", "c"], runs)).toBe("c");
    expect(nextSource(["a", "b"], runs)).toBe("b");
    expect(nextSource([], runs)).toBeNull();
  });
});

describe("health", () => {
  it("reads the latest run", () => {
    expect(health(undefined, now)).toBe("never");
    expect(health(run({}), now)).toBe("ok");
    expect(health(run({ status: "FAILED" }), now)).toBe("failed");
    expect(health(run({ failedDetails: 11 }), now)).toBe("partial");
    expect(health(run({ status: "RUNNING", startedAt: hoursAgo(0.1) }), now)).toBe("running");
    expect(health(run({ status: "RUNNING", startedAt: hoursAgo(1) }), now)).toBe("stuck");
  });

  it("alerts on failed, partial and stuck runs only", () => {
    expect(["ok", "partial", "failed", "stuck", "running", "never"].filter((h) => needsAlert(h as never))).toEqual([
      "partial",
      "failed",
      "stuck",
    ]);
  });
});

describe("overdueSources", () => {
  const ids = ["hkt", "espoon-teatteri"];

  it("flags a source whose last success is over 26 hours old, or that never ran", () => {
    // espoon-teatteri on 20 Oct 2026: one run, at 14:22 on the 18th.
    expect(overdueSources(ids, [run({ startedAt: hoursAgo(25) }), run({ sourceId: "espoon-teatteri", startedAt: hoursAgo(37) })], now)).toEqual([
      "espoon-teatteri",
    ]);
    expect(overdueSources(ids, [run({ startedAt: hoursAgo(25) })], now)).toEqual(["espoon-teatteri"]);
  });

  it("does not count a failed run as fresh", () => {
    expect(overdueSources(["hkt"], [run({ startedAt: hoursAgo(1), status: "FAILED" }), run({ startedAt: hoursAgo(30) })], now)).toEqual(["hkt"]);
  });
});

describe("hasBearer", () => {
  it("needs the exact secret", () => {
    expect(hasBearer("Bearer s3cret", "s3cret")).toBe(true);
    expect(hasBearer("Bearer s3cre", "s3cret")).toBe(false);
    expect(hasBearer("s3cret", "s3cret")).toBe(false);
    expect(hasBearer("Bearer x", undefined)).toBe(false);
  });
});
