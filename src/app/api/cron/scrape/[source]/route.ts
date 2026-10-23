import { revalidateTag } from "next/cache";
import { CATALOGUE_TAG } from "@/lib/catalogue/queries";
import { hasBearer } from "@/lib/ops/bearer";
import { scheduledScrape } from "@/lib/ops/scrape";

/** Long enough for the slowest source at one request per second (Svenska Teatern, ~90 s). */
export const maxDuration = 300;

/**
 * One source by hand: `Authorization: Bearer $CRON_SECRET`. The nightly runs no longer
 * come here but from GitHub Actions (.github/workflows/scrape.yml), because 13 runs a
 * night on Vercel used more CPU than the Hobby plan allows (23 Oct 2026).
 */
export async function GET(request: Request, { params }: RouteContext<"/api/cron/scrape/[source]">): Promise<Response> {
  if (!hasBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { source } = await params;
  const outcome = await scheduledScrape(source);
  // expire 0, not "max": with "max" the first visitor after a scrape still got the old page,
  // and an unvisited page kept the old "päivitetty" date (20 Oct 2026).
  if (!outcome.error && !outcome.skipped) revalidateTag(CATALOGUE_TAG, { expire: 0 });
  return Response.json(outcome, { status: outcome.skipped === "unknown source" ? 404 : 200 });
}
