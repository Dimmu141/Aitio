import type { ProductionType } from "@/generated/prisma/enums";
import type { Dictionary } from "@/i18n/dictionaries/fi";

/**
 * The type as shown to visitors, or null for OTHER: the classifier's "don't know"
 * (no credits published yet, festivals, open days) reads as missing data on a card.
 * Admins set the real type in /yllapito; the admin page keeps showing "Muu".
 */
export function typeLabel(type: ProductionType, t: Dictionary): string | null {
  return type === "OTHER" ? null : t.types[type];
}
