import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Runs only with TEST_DATABASE_URL (see upsert.integration.test.ts); wipes ScrapeRun there. */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("scrape monitoring (integration)", () => {
  type Db = Awaited<typeof import("@/lib/db")>["db"];
  let db: Db;
  let runs: typeof import("@/lib/ops/runs");
  const now = new Date("2026-10-19T03:30:00Z");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = (await import("@/lib/db")).db;
    runs = await import("@/lib/ops/runs");
    await db.scrapeRun.deleteMany();
    await db.scrapeRun.createMany({
      data: [
        { sourceId: "hkt", status: "RUNNING", startedAt: new Date("2026-10-19T03:00:00Z") },
        { sourceId: "kom-teatteri", status: "RUNNING", startedAt: new Date("2026-10-19T03:25:00Z") },
        {
          sourceId: "espoon-teatteri",
          status: "SUCCESS",
          startedAt: new Date("2026-10-18T03:50:00Z"),
          itemsFound: 12,
          itemsChanged: 10,
          errors: [{ url: "https://x/1", error: "HTTP 500" }, { url: "https://x/2", error: "HTTP 500" }],
        },
        {
          sourceId: "ryhmateatteri",
          status: "FAILED",
          startedAt: new Date("2026-10-18T03:30:00Z"),
          errors: { message: "source returned 0 productions", failed: [] },
        },
      ],
    });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("closes runs the time limit killed, and only those", async () => {
    expect(await runs.closeStuckRuns(now)).toBe(1);
    const rows = await runs.recentRuns();
    expect(rows.find((row) => row.sourceId === "hkt")).toMatchObject({ status: "FAILED", message: "timed out (function time limit?)" });
    expect(rows.find((row) => row.sourceId === "kom-teatteri")?.status).toBe("RUNNING");
  });

  it("reads failure counts and messages from both error shapes", async () => {
    const rows = await runs.recentRuns();
    expect(rows.find((row) => row.sourceId === "espoon-teatteri")).toMatchObject({ failedDetails: 2, message: null });
    expect(rows.find((row) => row.sourceId === "ryhmateatteri")).toMatchObject({
      failedDetails: 0,
      message: "source returned 0 productions",
    });
  });
});
