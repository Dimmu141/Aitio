import { db } from "@/lib/db";

export interface Limit {
  windowMs: number;
  max: number;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const LIMITS = {
  magicLinkPerEmail: { windowMs: 15 * MINUTE, max: 3 },
  magicLinkPerIp: { windowMs: 15 * MINUTE, max: 10 },
  diarySaves: { windowMs: DAY, max: 50 },
  reports: { windowMs: DAY, max: 20 },
} satisfies Record<string, Limit>;

export interface WindowState {
  count: number;
  /** Start of the current window, ms since epoch (stored in RateLimit.lastRequest). */
  windowStart: number;
}

/** Fixed-window decision: pure, so the edge cases are unit tested. */
export function nextWindow(state: WindowState | null, now: number, limit: Limit): { allowed: boolean; state: WindowState } {
  if (!state || now - state.windowStart >= limit.windowMs) {
    return { allowed: true, state: { count: 1, windowStart: now } };
  }
  if (state.count >= limit.max) return { allowed: false, state };
  return { allowed: true, state: { count: state.count + 1, windowStart: state.windowStart } };
}

/**
 * Count one attempt against `key` and say whether it is allowed. Stored in Postgres so
 * it holds across serverless instances; approximate under races, which is fine here.
 */
export async function consume(key: string, limit: Limit, now = Date.now()): Promise<boolean> {
  const dbKey = `aitio:${key}`;
  const row = await db.rateLimit.findUnique({ where: { key: dbKey } });
  const previous = row ? { count: row.count, windowStart: Number(row.lastRequest) } : null;
  const { allowed, state } = nextWindow(previous, now, limit);
  if (allowed) {
    const data = { count: state.count, lastRequest: BigInt(state.windowStart) };
    await db.rateLimit.upsert({ where: { key: dbKey }, create: { key: dbKey, ...data }, update: data });
  }
  return allowed;
}
