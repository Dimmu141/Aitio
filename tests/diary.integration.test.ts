import "dotenv/config";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseDetail } from "@/scrapers/adapters/svenska-teatern";
import { upsertProduction } from "@/scrapers/normalise";
import type { EntryInput } from "@/lib/diary/entry-form";

/** Runs only with TEST_DATABASE_URL (see upsert.integration.test.ts); wipes that database. */
const url = process.env.TEST_DATABASE_URL;

const input: EntryInput = {
  performanceId: null,
  seenOn: "2026-10-17",
  rating: 8,
  review: "Stark kväll.",
  isPublic: true,
  isRewatch: false,
  tagSlugs: ["moving", "bold"],
};

describe.skipIf(!url)("diary service (integration)", () => {
  type Db = Awaited<typeof import("@/lib/db")>["db"];
  type Service = typeof import("@/lib/diary/service");
  let db: Db;
  let service: Service;
  let productionId: string;
  const users: Record<string, string> = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = (await import("@/lib/db")).db;
    service = await import("@/lib/diary/service");
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
    for (const [index, slug] of ["moving", "bold", "funny"].entries()) {
      await db.tag.create({ data: { slug, labelFi: slug, labelSv: slug, labelEn: slug, sortOrder: index } });
    }
    for (const name of ["anna", "bo", "cia", "dan", "eva"]) {
      users[name] = (await db.user.create({ data: { email: `${name}@example.fi`, name } })).id;
    }
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("saves an entry with tags and lists it in the diary", async () => {
    const saved = await service.saveEntry(users.anna, productionId, null, input);
    expect(saved).not.toBeNull();
    const diary = await service.getDiary(users.anna);
    expect(diary).toHaveLength(1);
    expect(diary[0]).toMatchObject({ rating: 8, review: "Stark kväll.", hidden: false, production: { title: "Nattland" } });
    expect(diary[0].seenOn.toISOString()).toBe("2026-10-17T00:00:00.000Z");
    expect(diary[0].tags.map((tag) => tag.slug)).toEqual(["moving", "bold"]);
  });

  it("refuses to edit or delete someone else's entry", async () => {
    const [entry] = await service.getDiary(users.anna);
    expect(await service.saveEntry(users.bo, productionId, entry.id, { ...input, review: "hijack" })).toBeNull();
    expect(await service.deleteEntry(users.bo, entry.id)).toBeNull();
    expect(await service.getOwnEntry(users.bo, productionId, entry.id)).toBeNull();
    expect((await service.getDiary(users.anna))[0].review).toBe("Stark kväll.");
  });

  it("knows whether a production can be logged yet", async () => {
    const asOf = new Date();
    const { slug } = await db.production.findUniqueOrThrow({ where: { id: productionId } });
    expect((await service.getLogContext(users.anna, slug, asOf))?.started).toBe(true);
    const { id: theatreId } = await db.theatre.findUniqueOrThrow({ where: { slug: "svenska-teatern" } });
    await db.production.create({
      data: {
        slug: "kommande",
        title: "Kommande",
        theatreId,
        externalId: "kommande",
        sourceUrl: "https://svenskateatern.fi/repertoar/kommande/",
        premiereDate: new Date(asOf.getTime() + 90 * 86_400_000),
        lastSeenAt: asOf,
      },
    });
    expect((await service.getLogContext(users.anna, "kommande", asOf))?.started).toBe(false);
    // Running since before our first scrape: only future dates stored, no stated premiere.
    const running = await db.production.create({
      data: { slug: "pagaende", title: "Pågående", theatreId, externalId: "pagaende", sourceUrl: "https://svenskateatern.fi/repertoar/pagaende/", lastSeenAt: asOf },
    });
    await db.performance.create({ data: { productionId: running.id, startsAt: new Date(asOf.getTime() + 86_400_000), lastSeenAt: asOf } });
    expect((await service.getLogContext(users.anna, "pagaende", asOf))?.started).toBe(true);
  });

  it("replaces tags on edit", async () => {
    const [entry] = await service.getDiary(users.anna);
    await service.saveEntry(users.anna, productionId, entry.id, { ...input, tagSlugs: ["funny"] });
    expect((await service.getOwnEntry(users.anna, productionId, entry.id))?.tagSlugs).toEqual(["funny"]);
  });

  it("hides a review after three distinct reports and ignores repeats and self-reports", async () => {
    const [entry] = await service.getDiary(users.anna);
    expect((await service.reportEntry(users.anna, entry.id, "SPAM")).outcome).toBe("own");
    expect(await service.reportEntry(users.bo, entry.id, "SPOILER")).toMatchObject({ outcome: "reported", hidden: false });
    expect((await service.reportEntry(users.bo, entry.id, "SPAM")).outcome).toBe("already");
    expect(await service.reportEntry(users.cia, entry.id, "OFFENSIVE")).toMatchObject({ hidden: false });
    expect(await service.reportEntry(users.dan, entry.id, "OTHER")).toMatchObject({ hidden: true });
    expect((await service.getDiary(users.anna))[0].hidden).toBe(true);
  });

  it("keeps a hidden review hidden when the author changes only the rating", async () => {
    const [entry] = await service.getDiary(users.anna);
    const current = await service.getOwnEntry(users.anna, productionId, entry.id);
    await service.saveEntry(users.anna, productionId, entry.id, { ...input, review: current?.review ?? null, rating: 2 });
    expect((await service.getDiary(users.anna))[0].hidden).toBe(true);
    expect(await db.report.count({ where: { entryId: entry.id, resolvedAt: null } })).toBe(3);
  });

  it("unhides an edited review and closes the old reports", async () => {
    const [entry] = await service.getDiary(users.anna);
    await service.saveEntry(users.anna, productionId, entry.id, { ...input, review: "Omskriven." });
    expect((await service.getDiary(users.anna))[0].hidden).toBe(false);
    expect(await db.report.count({ where: { entryId: entry.id, resolvedAt: null } })).toBe(0);
  });

  it("lets an earlier reporter report the edited text again", async () => {
    const [entry] = await service.getDiary(users.anna);
    expect(await service.reportEntry(users.bo, entry.id, "OFFENSIVE")).toMatchObject({ outcome: "reported" });
    expect((await service.reportEntry(users.bo, entry.id, "SPAM")).outcome).toBe("already");
    await db.report.updateMany({ where: { entryId: entry.id }, data: { resolvedAt: new Date() } });
  });

  it("lists reported reviews for moderation and applies the decision", async () => {
    const [entry] = await service.getDiary(users.anna);
    await service.reportEntry(users.eva, entry.id, "OFFENSIVE");
    const queue = await service.moderationQueue();
    expect(queue).toEqual([expect.objectContaining({ entryId: entry.id, reasons: { OFFENSIVE: 1 }, hidden: false })]);
    expect(await service.moderate(entry.id, true)).toBe("nattland-svenska-teatern");
    expect((await service.getDiary(users.anna))[0].hidden).toBe(true);
    expect(await service.moderationQueue()).toEqual([]);
    await service.moderate(entry.id, false);
    expect((await service.getDiary(users.anna))[0].hidden).toBe(false);
  });

  it("keeps a moderator's hide even when the author rewrites the text", async () => {
    const [entry] = await service.getDiary(users.anna);
    await service.moderate(entry.id, true);
    await service.saveEntry(users.anna, productionId, entry.id, { ...input, review: "Samma sak, ny stavning." });
    expect((await service.getDiary(users.anna))[0].hidden).toBe(true);
    await service.moderate(entry.id, false);
  });

  it("deletes the account with its diary and reports", async () => {
    await service.saveEntry(users.eva, productionId, null, input);
    const [entry] = await service.getDiary(users.eva);
    await service.reportEntry(users.anna, entry.id, "SPAM");
    expect(await service.deleteAccount(users.eva)).toEqual(["nattland-svenska-teatern"]);
    expect(await db.user.findUnique({ where: { id: users.eva } })).toBeNull();
    expect(await db.diaryEntry.count({ where: { userId: users.eva } })).toBe(0);
    expect(await db.report.count({ where: { entryId: entry.id } })).toBe(0);
  });

  it("exports the user's data", async () => {
    const data = await service.exportData(users.anna);
    expect(data.user.email).toBe("anna@example.fi");
    expect(data.diary[0]).toMatchObject({ production: "Nattland", seenOn: "2026-10-17" });
    // Sign-in metadata is part of "everything", the session token is not.
    await db.session.create({ data: { token: "secret-token", userId: users.anna, expiresAt: new Date(Date.now() + 1e9), ipAddress: "10.0.0.9" } });
    const withSession = await service.exportData(users.anna);
    expect(withSession.sessions).toEqual([expect.objectContaining({ ipAddress: "10.0.0.9" })]);
    expect(JSON.stringify(withSession)).not.toContain("secret-token");
  });

  it("keeps a private want-to-see list, clears an item once logged, and exports it", async () => {
    const watchlist = await import("@/lib/diary/watchlist");
    const fia = (await db.user.create({ data: { email: "fia@example.fi", name: "fia" } })).id;
    const slug = (await db.production.findUniqueOrThrow({ where: { id: productionId }, select: { slug: true } })).slug;
    expect(await watchlist.addToWatchlist(fia, slug)).toBe(true);
    expect(await watchlist.addToWatchlist(fia, slug)).toBe(true); // twice is harmless
    expect(await watchlist.addToWatchlist(fia, "no-such-show")).toBe(false);
    expect(await watchlist.watchlistCount(fia)).toBe(1);
    const list = await watchlist.getWatchlist(fia, new Date());
    expect([...list.playing, ...list.gone].map((card) => card.slug)).toEqual([slug]);
    expect((await service.exportData(fia)).watchlist).toHaveLength(1);

    await service.saveEntry(fia, productionId, null, { ...input, review: null });
    expect(await watchlist.isOnWatchlist(fia, slug)).toBe(false);

    await watchlist.addToWatchlist(fia, slug);
    await watchlist.removeFromWatchlist(fia, slug);
    expect(await watchlist.watchlistCount(fia)).toBe(0);
  });
});
