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
}

/** Unsure classifications without an override, then everything already overridden. */
export async function typeReviewQueue(): Promise<TypeReviewRow[]> {
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
    },
    orderBy: [{ typeOverride: { sort: "asc", nulls: "first" } }, { typeConfidence: "asc" }, { title: "asc" }],
    take: 100,
  });
  return rows.map(({ theatre, ...row }) => ({ ...row, theatre: theatre.name }));
}

/** Set or clear (null) the manual type; returns the slug for cache invalidation. */
export async function setTypeOverride(productionId: string, type: ProductionType | null): Promise<string | null> {
  const row = await db.production.update({ where: { id: productionId }, data: { typeOverride: type }, select: { slug: true } });
  return row.slug;
}
