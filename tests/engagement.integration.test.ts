import "dotenv/config";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EmailMessage } from "@/lib/email";
import { parseDetail } from "@/scrapers/adapters/svenska-teatern";
import { upsertProduction } from "@/scrapers/normalise";

/** Runs only with TEST_DATABASE_URL (see upsert.integration.test.ts); wipes that database. */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("engagement (integration)", () => {
  type Db = Awaited<typeof import("@/lib/db")>["db"];
  let db: Db;
  let digests: typeof import("@/lib/engagement/send-digests");
  let facts: typeof import("@/lib/engagement/facts");
  let productionId: string;
  let lastPerformance: Date;
  const users: Record<string, string> = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.BETTER_AUTH_SECRET ??= "integration-secret";
    db = (await import("@/lib/db")).db;
    digests = await import("@/lib/engagement/send-digests");
    facts = await import("@/lib/engagement/facts");
    for (const table of ["report", "watchItem", "diaryEntry", "session", "user", "credit", "criticReview", "performance", "production", "person", "stage", "theatre", "tag"] as const) {
      await (db[table] as { deleteMany: () => Promise<unknown> }).deleteMany();
    }
    const theatre = await db.theatre.create({
      data: { slug: "svenska-teatern", name: "Svenska Teatern", city: "Helsinki", website: "https://svenskateatern.fi", sourceId: "svenska-teatern" },
    });
    const detail = parseDetail(readFileSync("fixtures/svenska-teatern/production-nattland.html", "utf8"), {
      externalId: "34985",
      url: "https://svenskateatern.fi/repertoar/nattland/",
      title: "Nattland",
    });
    productionId = (await upsertProduction(db, theatre, detail, new Date())).productionId;
    const last = await db.performance.findFirstOrThrow({ where: { productionId }, orderBy: { startsAt: "desc" } });
    lastPerformance = last.startsAt;
    for (const [name, optIn] of [["opted", true], ["seen", true], ["silent", false]] as const) {
      users[name] = (await db.user.create({ data: { email: `${name}@example.fi`, name, digestOptIn: optIn, locale: "sv" } })).id;
    }
    await db.diaryEntry.create({ data: { userId: users.seen, productionId, seenOn: new Date("2026-09-01T00:00:00Z") } });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("collects the facts badges and the year review need", async () => {
    const [entry] = await facts.getEntryFacts(users.seen);
    expect(entry.seenOn).toBe("2026-09-01");
    expect(entry.production).toMatchObject({ slug: "nattland-svenska-teatern", languages: ["sv"], theatre: { name: "Svenska Teatern" } });
    expect(entry.production.cast.length).toBeGreaterThan(0);
    expect(entry.production.finalPerformance).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await facts.theatreCount()).toBe(1);
  });

  it("emails opted-in users what closes soon, once a week, minus what they've seen", async () => {
    const asOf = new Date(lastPerformance.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sent: EmailMessage[] = [];
    const deps = { send: async (message: EmailMessage) => void sent.push(message), pause: async () => {} };

    expect(await digests.sendDigests(asOf, deps)).toEqual({ due: 2, sent: 1, empty: 1, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("opted@example.fi");
    expect(sent[0].subject).toBe("1 föreställning slutar snart");
    expect(sent[0].text).toContain("/sv/forestallning/nattland-svenska-teatern");
    expect(sent[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    // The same week again (a retry, a manual run): nothing is due.
    expect(await digests.sendDigests(new Date(asOf.getTime() + 60 * 60 * 1000), deps)).toMatchObject({ due: 0, sent: 0 });
  });

  it("leaves a failed send due for the next run", async () => {
    await db.user.update({ where: { id: users.opted }, data: { digestSentAt: null } });
    const asOf = new Date(lastPerformance.getTime() - 3 * 24 * 60 * 60 * 1000);
    const failing = { send: async () => Promise.reject(new Error("provider down")), pause: async () => {} };
    expect(await digests.sendDigests(asOf, failing)).toMatchObject({ sent: 0, failed: 1 });
    expect((await db.user.findUniqueOrThrow({ where: { id: users.opted } })).digestSentAt).toBeNull();
  });

  it("unsubscribes only with a valid signature", async () => {
    const link = new URL(digests.oneClickUrl(users.opted));
    expect(await digests.unsubscribe(users.opted, "forged")).toBe(false);
    expect(await digests.getDigestOptIn(users.opted)).toBe(true);
    expect(await digests.unsubscribe(link.searchParams.get("u") ?? "", link.searchParams.get("s") ?? "")).toBe(true);
    expect(await digests.getDigestOptIn(users.opted)).toBe(false);
  });

  it("remembers the locale the user opted in from", async () => {
    await digests.setDigest(users.silent, true, "en");
    expect(await db.user.findUniqueOrThrow({ where: { id: users.silent } })).toMatchObject({ digestOptIn: true, locale: "en" });
  });
});
