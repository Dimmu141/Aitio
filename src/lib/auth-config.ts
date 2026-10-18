/** Shared with proxy.ts, which must not import the full auth config (database, email). */
export const AUTH_COOKIE_PREFIX = "aitio";

/** Set by Vercel's edge and not spoofable there; other hosts need their own trusted header. */
export const CLIENT_IP_HEADERS = ["x-vercel-forwarded-for", "x-forwarded-for"];

/** Older users shouldn't have to sign in every week. The privacy policy quotes this. */
export const SESSION_DAYS = 90;

/** Sign-in links expire after this; quoted in the email and the privacy policy. */
export const MAGIC_LINK_MINUTES = 20;
