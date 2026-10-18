import type { EntryFacts } from "./facts";

/** Test helper: an entry with sensible defaults; override what the test is about. */
export function entry(
  seenOn: string,
  overrides: Omit<Partial<EntryFacts>, "production"> & { production?: Partial<EntryFacts["production"]> } = {},
): EntryFacts {
  const { production, ...rest } = overrides;
  const slug = production?.slug ?? "nattland";
  return {
    id: `${seenOn}-${slug}-${Math.random().toString(36).slice(2, 6)}`,
    seenOn,
    rating: null,
    hasReview: false,
    isRewatch: false,
    tags: [],
    ...rest,
    production: {
      id: slug,
      slug,
      title: slug,
      type: "PLAY",
      languages: ["fi"],
      theatre: { slug: "kansallisteatteri", name: "Kansallisteatteri" },
      premiere: null,
      finalPerformance: null,
      cast: [],
      ...production,
    },
  };
}
