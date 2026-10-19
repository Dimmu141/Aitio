import { helsinkiDate } from "@/lib/format";
import { WINDOW_DAYS } from "./select";

/**
 * The time chips on the front page. Without one the page shows "soon": the next couple of
 * days, which keeps a phone page short; "all" is the whole two-week window.
 */
export const WHEN = ["soon", "today", "tomorrow", "weekend", "week", "all"] as const;
export type When = (typeof WHEN)[number];
export const DEFAULT_WHEN: When = "soon";

const DAY_MS = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Helsinki calendar dates a chip covers. The weekend is Friday to Sunday, or what's left
 * of it. "Soon" is today and tomorrow, but from Monday to Wednesday it runs to Sunday:
 * many stages are dark early in the week, and the weekend is what people plan for.
 */
export function whenDates(when: When, asOf: Date): Set<string> {
  const today = helsinkiDate(asOf);
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => addDays(today, from + i));
  // getUTCDay of the Helsinki date at noon: 0 Sunday … 6 Saturday.
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const toSunday = (7 - weekday) % 7;
  if (when === "today") return new Set([today]);
  if (when === "tomorrow") return new Set([addDays(today, 1)]);
  if (when === "week") return new Set(range(0, 6));
  if (when === "all") return new Set(range(0, WINDOW_DAYS));
  if (when === "soon") return new Set(range(0, weekday >= 1 && weekday <= 3 ? toSunday : 1));
  return new Set(range(Math.max(0, toSunday - 2), toSunday));
}

/** The first of these performances on a covered date, or null. */
export function firstOn(performances: Date[], dates: Set<string>): Date | null {
  return performances.find((startsAt) => dates.has(helsinkiDate(startsAt))) ?? null;
}
