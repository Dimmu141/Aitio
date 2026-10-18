import type { ProductionType } from "@/generated/prisma/enums";
import { effectiveType, lastYear, schedule, upcomingPerformances } from "./select";
import type { ProductionCard, TheatreRef } from "./types";

/** The select and mapping behind every production list; kept free of next/cache for scripts and tests. */
export const theatreSelect = { select: { slug: true, name: true, city: true } } as const;

export const cardSelect = {
  slug: true,
  title: true,
  type: true,
  typeOverride: true,
  languages: true,
  subtitleLangs: true,
  lastSeenAt: true,
  premiereDate: true,
  runEnd: true,
  theatre: theatreSelect,
  stage: { select: { name: true } },
  performances: { select: { startsAt: true, lastSeenAt: true }, orderBy: { startsAt: "asc" } },
} as const;

interface CardSource {
  slug: string;
  title: string;
  type: ProductionType;
  typeOverride: ProductionType | null;
  languages: string[];
  subtitleLangs: string[];
  lastSeenAt: Date;
  premiereDate: Date | null;
  runEnd: Date | null;
  theatre: TheatreRef;
  stage: { name: string } | null;
  performances: Array<{ startsAt: Date; lastSeenAt: Date }>;
}

export function toCard(source: CardSource, asOf: Date): ProductionCard {
  const upcoming = upcomingPerformances(source.performances, source, asOf);
  const timing = schedule(upcoming, asOf);
  return {
    slug: source.slug,
    title: source.title,
    theatre: source.theatre,
    stage: source.stage?.name ?? null,
    type: effectiveType(source),
    languages: source.languages,
    subtitleLangs: source.subtitleLangs,
    ...timing,
    year: timing.next ? null : lastYear([source.performances.at(-1)?.startsAt, source.runEnd, source.premiereDate]),
  };
}
