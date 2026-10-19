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

/** One key per purpose, so a token sealed for one use can't be replayed as another. */
function key(secret: string, purpose: string): Buffer {
  return createHash("sha256").update(`aitio:${purpose}:${secret}`).digest();
}

/** Any JSON value, encrypted and authenticated, as a URL- and cookie-safe string. */
export function sealJson(value: unknown, secret: string, purpose: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(secret, purpose), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The value, or undefined for anything tampered with, truncated, or sealed with another secret or purpose. */
export function openJson(token: string, secret: string, purpose: string): unknown {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", key(secret, purpose), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const text = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function sealSignIn(claim: SignInClaim, secret: string): string {
  return sealJson(claim, secret, "sign-in-link");
}

/** The claim, or null for anything tampered with, truncated or sealed with another secret. */
export function openSignIn(token: string, secret: string): SignInClaim | null {
  const value = openJson(token, secret, "sign-in-link");
  if (typeof value !== "object" || value === null) return null;
  const { email, otp } = value as Record<string, unknown>;
  return typeof email === "string" && typeof otp === "string" ? { email, otp } : null;
}
