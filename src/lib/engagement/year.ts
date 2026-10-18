import type { ProductionType } from "@/generated/prisma/enums";
import type { EntryFacts } from "./facts";

export interface Ranked<T> {
  item: T;
  count: number;
}

export interface YearReview {
  year: number;
  shows: number;
  productions: number;
  rewatches: number;
  reviews: number;
  /** Shows per calendar month, January first. */
  months: number[];
  busiestMonth: number | null;
  theatres: Array<Ranked<{ slug: string; name: string }>>;
  types: Array<Ranked<ProductionType>>;
  languages: string[];
  /** In stars (0.5–5), rounded to one decimal. */
  averageRating: number | null;
  rated: number;
  favourites: Array<{ slug: string; title: string; theatre: string; rating: number; seenOn: string }>;
  tags: Array<Ranked<string>>;
  /** Performers seen in at least two different productions this year. */
  performers: Array<Ranked<{ slug: string; name: string }>>;
  first: { slug: string; title: string; seenOn: string } | null;
  last: { slug: string; title: string; seenOn: string } | null;
}

const MAX_FAVOURITES = 3;
const MAX_TAGS = 3;
const MAX_PERFORMERS = 3;

function rank<T>(items: T[], key: (item: T) => string, locale = "fi"): Array<Ranked<T>> {
  const counts = new Map<string, Ranked<T>>();
  for (const item of items) {
    const entry = counts.get(key(item)) ?? { item, count: 0 };
    entry.count += 1;
    counts.set(key(item), entry);
  }
  return [...counts.entries()]
    .sort(([keyA, a], [keyB, b]) => b.count - a.count || keyA.localeCompare(keyB, locale))
    .map(([, entry]) => entry);
}

function months(entries: EntryFacts[]): number[] {
  const counts = Array.from({ length: 12 }, () => 0);
  for (const entry of entries) counts[Number(entry.seenOn.slice(5, 7)) - 1] += 1;
  return counts;
}

function busiest(counts: number[]): number | null {
  const max = Math.max(...counts);
  return max > 0 ? counts.indexOf(max) : null;
}

function favourites(entries: EntryFacts[]): YearReview["favourites"] {
  const best = new Map<string, EntryFacts & { rating: number }>();
  for (const entry of entries) {
    if (entry.rating === null) continue;
    const current = best.get(entry.production.id);
    if (!current || entry.rating > current.rating) best.set(entry.production.id, { ...entry, rating: entry.rating });
  }
  return [...best.values()]
    .sort((a, b) => b.rating - a.rating || a.seenOn.localeCompare(b.seenOn))
    .slice(0, MAX_FAVOURITES)
    .map((entry) => ({
      slug: entry.production.slug,
      title: entry.production.title,
      theatre: entry.production.theatre.name,
      rating: entry.rating,
      seenOn: entry.seenOn,
    }));
}

/** Each performer counts once per production, so a rewatch doesn't double them. */
function performers(entries: EntryFacts[]): YearReview["performers"] {
  const seen = new Map<string, EntryFacts["production"]>();
  for (const entry of entries) seen.set(entry.production.id, entry.production);
  return rank([...seen.values()].flatMap((production) => production.cast), (person) => person.slug)
    .filter((entry) => entry.count >= 2)
    .slice(0, MAX_PERFORMERS);
}

function average(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length / 2) * 10) / 10;
}

/** Entries flagged as a rewatch, or with an earlier entry for the same production (in any year). */
function repeats(all: EntryFacts[], entries: EntryFacts[]): number {
  return entries.filter(
    (entry) =>
      entry.isRewatch ||
      all.some((other) => other.production.id === entry.production.id && other.seenOn < entry.seenOn),
  ).length;
}

function ref(entry: EntryFacts | undefined) {
  return entry ? { slug: entry.production.slug, title: entry.production.title, seenOn: entry.seenOn } : null;
}

/** The year in review from the user's entries (any order, any years). */
export function yearInReview(all: EntryFacts[], year: number): YearReview {
  const entries = all
    .filter((entry) => entry.seenOn.startsWith(`${year}-`))
    .sort((a, b) => a.seenOn.localeCompare(b.seenOn));
  const monthly = months(entries);
  const ratings = entries.flatMap((entry) => (entry.rating === null ? [] : [entry.rating]));
  return {
    year,
    shows: entries.length,
    productions: new Set(entries.map((entry) => entry.production.id)).size,
    rewatches: repeats(all, entries),
    reviews: entries.filter((entry) => entry.hasReview).length,
    months: monthly,
    busiestMonth: busiest(monthly),
    theatres: rank(
      entries.map((entry) => entry.production.theatre),
      (theatre) => theatre.slug,
    ),
    types: rank(
      entries.map((entry) => entry.production.type),
      (type) => type,
    ),
    languages: [...new Set(entries.flatMap((entry) => entry.production.languages))].sort(),
    averageRating: average(ratings),
    rated: ratings.length,
    favourites: favourites(entries),
    tags: rank(
      entries.flatMap((entry) => entry.tags),
      (tag) => tag,
    ).slice(0, MAX_TAGS),
    performers: performers(entries),
    first: ref(entries[0]),
    last: ref(entries.at(-1)),
  };
}
