import { cacheLife, cacheTag } from "next/cache";
import type { CreditRole, ProductionType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { hasFullSchedule } from "@/scrapers/theatres";
import { cardSelect, toCard } from "./cards";
import {
  effectiveType,
  isClosingSoon,
  currentProductionCount,
  isCurrent,
  LISTED_THEATRE,
  knownEnd,
  lifecycle,
  runProgress,
  schedule,
  summariseRatings,
  upcomingPerformances,
  type Phase,
  type RatingSummary,
} from "./select";
import { reviewKind } from "./review-kind";
import type { SearchIndex } from "./search";
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

const byTitle = (a: ProductionCard, b: ProductionCard) => a.title.localeCompare(b.title, "fi");

const byYearDesc = (a: ProductionCard, b: ProductionCard) =>
  (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title, "fi");

/** Productions playing within the window, soonest first. */
export async function getOnStage(): Promise<{ asOf: Date; cards: ProductionCard[] }> {
  "use cache";
  cacheCatalogue();
  const asOf = new Date();
  const rows = await db.production.findMany({
    where: { delistedAt: null, performances: { some: { startsAt: { gte: asOf } } } },
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
  /** When the run ends as far as we know (see `knownEnd`); null when we can't tell. */
  end: Date | null;
  /** False when the source lists only the next few dates, so "N left" would be wrong. */
  fullSchedule: boolean;
  closingSoon: boolean;
  phase: Phase;
  /** Performed at least once, so it can be logged as seen. */
  started: boolean;
  year: number | null;
  credits: CreditRow[];
  /** Press reviews; blog posts the theatre lists go to `blogs` (see review-kind.ts). */
  critics: ReviewLink[];
  blogs: ReviewLink[];
  /** Features and interviews the theatre links to: coverage, not reviews. */
  features: ReviewLink[];
  ratings: RatingSummary;
  tags: Array<{ slug: string; labels: { fi: string; sv: string; en: string }; count: number }>;
  reviews: PublicReview[];
  updatedAt: Date;
}

export interface ReviewLink {
  outlet: string;
  critic: string | null;
  url: string;
  publishedAt: Date | null;
  paywalled: boolean;
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

  // A production the theatre no longer lists has no performances to sell, whatever is stored.
  const upcoming = row.delistedAt ? [] : upcomingPerformances(row.performances, row, asOf);
  const timing = schedule(upcoming, asOf);
  const fullSchedule = hasFullSchedule(row.theatre.slug);
  const end = knownEnd(timing.last, row.runEnd, fullSchedule);
  const life = lifecycle({ ...row, next: timing.next }, asOf);
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
    progress: runProgress(row.premiereDate, row.performances[0]?.startsAt ?? null, end, asOf),
    end,
    fullSchedule,
    closingSoon: isClosingSoon(timing, row.runEnd, fullSchedule, asOf),
    phase: life.phase,
    started: life.started,
    year: life.year,
    credits: row.credits
      .filter((credit) => isCurrent(credit, row))
      .map((credit) => ({
        role: credit.role,
        roleText: credit.roleText,
        person: credit.person,
        characterName: credit.characterName,
      })),
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

function splitReviews(rows: Array<ReviewLink & { feature: boolean }>): Pick<ProductionPage, "critics" | "blogs" | "features"> {
  const toLink = ({ outlet, critic, url, publishedAt, paywalled }: ReviewLink): ReviewLink => ({ outlet, critic, url, publishedAt, paywalled });
  const reviews = rows.filter((row) => !row.feature).map(toLink);
  return {
    critics: reviews.filter((link) => reviewKind(link.outlet, link.url) === "press"),
    blogs: reviews.filter((link) => reviewKind(link.outlet, link.url) === "blog"),
    features: rows.filter((row) => row.feature).map(toLink),
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
  /** Still listed by the theatre, no dates yet. */
  upcoming: ProductionCard[];
  past: ProductionCard[];
  /** Ended over a year ago, or never dated: kept for the diary, out of the main lists. */
  archive: ProductionCard[];
}

const inPhase = (phase: Phase) => (card: ProductionCard) => card.phase === phase;

export async function getTheatre(slug: string): Promise<TheatrePage | null> {
  "use cache";
  cacheCatalogue();
  const asOf = new Date();
  const row = await db.theatre.findFirst({
    where: { slug, ...LISTED_THEATRE },
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
    current: cards.filter(inPhase("running")).sort(byNext),
    upcoming: cards.filter(inPhase("upcoming")).sort(byTitle),
    past: cards.filter(inPhase("past")).sort(byYearDesc),
    archive: cards.filter(inPhase("archive")).sort(byYearDesc),
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
  upcoming: PersonCredit[];
  /** Past and archived: on a person's page their history is the point. */
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
    current: all.filter((entry) => entry.card.phase === "running").sort((a, b) => byNext(a.card, b.card)),
    upcoming: all.filter((entry) => entry.card.phase === "upcoming").sort((a, b) => byTitle(a.card, b.card)),
    past: all
      .filter((entry) => entry.card.phase === "past" || entry.card.phase === "archive")
      .sort((a, b) => byYearDesc(a.card, b.card)),
  };
}

/** Everything search looks through. People count only with current credits, so no result leads to a 404. */
export async function getSearchIndex(): Promise<{ asOf: Date; index: SearchIndex }> {
  "use cache";
  cacheCatalogue();
  const asOf = new Date();
  const [productions, people, theatres] = await Promise.all([
    db.production.findMany({ select: cardSelect }),
    db.person.findMany({
      where: { credits: { some: {} } },
      select: {
        slug: true,
        name: true,
        credits: { select: { productionId: true, lastSeenAt: true, production: { select: { lastSeenAt: true } } } },
      },
    }),
    db.theatre.findMany({ where: LISTED_THEATRE, select: { slug: true, name: true, city: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    asOf,
    index: {
      productions: productions.map((row) => toCard(row, asOf)),
      people: people.flatMap((person) => {
        const productions = currentProductionCount(person.credits);
        return productions > 0 ? [{ slug: person.slug, name: person.name, productions }] : [];
      }),
      theatres,
    },
  };
}

/** Every public slug, for generateStaticParams and the sitemap. */
export async function getAllSlugs(): Promise<{
  productions: Array<{ slug: string; updatedAt: Date }>;
  theatres: Array<{ slug: string; updatedAt: Date }>;
  /** `productions` decides whether the page is indexed (MIN_PRODUCTIONS_TO_INDEX). */
  people: Array<{ slug: string; productions: number }>;
}> {
  "use cache";
  cacheCatalogue();
  const [productions, theatres, people] = await Promise.all([
    db.production.findMany({ select: { slug: true, lastSeenAt: true }, orderBy: { slug: "asc" } }),
    db.theatre.findMany({ where: LISTED_THEATRE, select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } }),
    db.person.findMany({
      where: { credits: { some: {} } },
      select: {
        slug: true,
        credits: { select: { productionId: true, lastSeenAt: true, production: { select: { lastSeenAt: true } } } },
      },
      orderBy: { slug: "asc" },
    }),
  ]);
  return {
    productions: productions.map((row) => ({ slug: row.slug, updatedAt: row.lastSeenAt })),
    theatres: theatres.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt })),
    people: people.map((person) => ({ slug: person.slug, productions: currentProductionCount(person.credits) })),
  };
}

/** The theatres Aitio shows, for the about page's source list. */
export async function getListedTheatres(): Promise<Array<{ slug: string; name: string; website: string }>> {
  "use cache";
  cacheCatalogue();
  return db.theatre.findMany({ where: LISTED_THEATRE, select: { slug: true, name: true, website: true }, orderBy: { name: "asc" } });
}
