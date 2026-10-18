/** Shared with proxy.ts, which must not import the full auth config (database, email). */
export const AUTH_COOKIE_PREFIX = "aitio";

/** Set by Vercel's edge and not spoofable there; other hosts need their own trusted header. */
export const CLIENT_IP_HEADERS = ["x-vercel-forwarded-for", "x-forwarded-for"];
