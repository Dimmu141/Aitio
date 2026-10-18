import type { EntryFacts } from "./facts";

/**
 * Badges are computed from the diary on every view, never stored: editing or deleting
 * an entry changes them at once, and a new rule applies to old diaries for free.
 */
export const BADGE_IDS = [
  "first",
  "regular",
  "box",
  "wanderer",
  "wholeCity",
  "premiere",
  "lastChance",
  "bilingual",
  "critic",
  "versatile",
  "again",
  "busyMonth",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export interface Badge {
  id: BadgeId;
  /** The day of the entry that earned it, YYYY-MM-DD; null while locked. */
  earnedOn: string | null;
  /** For counting badges: how far along the user is. */
  progress: { current: number; target: number } | null;
}

export const TARGETS = { regular: 10, box: 50, wanderer: 3, critic: 10, versatile: 4, busyMonth: 4 } as const;

type Rule = (entries: EntryFacts[], theatreCount: number) => Omit<Badge, "id">;

/** The entry at which `key` first reaches `target` distinct values. */
function nthDistinct(entries: EntryFacts[], key: (entry: EntryFacts) => string[], target: number): Omit<Badge, "id"> {
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const value of key(entry)) seen.add(value);
    if (seen.size >= target) return { earnedOn: entry.seenOn, progress: { current: target, target } };
  }
  return { earnedOn: null, progress: { current: seen.size, target } };
}

function count(entries: EntryFacts[], target: number, matches: (entry: EntryFacts) => boolean): Omit<Badge, "id"> {
  const hits = entries.filter(matches);
  return { earnedOn: hits[target - 1]?.seenOn ?? null, progress: { current: Math.min(hits.length, target), target } };
}

function firstWhere(entries: EntryFacts[], matches: (entry: EntryFacts, index: number) => boolean): Omit<Badge, "id"> {
  return { earnedOn: entries.find(matches)?.seenOn ?? null, progress: null };
}

function busyMonth(entries: EntryFacts[]): Omit<Badge, "id"> {
  const perMonth = new Map<string, number>();
  let best = 0;
  for (const entry of entries) {
    const month = entry.seenOn.slice(0, 7);
    const n = (perMonth.get(month) ?? 0) + 1;
    perMonth.set(month, n);
    best = Math.max(best, n);
    if (n >= TARGETS.busyMonth) return { earnedOn: entry.seenOn, progress: { current: TARGETS.busyMonth, target: TARGETS.busyMonth } };
  }
  return { earnedOn: null, progress: { current: best, target: TARGETS.busyMonth } };
}

const RULES: Record<BadgeId, Rule> = {
  first: (entries) => firstWhere(entries, () => true),
  regular: (entries) => count(entries, TARGETS.regular, () => true),
  box: (entries) => count(entries, TARGETS.box, () => true),
  wanderer: (entries) => nthDistinct(entries, (entry) => [entry.production.theatre.slug], TARGETS.wanderer),
  wholeCity: (entries, theatreCount) =>
    nthDistinct(entries, (entry) => [entry.production.theatre.slug], Math.max(theatreCount, 1)),
  premiere: (entries) => firstWhere(entries, (entry) => entry.seenOn === entry.production.premiere),
  // Only once the run is over can we be sure the day was the last one.
  lastChance: (entries) => firstWhere(entries, (entry) => entry.seenOn === entry.production.finalPerformance),
  bilingual: (entries) =>
    nthDistinct(
      entries,
      (entry) => entry.production.languages.filter((language) => language === "fi" || language === "sv"),
      2,
    ),
  critic: (entries) => count(entries, TARGETS.critic, (entry) => entry.hasReview),
  versatile: (entries) => nthDistinct(entries, (entry) => [entry.production.type], TARGETS.versatile),
  again: (entries) =>
    firstWhere(
      entries,
      (entry, index) => entry.isRewatch || entries.slice(0, index).some((other) => other.production.id === entry.production.id),
    ),
  busyMonth,
};

/**
 * Every badge, earned or not. `asOf` keeps "last chance" honest: a run whose final
 * known date is still ahead may yet get more performances.
 */
export function badges(all: EntryFacts[], theatreCount: number, asOf: string): Badge[] {
  const entries = [...all]
    .filter((entry) => entry.seenOn <= asOf)
    .sort((a, b) => a.seenOn.localeCompare(b.seenOn))
    .map((entry) =>
      entry.production.finalPerformance && entry.production.finalPerformance < asOf
        ? entry
        : { ...entry, production: { ...entry.production, finalPerformance: null } },
    );
  return BADGE_IDS.map((id) => ({ id, ...RULES[id](entries, theatreCount) }));
}
