import type { ProductionType } from "@/generated/prisma/enums";

export const WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows seen in the production's latest scrape; older ones vanished from the theatre's page. */
export function isCurrent(row: { lastSeenAt: Date }, production: { lastSeenAt: Date }): boolean {
  return row.lastSeenAt.getTime() >= production.lastSeenAt.getTime();
}

export function effectiveType(production: { type: ProductionType; typeOverride: ProductionType | null }): ProductionType {
  return production.typeOverride ?? production.type;
}

export function windowEnd(asOf: Date, days = WINDOW_DAYS): Date {
  return new Date(asOf.getTime() + days * DAY_MS);
}

/** Current performances from asOf on, in date order. */
export function upcomingPerformances<T extends { startsAt: Date; lastSeenAt: Date }>(
  performances: T[],
  production: { lastSeenAt: Date },
  asOf: Date,
): T[] {
  return performances
    .filter((performance) => performance.startsAt >= asOf && isCurrent(performance, production))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export interface Schedule {
  next: Date | null;
  last: Date | null;
  /** Plays within the window. */
  onSoon: boolean;
  /** The last known performance falls within the window. */
  closingSoon: boolean;
}

export function schedule(upcoming: Array<{ startsAt: Date }>, asOf: Date, days = WINDOW_DAYS): Schedule {
  const end = windowEnd(asOf, days);
  const next = upcoming[0]?.startsAt ?? null;
  const last = upcoming.at(-1)?.startsAt ?? null;
  return {
    next,
    last,
    onSoon: next !== null && next < end,
    closingSoon: last !== null && last < end,
  };
}

/**
 * How far the run has progressed, 0–100, or null when the dates don't allow it.
 * Starts at the premiere when we know it, else the first date we have.
 */
export function runProgress(start: Date | null, end: Date | null, asOf: Date): number | null {
  if (!start || !end || end <= start) return null;
  const ratio = (asOf.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

/** Year label for productions that are no longer playing: last performance, else run end or premiere. */
export function lastYear(dates: Array<Date | null | undefined>): number | null {
  const times = dates.filter((date): date is Date => date instanceof Date).map((date) => date.getTime());
  return times.length > 0 ? new Date(Math.max(...times)).getUTCFullYear() : null;
}

export interface RatingSummary {
  count: number;
  /** Ten buckets for 0.5, 1.0 … 5.0. */
  buckets: number[];
  /** Hidden (null) until there are enough ratings to mean something. */
  average: number | null;
}

export const MIN_RATINGS_FOR_AVERAGE = 10;

export function summariseRatings(ratings: number[]): RatingSummary {
  const buckets = Array.from({ length: 10 }, () => 0);
  for (const rating of ratings) {
    const index = Math.round(rating * 2) - 1;
    if (index >= 0 && index < buckets.length) buckets[index] += 1;
  }
  const count = ratings.length;
  const average =
    count >= MIN_RATINGS_FOR_AVERAGE ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / count) * 10) / 10 : null;
  return { count, buckets, average };
}
