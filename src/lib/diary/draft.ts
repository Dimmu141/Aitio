import { z } from "zod";
import { AUTH_COOKIE_PREFIX, DRAFT_MINUTES } from "@/lib/auth-config";
import { openJson, sealJson } from "@/lib/sign-in-token";
import type { EntryInput } from "./entry-form";

/**
 * "Merkitse nähdyksi" before signing in: the filled-in form waits, encrypted, in this
 * cookie while the visitor signs in, then prefills the form for one more tap. A cookie
 * rather than localStorage: it works without JavaScript and never outlives the hour.
 */
export const DRAFT_COOKIE = `${AUTH_COOKIE_PREFIX}.log_draft`;
export { DRAFT_MINUTES };

const PURPOSE = "log-draft";

const draftSchema = z.object({
  slug: z.string(),
  entry: z.object({
    performanceId: z.string().nullable(),
    seenOn: z.iso.date(),
    rating: z.number().int().min(1).max(10).nullable(),
    review: z.string().nullable(),
    isPublic: z.boolean(),
    isRewatch: z.boolean(),
    tagSlugs: z.array(z.string()),
  }),
});

export function sealDraft(slug: string, entry: EntryInput, secret: string): string {
  return sealJson({ slug, entry }, secret, PURPOSE);
}

/** The draft for this production, or null (none, another show's, tampered or unreadable). */
export function openDraft(token: string | undefined, slug: string, secret: string): EntryInput | null {
  if (!token) return null;
  const parsed = draftSchema.safeParse(openJson(token, secret, PURPOSE));
  return parsed.success && parsed.data.slug === slug ? parsed.data.entry : null;
}
