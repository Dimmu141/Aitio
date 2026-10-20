import type { ProductionType } from "@/generated/prisma/enums";
import { helsinkiDate } from "@/lib/format";
import { windowEnd } from "./select";
import type { ProductionCard } from "./types";

export interface Day {
  /** Helsinki calendar date, YYYY-MM-DD. */
  date: string;
  /** "today", "tomorrow" or null for a later day. */
  relative: "today" | "tomorrow" | null;
  /** A moment on that day, for formatting the heading. */
  sample: Date;
  /** One per production that day; `next` is its first performance, `times` every one. */
  cards: DayCard[];
}

/** A card under a day heading: Miniooppera Reininkulta at 11, 12, 13 and 14 is one card. */
export type DayCard = ProductionCard & { times: Date[] };

const DAY_MS = 86_400_000;

/**
 * A real day-by-day programme: every performance in `soon` under its Helsinki day, in
 * date and time order, so a show on Tuesday and Wednesday is listed on both. Several
 * performances of one production on one day share a card (third review, 20 Oct 2026). The front
 * page keeps this short by defaulting to the next few days. Relative names come from
 * asOf, the same moment the cached list was computed for.
 */
export function groupByDay(cards: ProductionCard[], asOf: Date): Day[] {
  const today = helsinkiDate(asOf);
  const tomorrow = helsinkiDate(new Date(asOf.getTime() + DAY_MS));
  const days = new Map<string, Day>();
  for (const card of cards) {
    for (const startsAt of card.soon) {
      const date = helsinkiDate(startsAt);
      const day = days.get(date) ?? {
        date,
        relative: date === today ? "today" : date === tomorrow ? "tomorrow" : null,
        sample: startsAt,
        cards: [],
      };
      const same = day.cards.find((existing) => existing.slug === card.slug);
      if (same) same.times.push(startsAt);
      else day.cards.push({ ...card, next: startsAt, times: [startsAt] });
      days.set(date, day);
    }
  }
  return [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      ...day,
      cards: day.cards
        .map((card) => ({ ...card, times: [...card.times].sort((a, b) => a.getTime() - b.getTime()), next: minDate(card.times) }))
        .sort((a, b) => a.next.getTime() - b.next.getTime()),
    }));
}

function minDate(dates: Date[]): Date {
  return dates.reduce((earliest, date) => (date < earliest ? date : earliest));
}

/** A premiere is a new staging; a stand-up night or a concert "premiering" is not news here. */
const PREMIERE_TYPES: ReadonlySet<ProductionType> = new Set(["PLAY", "MUSICAL", "OPERA", "DANCE"]);

/**
 * Plays, musicals, operas and dance pieces whose premiere, as the theatre states it,
 * falls between today and the end of the window, earliest first. Only the stated date
 * counts: the first stored performance is just the first one we happened to see.
 */
export function premieresSoon(cards: ProductionCard[], asOf: Date): ProductionCard[] {
  const today = helsinkiDate(asOf);
  const end = windowEnd(asOf);
  return cards
    .filter((card) => PREMIERE_TYPES.has(card.type))
    .filter((card) => card.premiere && helsinkiDate(card.premiere) >= today && card.premiere < end)
    .sort((a, b) => (a.premiere?.getTime() ?? 0) - (b.premiere?.getTime() ?? 0));
}
