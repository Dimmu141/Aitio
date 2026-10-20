import "dotenv/config";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseDetail } from "@/scrapers/adapters/svenska-teatern";
import { upsertProduction } from "@/scrapers/normalise";

/**
 * Runs only when TEST_DATABASE_URL points at a disposable, migrated database.
 * Example: TEST_DATABASE_URL=postgresql://postgres@localhost:5432/aitio_test pnpm test
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("upsertProduction (integration)", () => {
  let db: Awaited<typeof import("@/lib/db")>["db"];
  let theatre: { id: string; slug: string };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = (await import("@/lib/db")).db;
    await db.report.deleteMany();
    await db.watchItem.deleteMany();
    await db.diaryEntry.deleteMany();
    await db.user.deleteMany();
    await db.credit.deleteMany();
    await db.criticReview.deleteMany();
    await db.performance.deleteMany();
    await db.production.deleteMany();
    await db.person.deleteMany();
    await db.stage.deleteMany();
    await db.theatre.deleteMany();
    theatre = await db.theatre.create({
      data: { slug: "svenska-teatern", name: "Svenska Teatern", city: "Helsinki", website: "https://svenskateatern.fi", sourceId: "svenska-teatern" },
    });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  const detail = parseDetail(readFileSync("fixtures/svenska-teatern/production-nattland.html", "utf8"), {
    externalId: "34985",
    url: "https://svenskateatern.fi/repertoar/nattland/",
    title: "Nattland",
  });

  it("creates the production with performances, people and credits", async () => {
    const summary = await upsertProduction(db, theatre, detail, new Date());
    expect(summary).toMatchObject({ created: true, changed: true, slug: "nattland-svenska-teatern", performances: 7 });

    const saved = await db.production.findUniqueOrThrow({
      where: { slug: "nattland-svenska-teatern" },
      include: { stage: true, performances: true, credits: { include: { person: true } } },
    });
    expect(saved.stage?.name).toBe("AMOS-scenen");
    expect(saved.type).toBe("PLAY");
    expect(saved.performances).toHaveLength(7);
    const director = saved.credits.find((credit) => credit.role === "DIRECTOR");
    expect(director?.person.name).toBe("Anna-Maria Lipponen");
    // The source's own label is kept for display; the enum is for filtering.
    expect(director?.roleText).toBe(detail.credits.find((credit) => credit.roles.includes("DIRECTOR"))?.roleText);
  });

  it("stores the critic, paywall and feature flags of a review link", async () => {
    const { productionId } = await upsertProduction(
      db,
      theatre,
      {
        ...detail,
        criticReviews: [
          { outlet: "Hufvudstadsbladet", critic: "Jan-Erik Andelin", url: "https://www.hbl.fi/a/1", paywalled: true },
          { outlet: "Yle", url: "https://svenska.yle.fi/a/2", feature: true },
        ],
      },
      new Date(),
    );
    const reviews = await db.criticReview.findMany({ where: { productionId }, orderBy: { outlet: "asc" } });
    expect(reviews.map(({ outlet, critic, paywalled, feature }) => ({ outlet, critic, paywalled, feature }))).toEqual([
      { outlet: "Hufvudstadsbladet", critic: "Jan-Erik Andelin", paywalled: true, feature: false },
      { outlet: "Yle", critic: null, paywalled: false, feature: true },
    ]);
  });

  it("is idempotent: a second run updates instead of duplicating", async () => {
    const summary = await upsertProduction(db, theatre, detail, new Date());
    expect(summary.created).toBe(false);
    // Same page, same facts: only lastSeenAt moved, which is not a change.
    expect(summary.changed).toBe(false);
    expect(await db.production.count()).toBe(1);
    expect(await db.performance.count()).toBe(7);
  });

  it("keeps a stated premiere when a later scrape no longer prints it", async () => {
    const premiere = new Date("2026-09-12T00:00:00Z");
    await upsertProduction(db, theatre, { ...detail, premiereDate: premiere }, new Date());
    await upsertProduction(db, theatre, { ...detail, premiereDate: undefined }, new Date());
    const saved = await db.production.findUniqueOrThrow({ where: { slug: "nattland-svenska-teatern" } });
    expect(saved.premiereDate).toEqual(premiere);
  });

  it("keeps dropped performances and credits but leaves their lastSeenAt behind", async () => {
    const later = new Date(Date.now() + 60_000);
    const trimmed = { ...detail, performances: detail.performances.slice(1), credits: detail.credits.slice(1) };
    expect((await upsertProduction(db, theatre, trimmed, later)).changed).toBe(true);

    const saved = await db.production.findUniqueOrThrow({
      where: { slug: "nattland-svenska-teatern" },
      include: { performances: true, credits: true },
    });
    expect(saved.performances).toHaveLength(7);
    expect(saved.performances.filter((row) => row.lastSeenAt < saved.lastSeenAt)).toHaveLength(1);
    const staleCredits = saved.credits.filter((row) => row.lastSeenAt < saved.lastSeenAt);
    expect(staleCredits.length).toBe(detail.credits[0].roles.length);
  });

  it("keeps performances beyond a partial list's horizon current", async () => {
    const sorted = [...detail.performances].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    await upsertProduction(db, theatre, detail, new Date(Date.now() + 120_000));
    // A later run lists only the second performance: the first one is gone.
    const later = new Date(Date.now() + 180_000);
    await upsertProduction(db, theatre, { ...detail, performances: [sorted[1]], performancesPartial: true }, later);

    const rows = await db.performance.findMany({ where: { production: { slug: "nattland-svenska-teatern" } }, orderBy: { startsAt: "asc" } });
    const current = rows.filter((row) => row.lastSeenAt.getTime() === later.getTime()).map((row) => row.startsAt.getTime());
    expect(current).not.toContain(sorted[0].startsAt.getTime()); // inside the window and missing: cancelled
    expect(current).toContain(sorted[1].startsAt.getTime());
    expect(current).toContain(sorted.at(-1)?.startsAt.getTime()); // beyond the window: not announced yet
  });

  it("delists a production the theatre stopped listing, and relists it when it returns", async () => {
    const { syncListing } = await import("@/scrapers/run");
    const at = new Date();
    expect(await syncListing(db, theatre.id, ["some-other-show"], at)).toEqual({ delisted: 1, relisted: 0 });
    expect((await db.production.findUniqueOrThrow({ where: { slug: "nattland-svenska-teatern" } })).delistedAt).toEqual(at);
    // Already delisted: not counted again.
    expect(await syncListing(db, theatre.id, [], new Date())).toEqual({ delisted: 0, relisted: 0 });
    expect(await syncListing(db, theatre.id, ["34985"], new Date())).toEqual({ delisted: 0, relisted: 1 });
    expect((await db.production.findUniqueOrThrow({ where: { slug: "nattland-svenska-teatern" } })).delistedAt).toBeNull();
  });
  it("splits credit cells into people and never stores a group as a person", async () => {
    const { productionId } = await upsertProduction(
      db,
      theatre,
      {
        ...detail,
        externalId: "split-people",
        title: "Split people",
        url: "https://svenskateatern.fi/repertoar/split-people/",
        credits: [
          { name: "Max Martin ja ystävät", roleText: "Sävellys", roles: ["COMPOSER"] },
          { name: "Carl Knif & Kristofer Möller", roleText: "Regi", roles: ["DIRECTOR"] },
          { name: "Koncept och manus", roleText: "Text", roles: ["WRITER"] },
        ],
      },
      new Date(),
    );
    const credits = await db.credit.findMany({ where: { productionId }, include: { person: true } });
    const names = credits.map((credit) => credit.person.name).sort();
    expect(names).toEqual(expect.arrayContaining(["Carl Knif", "Kristofer Möller", "Max Martin"]));
    expect(await db.person.count({ where: { name: { in: ["Max Martin ja ystävät", "Koncept och manus"] } } })).toBe(0);
  });
  it("sentence-cases a shouting title and keeps an admin's correction through later scrapes", async () => {
    const { setTitleOverride } = await import("@/lib/ops/catalogue-admin");
    const shouting = { ...detail, externalId: "aja-baja", title: "AJA, BAJA ALFONS ÅBERG!", url: "https://svenskateatern.fi/repertoar/aja-baja/" };
    const { productionId } = await upsertProduction(db, theatre, shouting, new Date());
    expect(await db.production.findUniqueOrThrow({ where: { id: productionId } })).toMatchObject({
      title: "Aja, baja alfons åberg!",
      titleCased: true,
    });
    await setTitleOverride(productionId, "Aja, baja Alfons Åberg!");
    await upsertProduction(db, theatre, shouting, new Date());
    expect((await db.production.findUniqueOrThrow({ where: { id: productionId } })).title).toBe("Aja, baja Alfons Åberg!");
  });
});
