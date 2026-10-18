import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";

/**
 * Cache invalidation for processes outside Next.js: the moderation CLI (hide a review
 * now) and, from milestone 4, the scraper after a run. POST with
 * `Authorization: Bearer $REVALIDATE_SECRET` and `{ "tags": [...], "immediate": true }`.
 */
const body = z.object({
  tags: z.array(z.string().regex(/^(catalogue|production:[a-z0-9-]+)$/)).min(1).max(100),
  immediate: z.boolean().optional(),
});

function authorised(header: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request): Promise<Response> {
  if (!authorised(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  // Moderation wants a hidden review gone on the next request; the scraper can serve stale.
  const profile = parsed.data.immediate ? { expire: 0 } : "max";
  for (const tag of parsed.data.tags) revalidateTag(tag, profile);
  return Response.json({ revalidated: parsed.data.tags });
}
