import { slugify, splitPeople } from "@/scrapers/text";

/**
 * What to do with one stored Person row, judged by the same splitter the scraper now uses:
 * keep it, merge its credits into the real people ("Silva Lillrank och Outi Paasivirta"),
 * or drop it with its credits when it is a group or a label ("Starman Työryhmä").
 */
export type PersonFix = { action: "keep" } | { action: "merge"; into: Array<{ slug: string; name: string }> } | { action: "drop" };

export function personFix(person: { slug: string; name: string }): PersonFix {
  const names = splitPeople(person.name);
  if (names.length === 0) return { action: "drop" };
  const into = names.map((name) => ({ slug: slugify(name), name }));
  if (into.length === 1 && into[0].slug === person.slug) return { action: "keep" };
  return { action: "merge", into };
}
