/** Shared with proxy.ts, which must not import the full auth config (database, email). */
export const AUTH_COOKIE_PREFIX = "aitio";

/** Set by Vercel's edge and not spoofable there; other hosts need their own trusted header. */
export const CLIENT_IP_HEADERS = ["x-vercel-forwarded-for", "x-forwarded-for"];

/** Older users shouldn't have to sign in every week. The privacy policy quotes this. */
export const SESSION_DAYS = 90;

/** Sign-in codes (and the emailed link that carries one) expire after this; quoted in the email and the privacy policy. */
export const SIGN_IN_MINUTES = 20;

/** Wrong codes allowed per emailed code before it stops working. */
export const SIGN_IN_ATTEMPTS = 5;

/**
 * Holds the address between "send" and typing the code, so the code can be typed in the
 * same browser without the address in the URL. Named like Better Auth's own (aitio.*),
 * as the privacy policy says.
 */
export const SIGN_IN_EMAIL_COOKIE = `${AUTH_COOKIE_PREFIX}.sign_in_email`;
