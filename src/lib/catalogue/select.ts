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
 * When the run ends, as far as we know. A source that lists only the next few dates
 * (`hasFullSchedule` false) says nothing with its last listed date; then only the
 * theatre's own end date counts.
 */
export function knownEnd(last: Date | null, runEnd: Date | null, fullSchedule: boolean): Date | null {
  return fullSchedule ? (last ?? runEnd) : runEnd;
}

/** "Viimeiset esitykset": still playing, and the known end falls within the window. */
export function isClosingSoon(timing: Schedule, runEnd: Date | null, fullSchedule: boolean, asOf: Date): boolean {
  if (fullSchedule) return timing.closingSoon;
  return timing.next !== null && runEnd !== null && runEnd < windowEnd(asOf);
}

/**
 * How far the run has progressed, 0–100, or null when the dates don't allow it.
 * Starts at the premiere when we know it, else at the earliest performance we have
 * ever seen. Without a premiere, a start in the future only means our history begins
 * there, so we show nothing rather than a misleading 0 %.
 */
export function runProgress(
  premiere: Date | null,
  earliestSeen: Date | null,
  end: Date | null,
  asOf: Date,
): number | null {
  const start = premiere ?? (earliestSeen && earliestSeen <= asOf ? earliestSeen : null);
  if (!start || !end || end <= start) return null;
  const ratio = (asOf.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

/**
 * Where a production is in its life:
 * - running: has upcoming performances;
 * - upcoming ("Tulossa"): still listed, and nothing has been performed yet or more is to come;
 * - past: its last known date has gone by;
 * - archive: past for longer than `ARCHIVE_MONTHS`, or delisted before any date was known.
 */
export type Phase = "running" | "upcoming" | "past" | "archive";

export const ARCHIVE_MONTHS = 12;

export interface PhaseFacts {
  next: Date | null;
  /** Every stored performance, current or not: history counts. */
  performances: Array<{ startsAt: Date }>;
  runStart: Date | null;
  runEnd: Date | null;
  premiereDate: Date | null;
  delistedAt: Date | null;
}

export interface Lifecycle {
  phase: Phase;
  /** Something has been performed (or the theatre says the run began): the show can be logged as seen. */
  started: boolean;
  /** "Esitetty 2024", for past and archive only. */
  year: number | null;
}

function knownDates(facts: PhaseFacts): number[] {
  return [...facts.performances.map((row) => row.startsAt), facts.runStart, facts.runEnd, facts.premiereDate]
    .filter((date): date is Date => date instanceof Date)
    .map((date) => date.getTime());
}

function archiveCutoff(asOf: Date): number {
  const cutoff = new Date(asOf);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - ARCHIVE_MONTHS);
  return cutoff.getTime();
}

export function lifecycle(facts: PhaseFacts, asOf: Date): Lifecycle {
  const dates = knownDates(facts);
  const now = asOf.getTime();
  const started = dates.some((time) => time <= now);
  if (facts.next) return { phase: "running", started, year: null };
  if (dates.length === 0 || !started) {
    return { phase: facts.delistedAt ? "archive" : "upcoming", started, year: null };
  }
  const last = Math.max(...dates);
  if (last > now && !facts.delistedAt) return { phase: "upcoming", started, year: null };
  const year = new Date(Math.min(last, now)).getUTCFullYear();
  return { phase: last < archiveCutoff(asOf) ? "archive" : "past", started, year };
}

export interface RatingSummary {
  count: number;
  /** Ten buckets for 0.5, 1.0 … 5.0. */
  buckets: number[];
  /** Hidden (null) until there are enough ratings to mean something. */
  average: number | null;
}

export const MIN_RATINGS_FOR_AVERAGE = 10;
/** Below this a histogram shows individual votes more than a distribution. */
export const MIN_RATINGS_FOR_HISTOGRAM = 5;

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
