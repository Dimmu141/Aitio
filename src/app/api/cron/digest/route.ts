import { sendDigests } from "@/lib/engagement/send-digests";
import { hasBearer } from "@/lib/ops/bearer";

/** A full batch at Resend's default rate takes about two minutes. */
export const maxDuration = 300;

/** Weekly "closing soon" email; Vercel Cron calls it on Thursday mornings (vercel.json). */
export async function GET(request: Request): Promise<Response> {
  if (!hasBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const outcome = await sendDigests(new Date());
  console.info("digest", outcome);
  return Response.json(outcome);
}
