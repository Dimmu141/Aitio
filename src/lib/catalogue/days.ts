import { helsinkiDate } from "@/lib/format";
import type { ProductionCard } from "./types";

export interface Day {
  /** Helsinki calendar date, YYYY-MM-DD. */
  date: string;
  /** "today", "tomorrow" or null for a later day. */
  relative: "today" | "tomorrow" | null;
  /** A moment on that day, for formatting the heading. */
  sample: Date;
  cards: ProductionCard[];
}

const DAY_MS = 86_400_000;

/**
 * Cards grouped by the Helsinki day of their next performance, in date order. Each
 * production appears once, under its next date: a full per-performance calendar would
 * repeat a show that plays daily a dozen times. Relative names come from asOf, the
 * same moment the cached list was computed for.
 */
export function groupByNextDay(cards: ProductionCard[], asOf: Date): Day[] {
  const today = helsinkiDate(asOf);
  const tomorrow = helsinkiDate(new Date(asOf.getTime() + DAY_MS));
  const days = new Map<string, Day>();
  for (const card of cards) {
    if (!card.next) continue;
    const date = helsinkiDate(card.next);
    const day = days.get(date) ?? {
      date,
      relative: date === today ? "today" : date === tomorrow ? "tomorrow" : null,
      sample: card.next,
      cards: [],
    };
    day.cards.push(card);
    days.set(date, day);
  }
  return [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({ ...day, cards: day.cards.sort((a, b) => (a.next?.getTime() ?? 0) - (b.next?.getTime() ?? 0)) }));
}
