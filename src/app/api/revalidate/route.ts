import { revalidateTag } from "next/cache";
import { z } from "zod";
import { hasBearer } from "@/lib/ops/bearer";

/**
 * Cache invalidation for processes outside Next.js: the moderation CLI (hide a review
 * now) and, from milestone 4, the scraper after a run. POST with
 * `Authorization: Bearer $REVALIDATE_SECRET` and `{ "tags": [...], "immediate": true }`.
 */
const body = z.object({
  tags: z.array(z.string().regex(/^(catalogue|production:[a-z0-9-]+)$/)).min(1).max(100),
  immediate: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
  if (!hasBearer(request.headers.get("authorization"), process.env.REVALIDATE_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  // Moderation wants a hidden review gone on the next request; the scraper can serve stale.
  const profile = parsed.data.immediate ? { expire: 0 } : "max";
  for (const tag of parsed.data.tags) revalidateTag(tag, profile);
  return Response.json({ revalidated: parsed.data.tags });
}
