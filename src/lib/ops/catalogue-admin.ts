import type { ProductionType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/** Below this the classifier is guessing; an admin should look. */
export const REVIEW_BELOW_CONFIDENCE = 0.6;

export interface TypeReviewRow {
  id: string;
  slug: string;
  title: string;
  theatre: string;
  type: ProductionType;
  typeConfidence: number;
  typeOverride: ProductionType | null;
  /** Next performance; what is on soon matters more than an archived post. */
  next: Date | null;
}

/**
 * Unsure classifications first, those on stage soonest at the top (the Svenska Teatern
 * archive would otherwise bury this week's shows), then everything already overridden.
 */
export function reviewOrder(a: TypeReviewRow, b: TypeReviewRow): number {
  const overridden = Number(a.typeOverride !== null) - Number(b.typeOverride !== null);
  const playing = Number(a.next === null) - Number(b.next === null);
  const soonest = (a.next?.getTime() ?? 0) - (b.next?.getTime() ?? 0);
  return overridden || playing || soonest || a.typeConfidence - b.typeConfidence || a.title.localeCompare(b.title, "fi");
}

export async function typeReviewQueue(asOf: Date): Promise<TypeReviewRow[]> {
  const rows = await db.production.findMany({
    where: {
      OR: [{ typeConfidence: { lt: REVIEW_BELOW_CONFIDENCE }, typeOverride: null }, { typeOverride: { not: null } }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      typeConfidence: true,
      typeOverride: true,
      theatre: { select: { name: true } },
      performances: { where: { startsAt: { gte: asOf } }, select: { startsAt: true }, orderBy: { startsAt: "asc" }, take: 1 },
    },
  });
  return rows
    .map(({ theatre, performances, ...row }) => ({ ...row, theatre: theatre.name, next: performances[0]?.startsAt ?? null }))
    .sort(reviewOrder)
    .slice(0, 100);
}

/** Set or clear (null) the manual type; returns the slug for cache invalidation. */
export async function setTypeOverride(productionId: string, type: ProductionType | null): Promise<string | null> {
  const row = await db.production.update({ where: { id: productionId }, data: { typeOverride: type }, select: { slug: true } });
  return row.slug;
}
