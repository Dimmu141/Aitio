import type { ProductionCard } from "./types";

/**
 * Search over a small, cached index (a few hundred productions, a thousand people), so
 * it runs in memory: no database round trip, and accents are forgiven both ways:
 * "hayrynen" finds Häyrynen, "Molière" finds "Moliere".
 */
export interface SearchIndex {
  productions: ProductionCard[];
  people: Array<{ slug: string; name: string; productions: number }>;
  theatres: Array<{ slug: string; name: string; city: string }>;
}

export interface SearchResults {
  productions: ProductionCard[];
  people: SearchIndex["people"];
  theatres: SearchIndex["theatres"];
}

export const MIN_QUERY_LENGTH = 2;
const MAX_PRODUCTIONS = 30;
const MAX_PEOPLE = 20;

export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Lower is better: the whole text, its start, a word start, anywhere; null if a word is missing. */
function score(text: string, words: string[], phrase: string): number | null {
  const haystack = normalise(text);
  if (!words.every((word) => haystack.includes(word))) return null;
  if (haystack === phrase) return 0;
  if (haystack.startsWith(phrase)) return 1;
  if (` ${haystack}`.includes(` ${phrase}`)) return 2;
  return 3;
}

function ranked<T>(items: T[], text: (item: T) => string, phrase: string, tiebreak: (a: T, b: T) => number): T[] {
  const words = phrase.split(" ");
  return items
    .flatMap((item) => {
      const rank = score(text(item), words, phrase);
      return rank === null ? [] : [{ item, rank }];
    })
    .sort((a, b) => a.rank - b.rank || tiebreak(a.item, b.item))
    .map(({ item }) => item);
}

/** Playing shows before past ones, then soonest first; people with more work first. */
export function search(index: SearchIndex, query: string): SearchResults | null {
  const phrase = normalise(query);
  if (phrase.length < MIN_QUERY_LENGTH) return null;
  const playing = (card: ProductionCard) => (card.next ? 0 : 1);
  return {
    productions: ranked(
      index.productions,
      (card) => card.title,
      phrase,
      (a, b) =>
        playing(a) - playing(b) ||
        (a.next?.getTime() ?? 0) - (b.next?.getTime() ?? 0) ||
        (b.year ?? 0) - (a.year ?? 0),
    ).slice(0, MAX_PRODUCTIONS),
    people: ranked(index.people, (person) => person.name, phrase, (a, b) => b.productions - a.productions).slice(0, MAX_PEOPLE),
    theatres: ranked(index.theatres, (theatre) => theatre.name, phrase, (a, b) => a.name.localeCompare(b.name, "fi")),
  };
}

export function isEmpty(results: SearchResults): boolean {
  return results.productions.length + results.people.length + results.theatres.length === 0;
}
