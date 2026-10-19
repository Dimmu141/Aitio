import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * The emailed sign-in link carries the address and the 6-digit code it signs in with.
 * Sealed (AES-256-GCM, key derived from BETTER_AUTH_SECRET) so neither shows up in
 * request logs or browser history; the code itself still expires and works once.
 */
export interface SignInClaim {
  email: string;
  otp: string;
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(secret: string): Buffer {
  return createHash("sha256").update(`aitio:sign-in-link:${secret}`).digest();
}

export function sealSignIn(claim: SignInClaim, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(claim), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The claim, or null for anything tampered with, truncated or sealed with another secret. */
export function openSignIn(token: string, secret: string): SignInClaim | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const text = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) return null;
    const { email, otp } = value as Record<string, unknown>;
    return typeof email === "string" && typeof otp === "string" ? { email, otp } : null;
  } catch {
    return null;
  }
}
