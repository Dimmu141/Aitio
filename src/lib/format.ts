import { INTL_LOCALE, type Locale } from "@/i18n/config";

/** All display formatting is pinned to Helsinki; servers (Vercel) run in UTC. */
export const TIME_ZONE = "Europe/Helsinki";

function helsinkiYear(date: Date): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: TIME_ZONE, year: "numeric" }).format(date));
}

/** "pe 23.10. klo 18.30"; the year is added when it isn't the current one. */
export function formatPerformance(date: Date, locale: Locale, asOf: Date): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: helsinkiYear(date) === helsinkiYear(asOf) ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** "23. lokakuuta 2026". */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Machine-readable value for <time dateTime>. */
export function isoDateTime(date: Date): string {
  return date.toISOString();
}

/** The Helsinki calendar day of a moment, as YYYY-MM-DD. */
export function helsinkiDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

/** A calendar date stored as UTC midnight (Postgres DATE), e.g. DiaryEntry.seenOn. */
export function formatCalendarDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
