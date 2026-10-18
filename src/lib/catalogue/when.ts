import { helsinkiDate } from "@/lib/format";

/** The quick time chips on the front page; without one the list covers the whole window. */
export const WHEN = ["today", "tomorrow", "weekend", "week"] as const;
export type When = (typeof WHEN)[number];

const DAY_MS = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Helsinki calendar dates a chip covers. The weekend is Friday to Sunday, or what's left of it. */
export function whenDates(when: When, asOf: Date): Set<string> {
  const today = helsinkiDate(asOf);
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => addDays(today, from + i));
  if (when === "today") return new Set([today]);
  if (when === "tomorrow") return new Set([addDays(today, 1)]);
  if (when === "week") return new Set(range(0, 6));
  // getUTCDay of the Helsinki date at noon: 0 Sunday … 6 Saturday.
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const toSunday = (7 - weekday) % 7;
  return new Set(range(Math.max(0, toSunday - 2), toSunday));
}

/** The first of these performances on a covered date, or null. */
export function firstOn(performances: Date[], dates: Set<string>): Date | null {
  return performances.find((startsAt) => dates.has(helsinkiDate(startsAt))) ?? null;
}
