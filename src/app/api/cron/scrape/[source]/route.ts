import { hasBearer } from "@/lib/ops/bearer";
import { scheduledScrape } from "@/lib/ops/scrape";

/** Long enough for the slowest source at one request per second (Svenska Teatern, ~90 s). */
export const maxDuration = 300;

/** Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`; see vercel.json. */
export async function GET(request: Request, { params }: RouteContext<"/api/cron/scrape/[source]">): Promise<Response> {
  if (!hasBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { source } = await params;
  const outcome = await scheduledScrape(source);
  return Response.json(outcome, { status: outcome.skipped === "unknown source" ? 404 : 200 });
}
