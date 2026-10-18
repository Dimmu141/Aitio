import "dotenv/config";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseDetail } from "@/scrapers/adapters/svenska-teatern";
import { upsertProduction } from "@/scrapers/normalise";

/**
 * Runs only when TEST_DATABASE_URL points at a disposable, migrated database.
 * Example: TEST_DATABASE_URL=postgresql://postgres@localhost:5432/valiaika_test pnpm test
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("upsertProduction (integration)", () => {
  let db: Awaited<typeof import("@/lib/db")>["db"];
  let theatre: { id: string; slug: string };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = (await import("@/lib/db")).db;
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
    expect(summary).toMatchObject({ created: true, slug: "nattland-svenska-teatern", performances: 7 });

    const saved = await db.production.findUniqueOrThrow({
      where: { slug: "nattland-svenska-teatern" },
      include: { stage: true, performances: true, credits: { include: { person: true } } },
    });
    expect(saved.stage?.name).toBe("AMOS-scenen");
    expect(saved.type).toBe("PLAY");
    expect(saved.performances).toHaveLength(7);
    expect(saved.credits.find((credit) => credit.role === "DIRECTOR")?.person.name).toBe("Anna-Maria Lipponen");
  });

  it("is idempotent: a second run updates instead of duplicating", async () => {
    const summary = await upsertProduction(db, theatre, detail, new Date());
    expect(summary.created).toBe(false);
    expect(await db.production.count()).toBe(1);
    expect(await db.performance.count()).toBe(7);
  });
});
