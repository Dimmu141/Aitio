import { z } from "zod";

/** Brevo transactional webhook events that mean "stop emailing this address". */
const STOP_EVENTS = new Set(["hard_bounce", "hardBounce", "spam", "invalid_email", "invalid", "blocked", "unsubscribed"]);

const eventSchema = z.object({ event: z.string(), email: z.string() });

/**
 * Addresses to stop the digest for, from one webhook delivery (single or batched).
 * Anything else, including soft bounces, is ignored: those retry on their own.
 */
export function addressesToStop(payload: unknown): string[] {
  const events = Array.isArray(payload) ? payload : [payload];
  return events.flatMap((candidate) => {
    const parsed = eventSchema.safeParse(candidate);
    return parsed.success && STOP_EVENTS.has(parsed.data.event) ? [parsed.data.email] : [];
  });
}
