import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Runs only with TEST_DATABASE_URL (see upsert.integration.test.ts); wipes that database. */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("launch housekeeping (integration)", () => {
  type Db = Awaited<typeof import("@/lib/db")>["db"];
  let db: Db;
  const now = new Date("2026-10-18T02:30:00Z");
  const hours = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = (await import("@/lib/db")).db;
    for (const table of ["report", "diaryEntry", "session", "verification", "rateLimit", "user"] as const) {
      await (db[table] as { deleteMany: () => Promise<unknown> }).deleteMany();
    }
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("deletes expired sessions, sign-in tokens and old rate-limit rows, and nothing else", async () => {
    const { cleanup } = await import("@/lib/ops/cleanup");
    const user = await db.user.create({ data: { email: "clean@example.fi" } });
    await db.session.createMany({
      data: [
        { token: "old", userId: user.id, expiresAt: hours(-1), ipAddress: "10.0.0.1" },
        { token: "live", userId: user.id, expiresAt: hours(24) },
      ],
    });
    await db.verification.createMany({
      data: [
        { identifier: "a", value: "x", expiresAt: hours(-1) },
        { identifier: "b", value: "y", expiresAt: hours(1) },
      ],
    });
    await db.rateLimit.createMany({
      data: [
        { key: "magic:email:old@example.fi", count: 1, lastRequest: BigInt(hours(-72).getTime()) },
        { key: "diary:recent", count: 1, lastRequest: BigInt(hours(-20).getTime()) },
      ],
    });

    expect(await cleanup(now)).toEqual({ rateLimits: 1, sessions: 1, verifications: 1 });
    expect((await db.session.findMany()).map((session) => session.token)).toEqual(["live"]);
    expect((await db.verification.findMany()).map((row) => row.identifier)).toEqual(["b"]);
    expect((await db.rateLimit.findMany()).map((row) => row.key)).toEqual(["diary:recent"]);
  });

  it("stops the digest for an address the provider reports as dead", async () => {
    const { stopDigestFor } = await import("@/lib/engagement/send-digests");
    await db.user.create({ data: { email: "bounce@example.fi", digestOptIn: true } });
    expect(await stopDigestFor(" Bounce@Example.fi ")).toBe(1);
    expect(await stopDigestFor("bounce@example.fi")).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { email: "bounce@example.fi" } })).digestOptIn).toBe(false);
  });
});
