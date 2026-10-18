import type { ProductionType } from "@/generated/prisma/enums";
import { hasFullSchedule } from "@/scrapers/theatres";
import { parseDuration } from "./duration";
import { effectiveType, isClosingSoon, knownEnd, lastYear, schedule, upcomingPerformances, windowEnd } from "./select";
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
  durationText: true,
  lastSeenAt: true,
  delistedAt: true,
  premiereDate: true,
  runEnd: true,
  theatre: theatreSelect,
  stage: { select: { name: true } },
  performances: { select: { startsAt: true, lastSeenAt: true, subtitleLangs: true }, orderBy: { startsAt: "asc" } },
} as const;

interface CardSource {
  slug: string;
  title: string;
  type: ProductionType;
  typeOverride: ProductionType | null;
  languages: string[];
  subtitleLangs: string[];
  durationText: string | null;
  lastSeenAt: Date;
  delistedAt: Date | null;
  premiereDate: Date | null;
  runEnd: Date | null;
  theatre: TheatreRef;
  stage: { name: string } | null;
  performances: Array<{ startsAt: Date; lastSeenAt: Date; subtitleLangs: string[] }>;
}

/** Production-wide subtitles plus those at any performance within the window. */
function subtitlesSoon(source: CardSource, soon: CardSource["performances"]): string[] {
  return [...new Set([...source.subtitleLangs, ...soon.flatMap((performance) => performance.subtitleLangs)])];
}

export function toCard(source: CardSource, asOf: Date): ProductionCard {
  const upcoming = source.delistedAt ? [] : upcomingPerformances(source.performances, source, asOf);
  const timing = schedule(upcoming, asOf);
  const soon = upcoming.filter((performance) => performance.startsAt < windowEnd(asOf));
  const fullSchedule = hasFullSchedule(source.theatre.slug);
  return {
    slug: source.slug,
    title: source.title,
    theatre: source.theatre,
    stage: source.stage?.name ?? null,
    type: effectiveType(source),
    languages: source.languages,
    subtitleLangs: subtitlesSoon(source, soon),
    ...timing,
    soon: soon.map((performance) => performance.startsAt),
    duration: parseDuration(source.durationText),
    premiere: source.premiereDate,
    end: knownEnd(timing.last, source.runEnd, fullSchedule),
    closingSoon: isClosingSoon(timing, source.runEnd, fullSchedule, asOf),
    year: timing.next ? null : lastYear([source.performances.at(-1)?.startsAt, source.runEnd, source.premiereDate]),
  };
}
