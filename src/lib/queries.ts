import { cacheLife, cacheTag } from "next/cache";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CreditRole, ProductionType } from "@/generated/prisma/enums";
import { runStatus, type RunStatus } from "@/lib/run-status";

/**
 * Read-side queries for the public pages. Each is cached for hours: the
 * scrapers run once a day, so hitting the database per visit buys nothing.
 * The "productions" tag lets the scraper purge everything after a run.
 */

export type Loaded<T> = { ok: true; data: T; asOf: Date } | { ok: false };

const PROGRAMME_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

async function load<T>(query: (db: PrismaClient, now: Date) => Promise<T>): Promise<Loaded<T>> {
  // Without a database (a fresh Vercel project, a preview build) pages show a
  // friendly message instead of failing the build.
  if (!process.env.DATABASE_URL) return { ok: false };
  try {
    const { db } = await import("@/lib/db");
    const now = new Date();
    return { ok: true, data: await query(db, now), asOf: now };
  } catch (error) {
    console.error("[aitio] database query failed", error);
    return { ok: false };
  }
}

export type TheatreRef = { slug: string; name: string; city: string };

export type ProgrammeItem = {
  slug: string;
  title: string;
  type: ProductionType;
  theatre: TheatreRef;
  stage: string | null;
  languages: string[];
  subtitleLangs: string[];
  nextPerformance: Date;
  status: RunStatus;
};

const theatreRef = { select: { slug: true, name: true, city: true } } as const;

type ProgrammeRow = {
  slug: string;
  title: string;
  type: ProductionType;
  typeOverride: ProductionType | null;
  languages: string[];
  subtitleLangs: string[];
  premiereDate: Date | null;
  runStart: Date | null;
  runEnd: Date | null;
  theatre: TheatreRef;
  stage: { name: string } | null;
  performances: { startsAt: Date }[];
};

function toProgrammeItem(row: ProgrammeRow, now: Date): ProgrammeItem | null {
  const dates = row.performances.map((performance) => performance.startsAt);
  const nextPerformance = dates[0];
  if (!nextPerformance) return null;
  return {
    slug: row.slug,
    title: row.title,
    type: row.typeOverride ?? row.type,
    theatre: row.theatre,
    stage: row.stage?.name ?? null,
    languages: row.languages,
    subtitleLangs: row.subtitleLangs,
    nextPerformance,
    status: runStatus({ premiereDate: row.premiereDate, runStart: row.runStart, runEnd: row.runEnd, performances: dates }, now),
  };
}

