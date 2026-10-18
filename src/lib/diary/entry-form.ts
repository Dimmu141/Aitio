import { z } from "zod";
import { helsinkiDate } from "@/lib/format";
import { MAX_TAGS_PER_ENTRY } from "./tags";

export const MAX_REVIEW_LENGTH = 500;
const EARLIEST = "1950-01-01";

export interface EntryInput {
  performanceId: string | null;
  /** YYYY-MM-DD, Helsinki calendar day. */
  seenOn: string;
  /** Half-stars 1–10, or null for no rating. */
  rating: number | null;
  review: string | null;
  isPublic: boolean;
  isRewatch: boolean;
  tagSlugs: string[];
}

export type EntryError = "date" | "rating" | "review" | "tags" | "performance";

export interface EntryContext {
  performances: Array<{ id: string; startsAt: Date }>;
  tagSlugs: string[];
  asOf: Date;
}

export type FormFields = Record<string, string | readonly string[] | undefined>;

type Field = FormFields[string];
const single = (value: Field): string => (typeof value === "string" ? value : value?.[0])?.trim() ?? "";
const many = (value: Field): string[] => (value === undefined ? [] : typeof value === "string" ? [value] : [...value]);

const isoDate = z.iso.date();

/** Validate the Merkitse nähdyksi form. Returns field-level error codes the page translates. */
export function parseEntryForm(
  fields: FormFields,
  context: EntryContext,
): { ok: true; value: EntryInput } | { ok: false; errors: EntryError[] } {
  const errors: EntryError[] = [];
  const today = helsinkiDate(context.asOf);

  let performanceId: string | null = null;
  let seenOn = single(fields.date);
  const when = single(fields.when);
  if (when.startsWith("perf:")) {
    const performance = context.performances.find((candidate) => candidate.id === when.slice(5));
    if (!performance || performance.startsAt > context.asOf) errors.push("performance");
    else {
      performanceId = performance.id;
      seenOn = helsinkiDate(performance.startsAt);
    }
  } else if (!isoDate.safeParse(seenOn).success || seenOn > today || seenOn < EARLIEST) {
    errors.push("date");
  }

  const ratingText = single(fields.rating);
  const rating = ratingText === "" ? null : Number(ratingText);
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 10)) errors.push("rating");

  const review = single(fields.review).replace(/\r\n/g, "\n");
  if (review.length > MAX_REVIEW_LENGTH) errors.push("review");

  const tagSlugs = [...new Set(many(fields.tags))];
  if (tagSlugs.length > MAX_TAGS_PER_ENTRY || tagSlugs.some((slug) => !context.tagSlugs.includes(slug))) {
    errors.push("tags");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      performanceId,
      seenOn,
      rating,
      review: review === "" ? null : review,
      isPublic: single(fields.isPublic) === "on",
      isRewatch: single(fields.isRewatch) === "on",
      tagSlugs,
    },
  };
}

/** FormData to the plain record parseEntryForm takes (repeated keys become arrays). */
export function formFields(formData: FormData): FormFields {
  const fields: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key).filter((value): value is string => typeof value === "string");
    fields[key] = values.length === 1 ? values[0] : values;
  }
  return fields;
}

/** The choice to preselect: the latest past performance within two days, else today's date. */
export function defaultWhen(performances: Array<{ id: string; startsAt: Date }>, asOf: Date): string {
  const recent = performances
    .filter((performance) => performance.startsAt <= asOf && asOf.getTime() - performance.startsAt.getTime() < 2 * 86_400_000)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];
  return recent ? `perf:${recent.id}` : "date";
}
