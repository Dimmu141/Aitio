import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless unsubscribe links: an HMAC of the user id, so the link in every digest works
 * without signing in (a legal requirement for marketing-like email) and can't be forged
 * for someone else. Deleting the account makes old links harmless.
 */
function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is not set");
  return value;
}

export function unsubscribeSignature(userId: string, key = secret()): string {
  return createHmac("sha256", key).update(`digest-unsubscribe:${userId}`).digest("base64url");
}

export function isValidUnsubscribe(userId: string, signature: string, key = secret()): boolean {
  const expected = Buffer.from(unsubscribeSignature(userId, key));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
