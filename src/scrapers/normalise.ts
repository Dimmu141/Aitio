import type { PrismaClient } from "@/generated/prisma/client";
import { classifyProduction } from "./classify";
import { slugify } from "./text";
import type { RawProductionDetail } from "./types";

export interface UpsertSummary {
  productionId: string;
  slug: string;
  created: boolean;
  performances: number;
  credits: number;
  reviews: number;
}

/** Build the plan for one production without touching the database (used by --dry-run). */
export function planProduction(detail: RawProductionDetail) {
  const classification = classifyProduction({
    title: detail.title,
    stage: detail.stage,
    subtitle: detail.subtitle,
    hasDirector: detail.credits.some((credit) => credit.roles.includes("DIRECTOR")),
    castCount: detail.credits.filter((credit) => credit.roles.includes("CAST")).length,
  });
  return { detail, classification };
}

async function uniqueProductionSlug(
  db: PrismaClient,
  base: string,
  theatreId: string,
  externalId: string,
): Promise<string> {
  const existing = await db.production.findUnique({ where: { slug: base } });
  if (!existing || (existing.theatreId === theatreId && existing.externalId === externalId)) {
    return base;
  }
  return `${base}-${slugify(externalId)}`.slice(0, 120);
}

async function upsertStage(db: PrismaClient, theatreId: string, name: string | undefined) {
  if (!name) return null;
  return db.stage.upsert({
    where: { theatreId_name: { theatreId, name } },
    create: { theatreId, name },
    update: {},
  });
}

async function upsertPerson(db: PrismaClient, name: string) {
  const slug = slugify(name);
  return db.person.upsert({ where: { slug }, create: { slug, name }, update: {} });
}

/**
 * Upsert one scraped production with its performances, credits and critic links.
 * Never deletes: performances and credits that disappeared simply keep their old
 * lastSeenAt, so readers can tell current rows from stale ones (see src/lib/current.ts).
 */
export async function upsertProduction(
  db: PrismaClient,
  theatre: { id: string; slug: string },
  detail: RawProductionDetail,
  seenAt: Date,
): Promise<UpsertSummary> {
  const { classification } = planProduction(detail);
  const stage = await upsertStage(db, theatre.id, detail.stage);
  const key = { theatreId_externalId: { theatreId: theatre.id, externalId: detail.externalId } };
  const existing = await db.production.findUnique({ where: key });
  const slug =
    existing?.slug ??
    (await uniqueProductionSlug(db, `${slugify(detail.title)}-${theatre.slug}`, theatre.id, detail.externalId));

  const data = {
    title: detail.title,
    sourceUrl: detail.url,
    stageId: stage?.id ?? null,
    type: classification.type,
    typeConfidence: classification.confidence,
    languages: detail.languages,
    subtitleLangs: detail.subtitleLangs,
    premiereDate: detail.premiereDate ?? null,
    runStart: detail.runStart ?? null,
    runEnd: detail.runEnd ?? null,
    durationText: detail.durationText ?? null,
    ticketUrl: detail.performances.find((performance) => performance.ticketUrl)?.ticketUrl ?? null,
    lastSeenAt: seenAt,
  };

  const production = await db.production.upsert({
    where: key,
    create: { ...data, slug, theatreId: theatre.id, externalId: detail.externalId },
    update: data,
  });

  for (const performance of detail.performances) {
    const performanceStage = await upsertStage(db, theatre.id, performance.stage);
    await db.performance.upsert({
      where: { productionId_startsAt: { productionId: production.id, startsAt: performance.startsAt } },
      create: {
        productionId: production.id,
        startsAt: performance.startsAt,
        stageId: performanceStage?.id ?? null,
        ticketUrl: performance.ticketUrl ?? null,
        subtitleLangs: performance.subtitleLangs ?? [],
        lastSeenAt: seenAt,
      },
      update: {
        stageId: performanceStage?.id ?? null,
        ticketUrl: performance.ticketUrl ?? null,
        subtitleLangs: performance.subtitleLangs ?? [],
        lastSeenAt: seenAt,
      },
    });
  }

  let creditCount = 0;
  for (const [index, credit] of detail.credits.entries()) {
    const person = await upsertPerson(db, credit.name);
    for (const role of credit.roles) {
      await db.credit.upsert({
        where: { personId_productionId_role: { personId: person.id, productionId: production.id, role } },
        create: {
          personId: person.id,
          productionId: production.id,
          role,
          characterName: credit.characterName ?? null,
          sortOrder: index,
          lastSeenAt: seenAt,
        },
        update: { characterName: credit.characterName ?? null, sortOrder: index, lastSeenAt: seenAt },
      });
      creditCount += 1;
    }
  }

  for (const review of detail.criticReviews) {
    await db.criticReview.upsert({
      where: { url: review.url },
      create: { productionId: production.id, outlet: review.outlet, url: review.url, publishedAt: review.publishedAt ?? null },
      update: { outlet: review.outlet, ...(review.publishedAt ? { publishedAt: review.publishedAt } : {}) },
    });
  }

  return {
    productionId: production.id,
    slug: production.slug,
    created: !existing,
    performances: detail.performances.length,
    credits: creditCount,
    reviews: detail.criticReviews.length,
  };
}
