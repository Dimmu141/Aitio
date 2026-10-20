import { cleanup } from "@/lib/ops/cleanup";
import { hasBearer } from "@/lib/ops/bearer";
import { alertOverdueSources } from "@/lib/ops/scrape";

/**
 * Daily removal of expired sessions, sign-in tokens and rate-limit rows, then the overdue
 * check. Scheduled after the scrape window (vercel.json), so a late cron is not "overdue".
 */
export async function GET(request: Request): Promise<Response> {
  if (!hasBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const now = new Date();
  const outcome = await cleanup(now);
  return Response.json({ ...outcome, overdue: await alertOverdueSources(now) });
}
