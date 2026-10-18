import { cleanup } from "@/lib/ops/cleanup";
import { hasBearer } from "@/lib/ops/bearer";

/** Daily removal of expired sessions, sign-in tokens and rate-limit rows (vercel.json). */
export async function GET(request: Request): Promise<Response> {
  if (!hasBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await cleanup(new Date()));
}
