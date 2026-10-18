import { addressesToStop } from "@/lib/engagement/email-events";
import { stopDigestFor } from "@/lib/engagement/send-digests";
import { hasBearer } from "@/lib/ops/bearer";

/** Brevo's transactional webhook, set up with bearer auth `EMAIL_WEBHOOK_SECRET`. */
export async function POST(request: Request): Promise<Response> {
  if (!hasBearer(request.headers.get("authorization"), process.env.EMAIL_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const payload: unknown = await request.json().catch(() => null);
  let stopped = 0;
  for (const email of addressesToStop(payload)) stopped += await stopDigestFor(email);
  return Response.json({ stopped });
}
