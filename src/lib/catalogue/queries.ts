import { cacheLife, cacheTag } from "next/cache";
import type { CreditRole, ProductionType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { cardSelect, toCard } from "./cards";
import {
  effectiveType,
  isCurrent,
  lastYear,
  runProgress,
  schedule,
  summariseRatings,
  upcomingPerformances,
  type RatingSummary,
} from "./select";
import { reviewKind } from "./review-kind";
import { productionTag } from "./tags";
import type { CreditRow, PerformanceRow, ProductionCard, TheatreRef } from "./types";

/**
 * Everything here is cached for an hour and tagged "catalogue", so the scraper can
 * invalidate it after a run. Time-dependent answers ("next 14 days") use `asOf`, the
 * moment the cache entry was built, which is also returned so pages stay consistent.
 */
export const CATALOGUE_TAG = "catalogue";

function cacheCatalogue(): void {
  cacheLife("hours");
  cacheTag(CATALOGUE_TAG);
}

const byNext = (a: ProductionCard, b: ProductionCard) =>
  (a.next?.getTime() ?? Infinity) - (b.next?.getTime() ?? Infinity) || a.title.localeCompare(b.title, "fi");

const byYearDesc = (a: ProductionCard, b: ProductionCard) =>
  (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title, "fi");

/** Productions playing within the window, soonest first. */
export async function getOnStage(): Promise<{ asOf: Date; cards: ProductionCard[] }> {
  "use cache";
  cacheCatalogue();
  const asOf = new Date();
  const rows = await db.production.findMany({
    where: { performances: { some: { startsAt: { gte: asOf } } } },
    select: cardSelect,
  });
  const cards = rows.map((row) => toCard(row, asOf)).filter((card) => card.onSoon);
  return { asOf, cards: cards.sort(byNext) };
}

export interface ProductionPage {
  asOf: Date;
  slug: string;
  title: string;
  type: ProductionType;
  theatre: TheatreRef & { website: string };
  stage: string | null;
  languages: string[];
  subtitleLangs: string[];
  durationText: string | null;
  sourceUrl: string;
  ticketUrl: string | null;
  premiereDate: Date | null;
  performances: PerformanceRow[];
  next: Date | null;
  last: Date | null;
  progress: number | null;
  year: number | null;
  credits: CreditRow[];
  /** Press reviews; blog posts the theatre lists go to `blogs` (see review-kind.ts). */
  critics: ReviewLink[];
  blogs: ReviewLink[];
  ratings: RatingSummary;
  tags: Array<{ slug: string; labels: { fi: string; sv: string; en: string }; count: number }>;
  reviews: PublicReview[];
  updatedAt: Date;
}

export interface ReviewLink {
  outlet: string;
  url: string;
  publishedAt: Date | null;
}

export interface PublicReview {
  id: string;
  /** Empty when the user hasn't set a name; the page shows a neutral label. */
  name: string;
  rating: number | null;
  seenOn: Date;
  text: string;
}

const MAX_REVIEWS = 20;

export async function getProduction(slug: string): Promise<ProductionPage | null> {
  "use cache";
  cacheCatalogue();
  cacheTag(productionTag(slug));
  const asOf = new Date();
  const row = await db.production.findUnique({
    where: { slug },
    include: {
      theatre: { select: { slug: true, name: true, city: true, website: true } },
      stage: { select: { name: true } },
      performances: { include: { stage: { select: { name: true } } }, orderBy: { startsAt: "asc" } },
      credits: { include: { person: { select: { slug: true, name: true } } }, orderBy: { sortOrder: "asc" } },
      criticReviews: { orderBy: [{ publishedAt: "desc" }, { outlet: "asc" }] },
      diaryEntries: {
        select: {
          id: true,
          rating: true,
          review: true,
          isPublic: true,
          hiddenAt: true,
          seenOn: true,
          createdAt: true,
          user: { select: { name: true } },
          tags: { select: { slug: true, labelFi: true, labelSv: true, labelEn: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!row) return null;

  const upcoming = upcomingPerformances(row.performances, row, asOf);
  const timing = schedule(upcoming, asOf);
  const ratings = row.diaryEntries.flatMap((entry) => (entry.rating === null ? [] : [entry.rating / 2]));

  return {
    asOf,
    slug: row.slug,
    title: row.title,
    type: effectiveType(row),
    theatre: row.theatre,
    stage: row.stage?.name ?? null,
    languages: row.languages,
    subtitleLangs: row.subtitleLangs,
    durationText: row.durationText,
    sourceUrl: row.sourceUrl,
    ticketUrl: upcoming.find((performance) => performance.ticketUrl)?.ticketUrl ?? row.ticketUrl,
    premiereDate: row.premiereDate,
    performances: upcoming.map((performance) => ({
      startsAt: performance.startsAt,
      stage: performance.stage?.name ?? null,
      ticketUrl: performance.ticketUrl,
      subtitleLangs: performance.subtitleLangs,
    })),
    next: timing.next,
    last: timing.last,
    progress: runProgress(row.premiereDate, row.performances[0]?.startsAt ?? null, timing.last ?? row.runEnd, asOf),
    year: timing.next ? null : lastYear([row.performances.at(-1)?.startsAt, row.runEnd, row.premiereDate]),
    credits: row.credits
      .filter((credit) => isCurrent(credit, row))
      .map((credit) => ({ role: credit.role, person: credit.person, characterName: credit.characterName })),
    ...splitReviews(row.criticReviews),
    ratings: summariseRatings(ratings),
    tags: countTags(row.diaryEntries.flatMap((entry) => entry.tags)),
    reviews: row.diaryEntries
      .filter((entry) => entry.isPublic && entry.hiddenAt === null && entry.review)
      .slice(0, MAX_REVIEWS)
      .map((entry) => ({
        id: entry.id,
        name: entry.user.name,
        rating: entry.rating,
        seenOn: entry.seenOn,
        text: entry.review ?? "",
      })),
    updatedAt: row.lastSeenAt,
  };
}

function splitReviews(rows: ReviewLink[]): { critics: ReviewLink[]; blogs: ReviewLink[] } {
  const links = rows.map(({ outlet, url, publishedAt }) => ({ outlet, url, publishedAt }));
  return {
    critics: links.filter((link) => reviewKind(link.outlet, link.url) === "press"),
    blogs: links.filter((link) => reviewKind(link.outlet, link.url) === "blog"),
  };
}

function countTags(tags: Array<{ slug: string; labelFi: string; labelSv: string; labelEn: string }>) {
  const counts = new Map<string, ProductionPage["tags"][number]>();
  for (const tag of tags) {
    const entry = counts.get(tag.slug) ?? {
      slug: tag.slug,
      labels: { fi: tag.labelFi, sv: tag.labelSv, en: tag.labelEn },
      count: 0,
    };
    entry.count += 1;
    counts.set(tag.slug, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export interface TheatrePage {
  asOf: Date;
  theatre: TheatreRef & { website: string };
  stages: string[];
  current: ProductionCard[];
  past: ProductionCard[];
}

export async function getTheatre(slug: string): Promise<TheatrePage | null> {
  "use cache";
  cacheCatalogue();
  const asOf = new Date();
  const row = await db.theatre.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      city: true,
      website: true,
      stages: { select: { name: true }, orderBy: { name: "asc" } },
      productions: { select: cardSelect },
    },
  });
  if (!row) return null;
  const cards = row.productions.map((production) => toCard(production, asOf));
  return {
    asOf,
    theatre: { slug: row.slug, name: row.name, city: row.city, website: row.website },
    stages: row.stages.map((stage) => stage.name),
    current: cards.filter((card) => card.next).sort(byNext),
    past: cards.filter((card) => !card.next).sort(byYearDesc),
  };
}

export interface PersonCredit {
  card: ProductionCard;
  roles: CreditRole[];
  characterNames: string[];
}

export interface PersonPage {
  asOf: Date;
  slug: string;
  name: string;
  current: PersonCredit[];
  past: PersonCredit[];
}

export async function getPerson(slug: string): Promise<PersonPage | null> {
  "use cache";
  cacheCatalogue();
  const asOf = new Date();
  const row = await db.person.findUnique({
    where: { slug },
    include: { credits: { include: { production: { select: cardSelect } } } },
  });
  if (!row) return null;

  const byProduction = new Map<string, PersonCredit>();
  for (const credit of row.credits) {
    if (!isCurrent(credit, credit.production)) continue;
    const entry = byProduction.get(credit.production.slug) ?? {
      card: toCard(credit.production, asOf),
      roles: [],
      characterNames: [],
    };
    entry.roles.push(credit.role);
    if (credit.characterName) entry.characterNames.push(credit.characterName);
    byProduction.set(credit.production.slug, entry);
  }
  const all = [...byProduction.values()];
  if (all.length === 0) return null;
  return {
    asOf,
    slug: row.slug,
    name: row.name,
    current: all.filter((entry) => entry.card.next).sort((a, b) => byNext(a.card, b.card)),
    past: all.filter((entry) => !entry.card.next).sort((a, b) => byYearDesc(a.card, b.card)),
  };
}

/** Every public slug, for generateStaticParams and the sitemap. */
export async function getAllSlugs(): Promise<{
  productions: Array<{ slug: string; updatedAt: Date }>;
  theatres: Array<{ slug: string; updatedAt: Date }>;
  people: Array<{ slug: string }>;
}> {
  "use cache";
  cacheCatalogue();
  const [productions, theatres, people] = await Promise.all([
    db.production.findMany({ select: { slug: true, lastSeenAt: true }, orderBy: { slug: "asc" } }),
    db.theatre.findMany({ select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } }),
    db.person.findMany({ where: { credits: { some: {} } }, select: { slug: true }, orderBy: { slug: "asc" } }),
  ]);
  return {
    productions: productions.map((row) => ({ slug: row.slug, updatedAt: row.lastSeenAt })),
    theatres: theatres.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt })),
    people,
  };
}