const programmeSelect = (now: Date) =>
  ({
    slug: true,
    title: true,
    type: true,
    typeOverride: true,
    languages: true,
    subtitleLangs: true,
    premiereDate: true,
    runStart: true,
    runEnd: true,
    theatre: theatreRef,
    stage: { select: { name: true } },
    performances: { where: { startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, select: { startsAt: true } },
  }) as const;

function sortByNext(items: (ProgrammeItem | null)[]): ProgrammeItem[] {
  return items
    .filter((item): item is ProgrammeItem => item !== null)
    .sort((a, b) => a.nextPerformance.getTime() - b.nextPerformance.getTime());
}

/** Productions with at least one performance in the next 14 days. */
export async function getProgramme(): Promise<Loaded<ProgrammeItem[]>> {
  "use cache";
  cacheTag("productions");
  const result = await load(async (db, now) => {
    const horizon = new Date(now.getTime() + PROGRAMME_DAYS * DAY_MS);
    const rows = await db.production.findMany({
      where: { performances: { some: { startsAt: { gte: now, lte: horizon } } } },
      select: programmeSelect(now),
    });
    return sortByNext(rows.map((row) => toProgrammeItem(row, now)));
  });
  if (result.ok) cacheLife("hours");
  else cacheLife("seconds");
  return result;
}

export type ProductionDetail = {
  slug: string;
  title: string;
  type: ProductionType;
  theatre: TheatreRef & { website: string };
  stage: string | null;
  languages: string[];
  subtitleLangs: string[];
  durationText: string | null;
  sourceUrl: string;
  lastSeenAt: Date;
  status: RunStatus;
  performances: { startsAt: Date; stage: string | null; ticketUrl: string | null }[];
  credits: { role: CreditRole; characterName: string | null; person: { slug: string; name: string } }[];
  criticReviews: { outlet: string; url: string; publishedAt: Date | null }[];
};

export async function getProduction(slug: string): Promise<Loaded<ProductionDetail | null>> {
  "use cache";
  cacheTag("productions", `production:${slug}`);
  const result = await load(async (db, now) => {
    const row = await db.production.findUnique({
      where: { slug },
      include: {
        theatre: { select: { slug: true, name: true, city: true, website: true } },
        stage: { select: { name: true } },
        performances: {
          where: { startsAt: { gte: now } },
          orderBy: { startsAt: "asc" },
          select: { startsAt: true, ticketUrl: true, stage: { select: { name: true } } },
        },
        credits: { orderBy: { sortOrder: "asc" }, include: { person: { select: { slug: true, name: true } } } },
        criticReviews: { orderBy: { publishedAt: "asc" }, select: { outlet: true, url: true, publishedAt: true } },
      },
    });
    if (!row) return null;
    const dates = row.performances.map((performance) => performance.startsAt);
    return {
      slug: row.slug,
      title: row.title,
      type: row.typeOverride ?? row.type,
      theatre: row.theatre,
      stage: row.stage?.name ?? null,
      languages: row.languages,
      subtitleLangs: row.subtitleLangs,
      durationText: row.durationText,
      sourceUrl: row.sourceUrl,
      lastSeenAt: row.lastSeenAt,
      status: runStatus({ premiereDate: row.premiereDate, runStart: row.runStart, runEnd: row.runEnd, performances: dates }, now),
      performances: row.performances.map((performance) => ({
        startsAt: performance.startsAt,
        ticketUrl: performance.ticketUrl,
        stage: performance.stage?.name ?? null,
      })),
      credits: row.credits.map((credit) => ({ role: credit.role, characterName: credit.characterName, person: credit.person })),
      criticReviews: row.criticReviews,
    };
  });
  if (result.ok) cacheLife("hours");
  else cacheLife("seconds");
  return result;
}

export type TheatreSummary = TheatreRef & { productionCount: number };

export async function getTheatres(): Promise<Loaded<TheatreSummary[]>> {
  "use cache";
  cacheTag("productions");
  const result = await load(async (db, now) => {
    const rows = await db.theatre.findMany({
      orderBy: { name: "asc" },
      select: {
        slug: true,
        name: true,
        city: true,
        productions: { where: { performances: { some: { startsAt: { gte: now } } } }, select: { id: true } },
      },
    });
    return rows.map(({ productions, ...theatre }) => ({ ...theatre, productionCount: productions.length }));
  });
  if (result.ok) cacheLife("hours");
  else cacheLife("seconds");
  return result;
}

export type TheatreDetail = TheatreRef & { website: string; stages: string[]; productions: ProgrammeItem[] };

export async function getTheatre(slug: string): Promise<Loaded<TheatreDetail | null>> {
  "use cache";
  cacheTag("productions", `theatre:${slug}`);
  const result = await load(async (db, now) => {
    const row = await db.theatre.findUnique({
      where: { slug },
      select: {
        slug: true,
        name: true,
        city: true,
        website: true,
        stages: { orderBy: { name: "asc" }, select: { name: true } },
        productions: {
          where: { performances: { some: { startsAt: { gte: now } } } },
          select: programmeSelect(now),
        },
      },
    });
    if (!row) return null;
    return {
      slug: row.slug,
      name: row.name,
      city: row.city,
      website: row.website,
      stages: row.stages.map((stage) => stage.name),
      productions: sortByNext(row.productions.map((production) => toProgrammeItem(production, now))),
    };
  });
  if (result.ok) cacheLife("hours");
  else cacheLife("seconds");
  return result;
}

export type PersonCredit = {
  production: { slug: string; title: string; year: Date | null; theatre: string; upcoming: boolean };
  roles: { role: CreditRole; characterName: string | null }[];
};

export type PersonDetail = { slug: string; name: string; credits: PersonCredit[] };

export async function getPerson(slug: string): Promise<Loaded<PersonDetail | null>> {
  "use cache";
  cacheTag("productions", `person:${slug}`);
  const result = await load(async (db, now) => {
    const row = await db.person.findUnique({
      where: { slug },
      include: {
        credits: {
          include: {
            production: {
              select: {
                slug: true,
                title: true,
                premiereDate: true,
                runStart: true,
                theatre: { select: { name: true } },
                performances: { where: { startsAt: { gte: now } }, take: 1, select: { startsAt: true } },
              },
            },
          },
        },
      },
    });
    if (!row) return null;
    return { slug: row.slug, name: row.name, credits: groupCredits(row.credits) };
  });
  if (result.ok) cacheLife("hours");
  else cacheLife("seconds");
  return result;
}

type CreditRow = {
  role: CreditRole;
  characterName: string | null;
  production: {
    slug: string;
    title: string;
    premiereDate: Date | null;
    runStart: Date | null;
    theatre: { name: string };
    performances: { startsAt: Date }[];
  };
};

/** One entry per production, newest first; a person can hold several roles in one. */
function groupCredits(rows: CreditRow[]): PersonCredit[] {
  const byProduction = new Map<string, PersonCredit>();
  for (const row of rows) {
    const { production } = row;
    const entry = byProduction.get(production.slug) ?? {
      production: {
        slug: production.slug,
        title: production.title,
        year: production.premiereDate ?? production.runStart,
        theatre: production.theatre.name,
        upcoming: production.performances.length > 0,
      },
      roles: [],
    };
    entry.roles.push({ role: row.role, characterName: row.characterName });
    byProduction.set(production.slug, entry);
  }
  return [...byProduction.values()].sort(
    (a, b) => (b.production.year?.getTime() ?? 0) - (a.production.year?.getTime() ?? 0),
  );
}

export type SitemapData = {
  productions: { slug: string; updatedAt: Date }[];
  theatres: { slug: string; updatedAt: Date }[];
  people: { slug: string }[];
};

export async function getSitemapData(): Promise<Loaded<SitemapData>> {
  "use cache";
  cacheTag("productions");
  const result = await load(async (db) => {
    const [productions, theatres, people] = await Promise.all([
      db.production.findMany({ select: { slug: true, updatedAt: true } }),
      db.theatre.findMany({ select: { slug: true, updatedAt: true } }),
      db.person.findMany({ select: { slug: true } }),
    ]);
    return { productions, theatres, people };
  });
  if (result.ok) cacheLife("hours");
  else cacheLife("seconds");
  return result;
}
