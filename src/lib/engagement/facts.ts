import type { ProductionType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { effectiveType, isCurrent, LISTED_THEATRE } from "@/lib/catalogue/select";
import { helsinkiDate } from "@/lib/format";

/** One diary entry with the production facts the year review and badges need. */
export interface EntryFacts {
  id: string;
  /** YYYY-MM-DD, the calendar day the user saw it. */
  seenOn: string;
  rating: number | null;
  hasReview: boolean;
  isRewatch: boolean;
  tags: string[];
  production: {
    id: string;
    slug: string;
    title: string;
    type: ProductionType;
    languages: string[];
    theatre: { slug: string; name: string };
    /** Helsinki calendar days, YYYY-MM-DD. */
    premiere: string | null;
    finalPerformance: string | null;
    cast: Array<{ slug: string; name: string }>;
  };
}

/** The last day the run is known to play: the later of the last performance and the printed end. */
function finalDay(performances: Array<{ startsAt: Date }>, runEnd: Date | null): string | null {
  const last = performances.at(-1)?.startsAt ?? null;
  const latest = [last, runEnd].filter((date): date is Date => date !== null).sort((a, b) => b.getTime() - a.getTime())[0];
  return latest ? helsinkiDate(latest) : null;
}

export async function getEntryFacts(userId: string): Promise<EntryFacts[]> {
  const entries = await db.diaryEntry.findMany({
    where: { userId },
    orderBy: [{ seenOn: "asc" }, { createdAt: "asc" }],
    include: {
      tags: { select: { slug: true } },
      production: {
        include: {
          theatre: { select: { slug: true, name: true } },
          performances: { select: { startsAt: true, lastSeenAt: true }, orderBy: { startsAt: "asc" } },
          credits: { where: { role: "CAST" }, include: { person: { select: { slug: true, name: true } } } },
        },
      },
    },
  });
  return entries.map(({ production, ...entry }) => ({
    id: entry.id,
    seenOn: entry.seenOn.toISOString().slice(0, 10),
    rating: entry.rating,
    hasReview: Boolean(entry.review),
    isRewatch: entry.isRewatch,
    tags: entry.tags.map((tag) => tag.slug),
    production: {
      id: production.id,
      slug: production.slug,
      title: production.title,
      type: effectiveType(production),
      languages: production.languages,
      theatre: production.theatre,
      premiere: production.premiereDate ? helsinkiDate(production.premiereDate) : null,
      finalPerformance: finalDay(
        production.performances.filter((performance) => isCurrent(performance, production)),
        production.runEnd,
      ),
      cast: production.credits.filter((credit) => isCurrent(credit, production)).map((credit) => credit.person),
    },
  }));
}

/** Years with at least one entry, newest first. */
export function diaryYears(entries: Array<{ seenOn: string }>): number[] {
  return [...new Set(entries.map((entry) => Number(entry.seenOn.slice(0, 4))))].sort((a, b) => b - a);
}

/** For the "every theatre" badge: the theatres Aitio covers, not a hard-coded six. */
export function theatreCount(): Promise<number> {
  return db.theatre.count({ where: LISTED_THEATRE });
}
