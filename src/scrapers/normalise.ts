import type { PrismaClient } from "@/generated/prisma/client";
import { classifyProduction, isConductorLabel, isInstrumentLabel } from "./classify";
import { sentenceCaseShouting, slugify, splitPeople } from "./text";
import type { RawCredit, RawProductionDetail } from "./types";

export interface UpsertSummary {
  productionId: string;
  slug: string;
  created: boolean;
  /** Created, or any stored fact differs from before this run (see factsFingerprint). */
  changed: boolean;
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
    typeHint: detail.typeHint,
    hasDirector: detail.credits.some((credit) => credit.roles.includes("DIRECTOR")),
    hasChoreographer: detail.credits.some((credit) => credit.roles.includes("CHOREOGRAPHER")),
    hasWriter: detail.credits.some((credit) => credit.roles.includes("WRITER") || credit.roles.includes("ADAPTATION")),
    hasComposer: detail.credits.some((credit) => credit.roles.includes("COMPOSER")),
    hasConductor: detail.credits.some((credit) => isConductorLabel(credit.roleText)),
    musicianCount: detail.credits.filter((credit) => isInstrumentLabel(credit.roleText)).length,
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
 * For sources that list only the next few performances: anything stored after the last
 * one listed is not announced on the site yet, so it stays current instead of looking
 * cancelled. A missing performance inside the listed window still goes stale.
 */
async function keepUnannounced(
  db: PrismaClient,
  productionId: string,
  listed: RawProductionDetail["performances"],
  seenAt: Date,
): Promise<void> {
  const horizon = listed.reduce((latest, performance) => (performance.startsAt > latest ? performance.startsAt : latest), seenAt);
  await db.performance.updateMany({
    where: { productionId, startsAt: { gt: horizon } },
    data: { lastSeenAt: seenAt },
  });
}

/** One person's credits on a production, a row per role; returns how many rows. */
async function upsertCredit(
  db: PrismaClient,
  productionId: string,
  name: string,
  credit: RawCredit,
  sortOrder: number,
  seenAt: Date,
): Promise<number> {
  const person = await upsertPerson(db, name);
  const roleText = credit.roleText.trim() || null;
  const characterName = credit.characterName ?? null;
  for (const role of credit.roles) {
    await db.credit.upsert({
      where: { personId_productionId_role: { personId: person.id, productionId, role } },
      create: { personId: person.id, productionId, role, roleText, characterName, sortOrder, lastSeenAt: seenAt },
      update: { roleText, characterName, sortOrder, lastSeenAt: seenAt },
    });
  }
  return credit.roles.length;
}

/**
 * The production's facts as a stable string: its own fields and its current performances,
 * credits and critic links, without the lastSeenAt bookkeeping every run rewrites. Equal
 * before and after a save means the theatre's page said nothing new.
 */
async function factsFingerprint(db: PrismaClient, productionId: string): Promise<string> {
  const production = await db.production.findUniqueOrThrow({
    where: { id: productionId },
    include: {
      performances: { orderBy: { startsAt: "asc" } },
      credits: { orderBy: [{ personId: "asc" }, { role: "asc" }] },
      criticReviews: { orderBy: { url: "asc" } },
    },
  });
  const current = (row: { lastSeenAt: Date }) => row.lastSeenAt.getTime() >= production.lastSeenAt.getTime();
  return JSON.stringify([
    production.title,
    // Not shown, but they move the production on or off the admin's review lists.
    production.titleCased,
    production.typeConfidence,
    production.sourceUrl,
    production.stageId,
    production.type,
    production.languages,
    production.subtitleLangs,
    production.premiereDate,
    production.sourceUpdatedAt,
    production.runStart,
    production.runEnd,
    production.durationText,
    production.ticketUrl,
    production.performances
      .filter(current)
      .map((row) => [row.startsAt, row.stageId, row.ticketUrl, row.subtitleLangs]),
    production.credits
      .filter(current)
      .map((row) => [row.personId, row.role, row.roleText, row.characterName, row.sortOrder]),
    production.criticReviews.map((row) => [row.url, row.outlet, row.critic, row.publishedAt, row.paywalled, row.feature]),
  ]);
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
  const before = existing ? await factsFingerprint(db, existing.id) : null;
  const slug =
    existing?.slug ??
    (await uniqueProductionSlug(db, `${slugify(detail.title)}-${theatre.slug}`, theatre.id, detail.externalId));

  // An admin's correction wins; otherwise a shouting source title gets sentence case.
  const cased = sentenceCaseShouting(detail.title);
  const data = {
    title: existing?.titleOverride ?? cased,
    titleCased: cased !== detail.title,
    sourceUrl: detail.url,
    stageId: stage?.id ?? null,
    type: classification.type,
    typeConfidence: classification.confidence,
    languages: detail.languages,
    // "Wordless" in a subtitle field means no subtitles are needed, not a subtitle language.
    subtitleLangs: detail.subtitleLangs.filter((code) => code !== "zxx"),
    // A premiere is history: once stated it stays, even when the page later stops printing it.
    premiereDate: detail.premiereDate ?? existing?.premiereDate ?? null,
    sourceUpdatedAt: detail.sourceUpdatedAt ?? null,
    runStart: detail.runStart ?? null,
    runEnd: detail.runEnd ?? null,
    durationText: detail.durationText ?? null,
    ticketUrl: detail.performances.find((performance) => performance.ticketUrl)?.ticketUrl ?? detail.ticketUrl ?? null,
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
        subtitleLangs: (performance.subtitleLangs ?? []).filter((code) => code !== "zxx"),
        lastSeenAt: seenAt,
      },
      update: {
        stageId: performanceStage?.id ?? null,
        ticketUrl: performance.ticketUrl ?? null,
        subtitleLangs: (performance.subtitleLangs ?? []).filter((code) => code !== "zxx"),
        lastSeenAt: seenAt,
      },
    });
  }
  if (detail.performancesPartial) await keepUnannounced(db, production.id, detail.performances, seenAt);

  let creditCount = 0;
  for (const [index, credit] of detail.credits.entries()) {
    // Every source passes through here: split "A ja B", drop "… ja ystävät", skip labels.
    for (const name of splitPeople(credit.name)) {
      creditCount += await upsertCredit(db, production.id, name, credit, index, seenAt);
    }
  }

  for (const review of detail.criticReviews) {
    await db.criticReview.upsert({
      where: { url: review.url },
      create: {
        productionId: production.id,
        outlet: review.outlet,
        critic: review.critic ?? null,
        url: review.url,
        publishedAt: review.publishedAt ?? null,
        paywalled: review.paywalled ?? false,
        feature: review.feature ?? false,
      },
      update: {
        outlet: review.outlet,
        paywalled: review.paywalled ?? false,
        feature: review.feature ?? false,
        ...(review.critic ? { critic: review.critic } : {}),
        ...(review.publishedAt ? { publishedAt: review.publishedAt } : {}),
      },
    });
  }

  return {
    productionId: production.id,
    slug: production.slug,
    created: !existing,
    changed: before !== (await factsFingerprint(db, production.id)),
    performances: detail.performances.length,
    credits: creditCount,
    reviews: detail.criticReviews.length,
  };
}
