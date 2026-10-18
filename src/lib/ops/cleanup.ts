import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rate-limit rows keep their key (an email address or IP) after the window is over;
 * the longest window is a day, so two days is a safe margin. The privacy policy
 * promises these numbers, so change both together.
 */
export const RATE_LIMIT_RETENTION_DAYS = 2;

export interface CleanupOutcome {
  rateLimits: number;
  sessions: number;
  verifications: number;
}

/** Daily: drop expired personal data that nothing reads any more. */
export async function cleanup(now: Date): Promise<CleanupOutcome> {
  const [rateLimits, sessions, verifications] = await Promise.all([
    db.rateLimit.deleteMany({ where: { lastRequest: { lt: BigInt(now.getTime() - RATE_LIMIT_RETENTION_DAYS * DAY_MS) } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return { rateLimits: rateLimits.count, sessions: sessions.count, verifications: verifications.count };
}
